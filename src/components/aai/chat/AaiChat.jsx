import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext } from '../../../context/RoomContext';
import { haptic } from '../../../utils/haptics';
import { useKeyboard } from '../../ui/Keyboard';
import { useToast } from '../../ui/Toast';
import { localDateStr } from '../../dashboard/dashboardData';
import { cleanName, MONTH_NAMES, fromDateStr } from '../../../aai/common.js';
import { respond, billFromPast, uid, billTotals, liveItems } from '../../../aai/chatModel.js';
import { greetingContext, pickGreeting } from '../../../aai/greetings.js';
import { memberStats, heatLine } from '../../../aai/heatmap.js';
import { quickUsuals, repeatBills } from '../../../aai/usuals.js';
import { saveExpense, saveBill, saveMany, runPlan } from '../aaiSave';
import { Header, Av, Say, Thinking, ChatLoader } from './parts';
import { withStyle } from './members';
import { EmptyState } from './Heatmap';
import { QuickCard, BillCard } from './Cards';
import { Composer, FocusRows } from './Composer';
import useOpens from './useOpens';
import './Chat.css';

/**
 * Aryan AI — the chat (docs/AAI-Chat-Handoff.md). Full screen, opened from the Dashboard pill:
 * short A|AI loader on the blurred Dashboard → chat fades up. AAI only ADDS expenses (typed text; bill
 * screenshots come in the next chat). Saves go through the Add screen's own functions, source 'text'.
 */

const LOAD_MS = 1200;
const CLOSE_MS = 220;
const STEP_MS = 440;
const K_SEEN = 'splitease_aai_lastseen';
const K_GREET = 'splitease_aai_greet';

