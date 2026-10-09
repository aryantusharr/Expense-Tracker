/**
 * Past chats — kept on the phone (localStorage), nothing in Firestore. Pure helpers + a thin storage layer.
 * A chat is editable while it is open and for 1 minute after it is closed (her call 4 Oct); after that it is read-only.
 * chat = { id, createdAt, updatedAt, closedAt|null, messages[] }
 */
import { billTotals } from './chatModel.js';
import { fmtINR } from './common.js';

export const LOCK_MS = 60 * 1000;
const KEY = 'splitease_aai_chats';
const MAX_CHATS = 30;
const KEEP_DAYS = 30;

/** When the chat stopped being open. A chat that was never closed cleanly (app killed) ended at its last activity. */
export const endedAt = chat => chat.closedAt ?? chat.updatedAt ?? chat.createdAt ?? 0;
export const isEditable = (chat, now, openId = null) => chat.id === openId || now - endedAt(chat) < LOCK_MS;

/** The chat to continue when AAI is opened: the newest non-empty one that was closed less than a minute ago. */
export function pickResume(chats, now) {
  return [...chats]
    .filter(c => c.messages?.length && now - endedAt(c) < LOCK_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

const cardsOf = messages => messages.filter(m => m.role === 'ai' && m.card).map(m => m.card);
const isSaved = c => c.status === 'saved' || c.status === 'onphone';
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "Cig, chai, auto" · "Blinkit bill" — from what the cards are about; falls back to what was typed. */
export function chatTitle(messages) {
  const names = [];
  for (const c of cardsOf(messages)) {
    const n = c.kind === 'bill' ? (c.bill.name && c.bill.name !== 'Untitled bill' ? c.bill.name : 'Bill') : c.draft.description;
    const t = (n || '').trim();
    if (t && !names.some(x => x.toLowerCase() === t.toLowerCase())) names.push(t);
  }
  if (names.length) return clip(cap(names.slice(0, 3).join(', ')), 34);
  const first = messages.find(m => m.role === 'me' && typeof m.text === 'string' && m.text.trim());
  if (first) return clip(cap(first.text.trim()), 34);
  const shots = messages.find(m => m.role === 'me' && m.shots);          // a chat that only has bill screenshots
  return shots ? 'Bill screenshots' : 'New chat';
}

/** "3 ADDED · ₹180" · "9 ITEMS · ₹612" · "1 TO ADD". locked → the chat can't be changed any more. */
export function chatMeta(messages, { locked = false } = {}) {
  const cards = cardsOf(messages);
  const saved = cards.filter(isSaved);
  const open = cards.length - saved.length;
  const parts = [];
  if (saved.length) {
    const only = saved.length === 1 && saved[0].kind === 'bill';
    const count = saved.reduce((n, c) => n + (c.kind === 'bill' ? c.bill.items.filter(i => !(i.rest && !(i.amount > 0))).length : 1), 0);
    const total = saved.reduce((s, c) => s + (c.kind === 'bill' ? billTotals(c.bill).total : c.draft.amount), 0);
    parts.push(only ? `${count} ITEMS` : `${count} ADDED`, fmtINR(total));
  }
  if (open) parts.push(`${open} ${locked ? 'NOT ADDED' : 'TO ADD'}`);
  if (!parts.length) parts.push('NOTHING ADDED');
  return parts.join(' · ');
}

const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/**
 * Sidebar groups, newest first: ACTIVE (open, or closed < 1 min ago) · EARLIER TODAY · YESTERDAY · OLDER.
 * Returns only the groups that have chats: [{ key, label, items }].
 */
export function groupChats(chats, now, openId = null) {
  const today = dayKey(now);
  const yest = dayKey(now - 86400000);
  const g = { active: [], today: [], yesterday: [], older: [] };
  [...chats].filter(c => c.messages?.length).sort((a, b) => b.updatedAt - a.updatedAt).forEach(c => {
    if (isEditable(c, now, openId)) g.active.push(c);
    else if (dayKey(c.updatedAt) === today) g.today.push(c);
    else if (dayKey(c.updatedAt) === yest) g.yesterday.push(c);
    else g.older.push(c);
  });
  return [
    { key: 'active', label: 'ACTIVE', items: g.active },
    { key: 'today', label: 'EARLIER TODAY · READ ONLY', items: g.today },
    { key: 'yesterday', label: 'YESTERDAY', items: g.yesterday },
    { key: 'older', label: 'OLDER · READ ONLY', items: g.older },
  ].filter(x => x.items.length);
}

/** Messages as they are kept: thinking is finished, a card that was mid-save goes back to editable. */
export function serialiseMessages(messages) {
  return messages.map(m => {
    if (m.role !== 'ai') { const rest = { ...m }; delete rest.thumbs; return rest; }   // screenshots are never stored — only their count
    // a bill question still waiting can't be answered after a reload (the screenshots are gone) → stored as closed
    if (m.ask && !m.ask.answered) m = { ...m, ask: { ...m.ask, answered: true, cancelled: true } };
    const card = m.card && m.card.status === 'saving' ? { ...m.card, status: 'open' } : m.card;
    return { ...m, card, shown: m.steps?.length || 0, done: true };
  });
}

// ── storage ──
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = all => {
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; }
};

export const loadChats = code => read()[code] || [];

function put(code, list) {
  const all = read();
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  all[code] = list.filter(c => endedAt(c) > cutoff).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
  if (!write(all)) { all[code] = all[code].slice(0, 8); write(all); }          // storage full → keep the newest few
}

export function saveChat(code, chat) {
  const list = loadChats(code).filter(c => c.id !== chat.id);
  put(code, [chat, ...list]);
}

export function closeStored(code, id, at = Date.now()) {
  const list = loadChats(code);
  const c = list.find(x => x.id === id);
  if (!c) return;
  put(code, list.map(x => (x.id === id ? { ...x, closedAt: at } : x)));
}

/** Change one card of a stored chat (used when a save that was waiting for the network finally lands). */
export function patchStoredCard(code, chatId, msgId, patch) {
  const list = loadChats(code);
  const c = list.find(x => x.id === chatId);
  if (!c) return;
  const messages = c.messages.map(m => (m.id === msgId && m.card ? { ...m, card: { ...m.card, ...patch } } : m));
  put(code, list.map(x => (x.id === chatId ? { ...x, messages } : x)));
}

/** The server has everything that was waiting: cards still marked "on phone" become added (no Undo — that window is long gone). */
export function settleStored(code) {
  const list = loadChats(code);
  if (!list.some(c => c.messages.some(m => m.card?.status === 'onphone'))) return;
  const at = Date.now() - 5000;
  put(code, list.map(c => ({
    ...c,
    messages: c.messages.map(m => (m.card?.status === 'onphone' ? { ...m, card: { ...m.card, status: 'saved', savedAt: at } } : m)),
  })));
}
