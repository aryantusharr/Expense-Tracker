/**
 * AAI → Firestore. Uses the same save functions as the Add screen, so documents are identical
 * (plus source:'text'). Each helper resolves { ids, moment, toast, share } or throws.
 */
import { addExpense, addItemisedExpenseGroup, updateExpense, deleteExpense } from '../../services/expenseService';
import { setLastUsedDefaults } from '../../utils/lastUsedDefaults';
import { addRecentDescription } from '../../utils/recentDescriptions';
import { resolveCategoryIcon } from '../../design/categoryIcons';
import { fmtINR, cleanName } from '../../aai/common.js';

const SAVE_WAIT_MS = 8000;
// Same as the Add screen: if Firestore is slow, treat as saved — it syncs when the connection returns.
const withTimeout = p => Promise.race([p, new Promise(res => setTimeout(() => res('timeout'), SAVE_WAIT_MS))]);
const fmtN = n => Math.round(n * 100) / 100;

/** c = { roomCode, room, expenses, users, categories, meId, isPersonal } */
const who = (c, id) => (id === c.meId ? 'you' : cleanName(c.users.find(u => u.id === id)?.name || ''));

function owedLine(c, amount, paidBy, split) {
  if (c.isPersonal || !c.meId || !split.length) return null;
  const share = amount / split.length;
  if (paidBy === c.meId) {
    const back = split.includes(c.meId) ? amount - share : amount;
    return back > 0 ? `You get ${fmtINR(Math.round(back))} back` : null;
  }
  return split.includes(c.meId) ? `You owe ${who(c, paidBy)} ${fmtINR(Math.round(share))}` : null;
}

function shareText(c, title, amount, paidBy, split) {
  const room = c.room?.name || '';
  if (c.isPersonal) return `${title} ${fmtINR(amount)} — added on SplitEase`;
  const each = split.length ? ` · ${fmtINR(Math.round(amount / split.length))} each` : '';
  return `${title} ${fmtINR(amount)} — ${who(c, paidBy) === 'you' ? 'I paid' : `${who(c, paidBy)} paid`}, split ${split.length}${each}${room ? ` (${room})` : ''} · SplitEase`;
}

const iconOf = (c, id) => { const cat = c.categories.find(x => x.id === id); return cat ? resolveCategoryIcon(cat).path : undefined; };
const payerLabel = (c, id) => (c.isPersonal ? '' : `${(who(c, id) === 'you' ? cleanName(c.users.find(u => u.id === id)?.name || 'You') : who(c, id)).toUpperCase()} PAID`);

const personal = c => c.users[0]?.id || '';
const norm = (c, e) => ({
  ...e,
  paidBy: c.isPersonal ? personal(c) : e.paidBy,
  splitAmong: c.isPersonal ? [personal(c)] : e.splitAmong,
});

function remember(c, e) {
  setLastUsedDefaults(c.roomCode, { categoryId: e.categoryId, paidBy: c.isPersonal ? null : e.paidBy, splitAmong: c.isPersonal ? null : e.splitAmong });
  if (e.description) addRecentDescription(c.roomCode, e.description);
}

async function addOne(c, d) {
  const e = norm(c, d);
  const p = addExpense(c.roomCode, {
    description: (e.description || 'Expense').trim(), amount: e.amount, paidBy: e.paidBy, splitAmong: e.splitAmong,
    categoryId: e.categoryId, date: e.date, source: 'text',
  }, c.room, c.expenses.length ? c.expenses : null);
  p.catch(err => console.error('AAI save failed after timeout', err));
  const res = await withTimeout(p);
  remember(c, e);
  return res === 'timeout' ? null : res.id;
}