const rd = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function AaiChat({ onClose }) {
  const { room, roomCode, expenses, users, categories, userIdentity } = useRoomContext();
  const kb = useKeyboard();
  const toast = useToast();
  const isPersonal = room?.isPersonal === true;
  const members = useMemo(() => withStyle(users), [users]);
  const meId = userIdentity && users.some(u => u.id === userIdentity) ? userIdentity : (isPersonal ? users[0]?.id ?? null : null);
  const me = users.find(u => u.id === meId);
  const roomName = room?.name || roomCode;
  const otherId = useMemo(() => categories.find(c => /^other/i.test(c.name))?.id || null, [categories]);

  // ── open: loader → chat ──
  const [phase, setPhase] = useState('loading');      // loading → ready
  const [loaderGone, setLoaderGone] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('ready'), reduced() ? 500 : LOAD_MS);
    const t2 = setTimeout(() => setLoaderGone(true), (reduced() ? 500 : LOAD_MS) + 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    if (closing) return;
    haptic('tap');
    kb?.close();
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }, [closing, kb, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape' && !kb?.active) close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  });

  // ── greeting + heatmap (the empty state) ──
  const now = useMemo(() => new Date(), []);
  const makeGreeting = useCallback(() => {
    const n = new Date();
    const ctx = greetingContext({ now: n, expenses, lastSeen: rd(K_SEEN, null) });
    return pickGreeting(ctx, { now: n, name: me ? cleanName(me.name) : '', lastIdx: rd(K_GREET, {})[ctx.key] });
  }, [expenses, me]);
  const [greeting, setGreeting] = useState(makeGreeting);
  useEffect(() => { wr(K_GREET, { ...rd(K_GREET, {}), [greeting.key]: greeting.idx }); }, [greeting]);
  useEffect(() => { wr(K_SEEN, Date.now()); }, []);

  const opens = useOpens();
  const heatMembers = useMemo(() => (isPersonal ? members.filter(m => m.id === meId) : members), [isPersonal, members, meId]);
  const stats = useMemo(() => memberStats(opens, now), [opens, now]);
  const line = useMemo(() => heatLine({ stats, opens, members: heatMembers, meId, now, personal: isPersonal }), [stats, opens, heatMembers, meId, now, isPersonal]);

  // ── chat state ──
  const [messages, setMessages] = useState([]);
  const msgRef = useRef(messages);
  useEffect(() => { msgRef.current = messages; }, [messages]);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const [text, setText] = useState('');
  const [openThink, setOpenThink] = useState({});
  const [sessionDate, setSessionDate] = useState(null);       // "Adding for 2 Oct" — kept for the next entries until ✕
  const today = localDateStr();
  const pickSessionDate = d => setSessionDate(d && d !== today ? d : null);
  const fieldRef = useRef(null);
  const scroller = useRef(null);

  const patchMsg = (id, fn) => setMessages(ms => ms.map(m => (m.id === id ? fn(m) : m)));
  const patchCard = (id, fn) => patchMsg(id, m => ({ ...m, card: m.card ? fn(m.card) : m.card }));

  const session = () => ({
    users, me: meId, categories, expenses, isPersonal, now: new Date(), date: sessionDate,
    firstCard: !msgRef.current.some(m => m.card),
  });

  /** Add the user's bubble + AAI's reply (steps reveal one by one, then fold into "Show thinking"). */
  const push = (meText, r) => {
    const id = uid();
    const instant = reduced();
    setMessages(ms => [...ms, { id: `${id}m`, role: 'me', text: meText }, { id, role: 'ai', steps: r.steps, reply: r.reply, card: r.card, shown: instant ? r.steps.length : 0, done: instant }]);
    if (!instant) {
      r.steps.forEach((_, i) => timers.current.push(setTimeout(() => patchMsg(id, m => ({ ...m, shown: i + 1 })), STEP_MS * (i + 1))));
      timers.current.push(setTimeout(() => patchMsg(id, m => ({ ...m, done: true })), STEP_MS * r.steps.length + 260));
    }
  };

  const send = raw => {
    const t = (raw || '').trim();
    if (!t) return;
    haptic('tap');
    setText('');
    push(t, respond(t, session()));
  };

  // Chips above the composer
  const sendUsual = u => {
    haptic('tap');
    const t = `${u.description} ${u.amount}`.toLowerCase();
    const r = respond(t, session());
    if (r.card?.kind === 'quick') {
      r.card.draft = { ...r.card.draft, categoryId: u.categoryId || r.card.draft.categoryId, splitAmong: isPersonal ? r.card.draft.splitAmong : (u.splitAmong.length ? u.splitAmong : r.card.draft.splitAmong), paidBy: isPersonal ? r.card.draft.paidBy : (u.paidBy || r.card.draft.paidBy) };
    }
    push(t, r);
  };
  const sendBillAgain = b => { haptic('tap'); push(`${b.name} again`, billFromPast(b, session())); };

  const bills = useMemo(() => repeatBills(expenses, { now }), [expenses, now]);
  const usuals = useMemo(() => quickUsuals(expenses, { users, me: meId, isPersonal }), [expenses, users, meId, isPersonal]);

  // ── saving ──
  const ctx = { roomCode, room, expenses, users, categories, meId, isPersonal };
  const fail = (e, id) => {
    console.error(e);
    patchCard(id, c => ({ ...c, status: 'open' }));
    toast({ kind: 'error', message: <b>{e?.message || 'Couldn’t save — try again'}</b>, top: true });
  };
  const savedPatch = res => c => ({ ...c, status: res.ids.length ? 'saved' : 'onphone', ids: res.ids, savedAt: Date.now() });

  const confirm = async (id, mode = 'bill') => {
    const m = msgRef.current.find(x => x.id === id);
    if (!m?.card || m.card.status === 'saving') return;
    patchCard(id, c => ({ ...c, status: 'saving' }));
    try {
      let res;
      if (m.card.kind === 'quick') {
        const d = { ...m.card.draft, categoryId: m.card.draft.categoryId || otherId };
        res = await saveExpense(ctx, d);
        if (d.dateGiven) pickSessionDate(d.date);
      } else {
        const b = m.card.bill;
        const rows = liveItems(b);
        if (mode === 'separate') {
          const total = billTotals(b).total;
          res = await saveMany(ctx, {
            count: rows.length, total,
            expenses: rows.map(i => ({ description: i.name, amount: i.amount, categoryId: i.categoryId || otherId, date: b.date, paidBy: b.paidBy, splitAmong: i.splitAmong })),
          });
        } else {
          res = await saveBill(ctx, {
            name: b.name || 'Bill', date: b.date, paidBy: b.paidBy,
            items: rows.map(i => ({ description: i.name, amount: i.amount, categoryId: i.categoryId || otherId, splitAmong: i.splitAmong })),
          });
        }
        if (b.date !== today) pickSessionDate(b.date);
      }
      haptic('success');
      patchCard(id, savedPatch(res));
    } catch (e) { fail(e, id); }
  };

  const undo = async id => {
    const m = msgRef.current.find(x => x.id === id);
    const ids = m?.card?.ids || [];
    if (!ids.length) return;
    patchCard(id, c => ({ ...c, status: 'saving' }));
    try {
      await runPlan(ctx, { action: 'delete', ids, summary: '' });
      haptic('tap');
      patchCard(id, c => ({ ...c, status: 'open', ids: [], savedAt: null }));
    } catch (e) {
      console.error(e);
      patchCard(id, c => ({ ...c, status: 'saved' }));
      toast({ kind: 'error', message: <b>Couldn’t undo — try again</b>, top: true });
    }
  };

  const newChat = () => {
    haptic('tap');
    timers.current.forEach(clearTimeout); timers.current = [];
    setMessages([]); setText(''); setOpenThink({}); setSessionDate(null);
    setGreeting(makeGreeting());
  };

  // keep the newest thing in view
  const last = messages[messages.length - 1];
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' });
  }, [messages.length, last?.shown, last?.done, last?.card?.status]);

  const empty = messages.length === 0;
  const focused = !!kb?.active?.digits;                    // the composer (the only digit-row field) has the keyboard
  const cardProps = { members, categories, meId, isPersonal, roomName, now };
  const heat = { members: heatMembers, opens, stats, now, line, onPickDay: d => { haptic('choose'); pickSessionDate(d); fieldRef.current?.focus(); } };

  return createPortal(
    <div className={`ch ${closing ? 'is-out' : ''} ${phase === 'ready' ? 'is-ready' : ''}`} role="dialog" aria-modal="true" aria-label="Aryan AI">
      <div className="ch-glow ch-glow--v" aria-hidden="true" />
      <div className="ch-glow ch-glow--t" aria-hidden="true" />
      <Header onMenu={() => toast({ message: 'Past chats arrive in the next step', top: true, duration: 1800 })} onNew={newChat} onClose={close} />

      <div className="ch-scroll" ref={scroller}>
        {empty ? (
          <EmptyState greeting={greeting} compact={focused} heat={heat} />
        ) : (
          <div className="ch-body">
            {messages.map(m => (m.role === 'me' ? (
              <div key={m.id} className="ch-me">{m.text}</div>
            ) : (
              <div key={m.id} className="ch-ai">
                <Av />
                <div className="ch-ai__c">
                  <Thinking steps={m.steps} shown={m.shown} done={m.done} open={!!openThink[m.id]} onToggle={() => setOpenThink(o => ({ ...o, [m.id]: !o[m.id] }))} />
                  {m.done && m.reply && <Say text={m.reply} />}
                  {m.done && m.card && (m.card.kind === 'quick'
                    ? <QuickCard key={m.id} card={m.card} {...cardProps} onChange={c => patchCard(m.id, () => c)} onConfirm={() => confirm(m.id)} onUndo={() => undo(m.id)} />
                    : <BillCard key={m.id} card={m.card} {...cardProps} onChange={c => patchCard(m.id, () => c)} onConfirm={() => confirm(m.id)} onSeparate={() => confirm(m.id, 'separate')} onUndo={() => undo(m.id)} />)}
                </div>
              </div>
            )))}
          </div>
        )}
      </div>

      <div className="ch-dock">
        {empty && focused && <FocusRows bills={bills} usuals={usuals} isPersonal={isPersonal} onBill={sendBillAgain} onUsual={sendUsual} />}
        {sessionDate && (
          <div className="ch-datepill" data-kb>
            <span>Adding for {fromDateStr(sessionDate).getDate()} {MONTH_NAMES[fromDateStr(sessionDate).getMonth()]}</span>
            <button type="button" aria-label="Back to today" onClick={() => { haptic('tap'); setSessionDate(null); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        <Composer text={text} setText={setText} onSend={send} fieldRef={fieldRef}
          onBill={() => toast({ message: 'Bill reading arrives in the next update', top: true, duration: 2000 })} />
      </div>

      {!loaderGone && <ChatLoader out={phase === 'ready'} />}
    </div>,
    document.body,
  );
}