export async function saveExpense(c, draft) {
  const e = norm(c, draft);
  const id = await addOne(c, e);
  const title = (e.description || 'Expense').trim();
  const n = e.splitAmong.length;
  return {
    ids: id ? [id] : [],
    title,
    moment: {
      title, date: e.date, total: e.amount, room: c.room?.name || c.roomCode, paid: payerLabel(c, e.paidBy),
      lines: [{ name: title, amount: e.amount, iconPath: iconOf(c, e.categoryId) }],
      rows: c.isPersonal || n < 1 ? [] : [{ a: `SPLIT ${n} WAYS`, b: `${n} × ${fmtN(e.amount / n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }],
    },
    toast: { message: `Added ${fmtINR(e.amount)} ${title}`, sub: owedLine(c, e.amount, e.paidBy, e.splitAmong) },
    share: shareText(c, title, e.amount, e.paidBy, e.splitAmong),
    date: e.date,
  };
}

/** Several separate expenses (one document each). */
export async function saveMany(c, intent) {
  const ids = [];
  for (const x of intent.expenses) {
    const id = await addOne(c, { ...x, date: x.date });
    if (id) ids.push(id);
  }
  const last = intent.expenses[intent.expenses.length - 1];
  return {
    ids,
    title: `${intent.count} expenses`,
    moment: {
      title: `${intent.count} expenses`, date: last.date, total: intent.total, room: c.room?.name || c.roomCode,
      paid: payerLabel(c, last.paidBy),
      lines: intent.expenses.map(x => ({ name: x.description || 'Expense', amount: x.amount, iconPath: iconOf(c, x.categoryId) })),
      rows: [],
    },
    toast: { message: `Added ${intent.count} expenses`, sub: fmtINR(intent.total) },
    share: `${intent.expenses.map(x => `${x.description || 'Expense'} ${fmtINR(x.amount)}`).join(', ')} — added on SplitEase`,
    date: last.date,
  };
}

/** One bill with several items (group). items = [{ description, amount, categoryId, splitAmong }] */
export async function saveBill(c, { name, date, paidBy, items }) {
  const payer = c.isPersonal ? personal(c) : paidBy;
  const rows = items.map(i => ({
    description: (i.description || '').trim() || name, amount: i.amount, categoryId: i.categoryId,
    splitAmong: c.isPersonal ? [payer] : i.splitAmong,
  }));
  const p = addItemisedExpenseGroup(c.roomCode, name, rows, { paidBy: payer, date, source: 'text' }, c.room, c.expenses.length ? c.expenses : null);
  p.catch(err => console.error('AAI bill save failed after timeout', err));
  const res = await withTimeout(p);
  const last = rows[rows.length - 1];
  setLastUsedDefaults(c.roomCode, { categoryId: last.categoryId, paidBy: c.isPersonal ? null : payer, splitAmong: c.isPersonal ? null : last.splitAmong });
  const total = fmtN(rows.reduce((s, r) => s + r.amount, 0));
  const mine = !c.isPersonal && c.meId && payer === c.meId
    ? Math.round(rows.reduce((s, r) => s + (r.splitAmong.includes(c.meId) ? r.amount - r.amount / r.splitAmong.length : r.amount), 0)) : 0;
  return {
    ids: res === 'timeout' ? [] : res.items.map(i => i.id),
    title: name,
    moment: {
      title: name, date, total, room: c.room?.name || c.roomCode, paid: payerLabel(c, payer),
      lines: rows.map(r => ({ name: r.description, amount: r.amount, iconPath: iconOf(c, r.categoryId) })), rows: [],
    },
    toast: { message: `Added ${fmtINR(total)} ${name}`, sub: mine > 0 ? `You get ${fmtINR(mine)} back` : `${rows.length} items` },
    share: `${name} ${fmtINR(total)} (${rows.length} items) — ${c.isPersonal ? 'added' : who(c, payer) === 'you' ? 'I paid' : `${who(c, payer)} paid`} · SplitEase`,
    date,
  };
}

/** undo / change / remove — plans come from src/aai/commands.js. */
export async function runPlan(c, plan) {
  if (plan.action === 'delete') {
    for (const id of plan.ids) await withTimeout(deleteExpense(c.roomCode, id, c.room));
    return { toast: { message: 'Undone', sub: plan.summary } };
  }
  await withTimeout(updateExpense(c.roomCode, plan.id, plan.updates, c.room, c.expenses.length ? c.expenses : null));
  return { toast: { message: 'Updated', sub: plan.summary } };
}

/** WhatsApp / system share. Returns true if something opened. */
export async function shareOut(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return true; }
  } catch (e) { if (e?.name === 'AbortError') return false; }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return true;
}
