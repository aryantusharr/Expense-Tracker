import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useRoomContext } from '../../../context/RoomContext';
import { shareRoom, copyToClipboard, getRoomShareUrl } from '../../../utils/helpers';
import { haptic } from '../../../utils/haptics';
import { useKeyboard } from '../../ui/Keyboard';
import { useToast } from '../../ui/Toast';
import { localDateStr } from '../../dashboard/dashboardData';
import { cleanName, MONTH_NAMES, fromDateStr } from '../../../aai/common.js';
import { respond, handCard, billFromPast, uid, billTotals, liveItems } from '../../../aai/chatModel.js';
import { saveDown, errorReply } from '../../../aai/errors.js';
import { learnPatterns } from '../../../utils/categoryGuess.js';
import { normaliseRead, billFromRead, billMismatch, readingSteps, classifyReadError, shortDate, TAXES_CATEGORY } from '../../../aai/billParse.js';
import { queueBill, unqueueBill, queuedBills, readyToRead } from '../../../aai/billQueue.js';
import { loadChats, saveChat, closeStored, patchStoredCard, settleStored, pickResume, isEditable, serialiseMessages } from '../../../aai/chatStore.js';
import { greetingContext, pickGreeting } from '../../../aai/greetings.js';
import { memberStats, heatLine } from '../../../aai/heatmap.js';
import { quickUsuals, repeatBills } from '../../../aai/usuals.js';
import { saveExpense, saveBill, saveMany, runPlan } from '../aaiSave';
import { updateCategories } from '../../../services/roomService';
import { Header, Av, Say, Thinking, ChatLoader, Mg } from './parts';
import { withStyle } from './members';
import { EmptyState } from './Heatmap';
import { QuickCard, BillCard, UNDO_MS } from './Cards';
import ErrorReply from './Errors';
import { Shots, ConsentAsk, PayerAsk, FetchedName } from './Bill';
import PastChats from './PastChats';
import { Composer, FocusRows } from './Composer';
import useOpens from './useOpens';
import './Chat.css';

/**
 * Aryan AI — the chat (docs/AAI-Chat-Handoff.md). Full screen, opened from the Dashboard pill:
 * short A|AI loader on the blurred Dashboard → chat fades up. AAI only ADDS expenses (typed text
 * and bill screenshots, read by Gemini via billRead.js — lazy-loaded on the first "+"). Saves go through the Add
 * screen's own functions, source 'text' | 'bill'.
 */

const LOAD_MS = 8000;                                       // one full L1 loop; tap skips
const CLOSE_MS = 220;
const STEP_MS = 440;
const K_SEEN = 'splitease_aai_lastseen';
const K_GREET = 'splitease_aai_greet';
const K_CONSENT = 'splitease_aai_consent';
const MAX_SHOTS = 4;
const SLOW_MS = 12000;
const TYPE_HINT = 'Blinkit 612: potato 40, milk 68';

const rd = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function AaiChat({ onClose }) {
  const { room, roomCode, expenses, users, categories, userIdentity } = useRoomContext();
  const kb = useKeyboard();
  const toast = useToast();
  const isPersonal = room?.isPersonal === true;
  const members = useMemo(() => withStyle(users), [users]);
  const solo = !isPersonal && users.length === 1;           // a shared room where only you have joined so far
  const alone = isPersonal || solo;                         // → no "Paid by" / "Split" anywhere
  const meId = userIdentity && users.some(u => u.id === userIdentity) ? userIdentity : (alone ? users[0]?.id ?? null : null);
  const me = users.find(u => u.id === meId);
  const roomName = room?.name || roomCode;
  const otherId = useMemo(() => categories.find(c => /^other/i.test(c.name))?.id || null, [categories]);

  // ── open: loader → chat ──
  const [phase, setPhase] = useState('loading');      // loading → ready
  const [loaderGone, setLoaderGone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    const ms = skipped ? 0 : reduced() ? 500 : LOAD_MS;
    const t1 = setTimeout(() => setPhase('ready'), ms);
    const t2 = setTimeout(() => setLoaderGone(true), ms + 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [skipped]);

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
  const line = useMemo(() => heatLine({ stats, opens, members: heatMembers, meId, now, personal: alone }), [stats, opens, heatMembers, meId, now, alone]);

  // ── chat state — kept on the phone; a chat closed less than a minute ago is picked up again ──
  const navigate = useNavigate();
  const [resume] = useState(() => pickResume(loadChats(roomCode), Date.now()));
  const [chatId, setChatId] = useState(() => resume?.id || uid());
  const [chatBorn, setChatBorn] = useState(() => resume?.createdAt || Date.now());
  const [messages, setMessages] = useState(() => resume?.messages || []);
  const [view, setView] = useState(null);                     // an old chat opened read-only
  const [menu, setMenu] = useState(false);
  const [chats, setChats] = useState([]);
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
    users, me: meId, categories, expenses, isPersonal: alone, solo, roomName, now: new Date(), date: sessionDate,
    firstCard: !msgRef.current.some(m => m.card),
  });

  /** Add the user's bubble (none when meText is null) + AAI's reply (steps reveal one by one, then fold into "Show thinking"). */
  const push = (meText, r) => {
    const id = uid();
    const instant = reduced();
    setMessages(ms => [...ms,
      ...(meText == null ? [] : [{ id: `${id}m`, role: 'me', text: meText }]),
      { id, role: 'ai', steps: r.steps, reply: r.reply, card: r.card, error: r.error || null, chips: r.chips || null, shown: instant ? r.steps.length : 0, done: instant }]);
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
    setHint(null);
    push(t, respond(t, session()));
  };

  // Chips above the composer
  const sendUsual = u => {
    haptic('tap');
    const t = `${u.description} ${u.amount}`.toLowerCase();
    const r = respond(t, session());
    if (r.card?.kind === 'quick') {
      r.card.draft = { ...r.card.draft, categoryId: u.categoryId || r.card.draft.categoryId, splitAmong: alone ? r.card.draft.splitAmong : (u.splitAmong.length ? u.splitAmong : r.card.draft.splitAmong), paidBy: alone ? r.card.draft.paidBy : (u.paidBy || r.card.draft.paidBy) };
    }
    push(t, r);
  };
  const sendBillAgain = b => { haptic('tap'); push(`${b.name} again`, billFromPast(b, session())); };

  const bills = useMemo(() => repeatBills(expenses, { now }), [expenses, now]);
  const usuals = useMemo(() => quickUsuals(expenses, { users, me: meId, isPersonal: alone }), [expenses, users, meId, alone]);

  // ── saving ──
  const ctx = { roomCode, room, expenses, users, categories, meId, isPersonal };
  /** An error as a reply (board 7). ref = the card message a "Try again" should save again. */
  const pushError = (error, extra = {}) => {
    const id = uid();
    setMessages(ms => [...ms, { id, role: 'ai', steps: [], reply: null, card: null, error, chips: null, shown: 0, done: true, ...extra }]);
  };
  const fail = (e, id, mode) => {
    console.error(e);
    haptic('error');
    patchCard(id, c => ({ ...c, status: 'open' }));
    pushError(saveDown(e), { ref: id, mode });
  };
  const savedPatch = res => c => ({ ...c, status: res.ids.length ? 'saved' : 'onphone', ids: res.ids, savedAt: Date.now() });
  /** Saved on the phone only (offline / slow): when the server has it, the amber stamp turns teal ADDED. */
  const watchLate = (res, msgId, cid) => {
    if (!res.late) return;
    res.late.then(ids => {
      const done = { status: 'saved', ids, savedAt: Date.now() - UNDO_MS };       // no Undo bar for a late sync
      patchStoredCard(roomCode, cid, msgId, done);
      patchCard(msgId, c => ({ ...c, ...done }));
    }).catch(() => {});
  };

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
        const shot = b.source === 'bill';
        const rows = liveItems(b).filter(i => !(i.failed && !(i.amount > 0)))
          .map(i => ({ ...i, name: [i.name || (i.failed ? 'Unread item' : 'Item'), shot ? '' : i.qty].filter(Boolean).join(' ') }));
        const source = shot ? 'bill' : 'text';
        let sctx = ctx;
        if (rows.some(i => i.categoryId === TAXES_CATEGORY.id)) {   // first bill with taxes in this room → the category is created now
          const next = [...categories, TAXES_CATEGORY];
          await Promise.race([updateCategories(roomCode, next), new Promise(r => setTimeout(r, 4000))]).catch(() => {});
          sctx = { ...ctx, categories: next, room: { ...room, categories: next } };
        }
        if (mode === 'separate') {
          const total = billTotals(b).total;
          res = await saveMany(sctx, {
            count: rows.length, total,
            expenses: rows.map(i => ({ description: i.name, amount: i.amount, categoryId: i.categoryId || otherId, date: b.date, paidBy: b.paidBy, splitAmong: i.splitAmong, source })),
          });
        } else {
          res = await saveBill(sctx, {
            name: b.name || 'Bill', date: b.date, paidBy: b.paidBy, source,
            items: rows.map(i => ({ description: i.name, amount: i.amount, categoryId: i.categoryId || otherId, splitAmong: i.splitAmong })),
          });
        }
        if (b.date !== today) pickSessionDate(b.date);
      }
      haptic('success');
      patchCard(id, savedPatch(res));
      watchLate(res, id, chatId);
    } catch (e) { fail(e, id, mode); }
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

  // ── chats: persist, drawer, new / continue / read-only ──
  useEffect(() => {
    if (!messages.length) return;
    saveChat(roomCode, { id: chatId, createdAt: chatBorn, updatedAt: Date.now(), closedAt: null, messages: serialiseMessages(messages) });
  }, [messages, chatId, chatBorn, roomCode]);

  const live = useRef({ id: chatId, has: false });
  useEffect(() => { live.current = { id: chatId, has: messages.length > 0 }; });
  useEffect(() => () => { if (live.current.has) closeStored(roomCode, live.current.id); }, [roomCode]);   // closing starts the 1-minute clock

  // saved-on-phone cards turn teal once Firestore has the write (also for a chat reopened after the app was closed)
  const hasOnPhone = messages.some(m => m.card?.status === 'onphone');
  useEffect(() => {
    let alive = true;
    waitForPendingWrites(db).then(() => {
      if (!alive) return;
      settleStored(roomCode);
      setMessages(ms => (ms.some(m => m.card?.status === 'onphone')
        ? ms.map(m => (m.card?.status === 'onphone' ? { ...m, card: { ...m.card, status: 'saved', savedAt: Date.now() - UNDO_MS } } : m)) : ms));
    }).catch(() => {});
    return () => { alive = false; };
  }, [hasOnPhone, roomCode]);

  const leaveCurrent = () => { if (msgRef.current.length) closeStored(roomCode, chatId); };
  const resetTo = (id, born, msgs) => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setChatId(id); setChatBorn(born); setMessages(msgs); setText(''); setOpenThink({}); setSessionDate(null); setView(null);
  };
  const newChat = () => {
    haptic('tap');
    leaveCurrent();
    resetTo(uid(), Date.now(), []);
    setGreeting(makeGreeting());
  };
  const openMenu = () => { haptic('tap'); kb?.close(); setChats(loadChats(roomCode)); setMenu(true); };
  const pickChat = c => {
    if (c.id === chatId) { setView(null); return; }
    if (isEditable(c, Date.now(), chatId)) { leaveCurrent(); resetTo(c.id, c.createdAt, c.messages); } else setView(c);
  };

  /** Tapping an added card (old chats, or after Undo's 5s) → that expense in History. */
  const openInHistory = card => {
    haptic('tap');
    kb?.close();
    onClose?.();
    navigate('/history', { state: { openIds: card.ids || [], date: card.kind === 'bill' ? card.bill.date : card.draft.date } });
  };

  const invite = async () => {
    haptic('tap');
    try {
      if (!(await shareRoom(roomCode, roomName))) {
        await copyToClipboard(getRoomShareUrl(roomCode));
        toast({ message: <b>Invite link copied</b>, top: true, duration: 1800 });
      }
    } catch (e) { if (e?.name !== 'AbortError') toast({ kind: 'error', message: <b>Couldn’t share — try again</b>, top: true }); }
  };

  const errAction = (m, a) => {
    haptic('tap');
    if (m.jobId && billAction(m, a)) return;
    if (a === 'retry' && m.ref) { patchMsg(m.id, x => ({ ...x, resolved: true })); confirm(m.ref, m.mode || 'bill'); return; }
    if (a === 'retry' || a === 'ok' || a === 'type' || a === 'hand') patchMsg(m.id, x => ({ ...x, resolved: true }));
    if (a === 'type') fieldRef.current?.focus();
    else if (a === 'hand') push(null, handCard(m.error.text || '', session()));
  };
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__aaiError = type => pushError(errorReply(type));           // dev only: look at any error reply
    return () => { delete window.__aaiError; };
  });

  // ── bill screenshots (handoff §5; boards 5 / 6 / 7 / 11A) ──
  const fileRef = useRef(null);
  const jobs = useRef({});                                   // jobId → { blobs, read, paidBy, splits, names, shop, same, stage, ctl }
  const pickFor = useRef(null);                              // "Add screenshot" on UNCLEAR → those shots join that bill
  const reader = useRef(null);
  const [hint, setHint] = useState(null);
  const [asking, setAsking] = useState(null);                // the bill whose questions are on screen (its names can be renamed)
  const thumbsMade = useRef([]);
  useEffect(() => () => thumbsMade.current.forEach(u => URL.revokeObjectURL(u)), []);
  const loadReader = () => (reader.current ||= import('../../../aai/billRead.js').catch(e => { reader.current = null; throw e; }));
  const learned = useMemo(() => learnPatterns(expenses, categories), [expenses, categories]);
  const busy = () => Object.values(jobs.current).some(j => j.stage === 'reading');
  const asksPayer = !alone;
  const addAi = fields => { const id = uid(); setMessages(ms => [...ms, { id, role: 'ai', steps: [], reply: null, card: null, error: null, chips: null, shown: 0, done: true, ...fields }]); return id; };
  const addMe = fields => setMessages(ms => [...ms, { id: uid(), role: 'me', ...fields }]);

  const typeItems = () => { setHint(TYPE_HINT); setTimeout(() => fieldRef.current?.focus(), 60); };
  const pickBill = () => {
    if (busy()) { haptic('error'); pushError(errorReply('wait')); return; }
    loadReader().then(m => m.warm()).catch(() => {});        // fetch the reader + set up App Check while the picker is open
    pickFor.current = null;
    fileRef.current?.click();
  };
  const onFiles = e => {
    const files = [...(e.target.files || [])].filter(f => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name));
    e.target.value = '';
    if (!files.length) return;
    if (files.length > MAX_SHOTS) toast({ message: <b>Up to {MAX_SHOTS} screenshots per bill — I took the first {MAX_SHOTS}</b>, top: true, duration: 2600 });
    startBill(files.slice(0, MAX_SHOTS), { addTo: pickFor.current });
    pickFor.current = null;
  };

  /** New screenshots → my message with thumbnails → consent (once per phone) → reading. */
  const startBill = (blobs, { addTo = null, quiet = false } = {}) => {
    haptic('tap');
    const thumbs = blobs.map(b => { const u = URL.createObjectURL(b); thumbsMade.current.push(u); return u; });
    let job = addTo && jobs.current[addTo];
    if (job) { job.blobs = [...job.blobs, ...blobs].slice(0, MAX_SHOTS); job.unclearOk = false; }
    else { job = { id: uid(), blobs, splits: {}, names: {}, paidBy: alone ? meId : null, stage: 'new' }; jobs.current[job.id] = job; }
    if (!quiet) addMe({ shots: blobs.length, thumbs, jobId: job.id });
    if (!rd(K_CONSENT, false)) {
      addAi({ jobId: job.id, reply: 'Before I read this — bills are read by **Aryan AI** and **not stored**. The screenshot is dropped right after.', ask: { kind: 'consent' } });
      return;
    }
    beginRead(job);
  };

  const closeAsk = (id, extra = {}) => patchMsg(id, m => ({ ...m, ask: { ...m.ask, answered: true, ...extra } }));
  const dropPayerAsk = job => { if (job.payerMsg && job.paidBy == null) closeAsk(job.payerMsg, { cancelled: true }); job.payerMsg = null; };
  const finishSteps = (id, steps) => {
    const instant = reduced();
    patchMsg(id, m => ({ ...m, steps, shown: instant ? steps.length : 1, done: instant, live: false }));
    if (instant) return;
    steps.forEach((_, i) => i > 0 && timers.current.push(setTimeout(() => patchMsg(id, m => ({ ...m, shown: i + 1 })), STEP_MS * i)));
    timers.current.push(setTimeout(() => patchMsg(id, m => ({ ...m, done: true })), STEP_MS * steps.length));
  };

  const beginRead = async job => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { queueFor(job, 'offline'); return; }
    job.stage = 'reading';
    const ask = asksPayer && job.paidBy == null;
    const readId = addAi({ jobId: job.id, steps: [{ text: 'reading screenshot… whoever picked this font owes me ₹10.' }], shown: 0, done: false, live: true,
      reply: ask && !job.payerMsg ? 'Reading it now. Quick one while I finish —' : null });
    if (ask && !job.payerMsg) { job.payerMsg = addAi({ jobId: job.id, reply: 'Who paid?', ask: { kind: 'payer' } }); setPaused(false); }
    job.ctl = new AbortController();
    job.slowMsg = null;
    const slow = setTimeout(() => { job.slowMsg = addAi({ jobId: job.id, error: errorReply('slow') }); }, SLOW_MS);
    const unslow = () => { clearTimeout(slow); if (job.slowMsg) patchMsg(job.slowMsg, m => ({ ...m, resolved: true })); };
    try {
      const { readBill } = import.meta.env.DEV && window.__aaiMock ? { readBill: mockRead } : await loadReader();
      const read = await readBill(job.blobs, { categories, signal: job.ctl.signal });
      unslow();
      if (job.stage !== 'reading') return;                   // "Type items" while it was reading
      job.read = read;
      job.stage = 'read';
      const steps = readingSteps(read);
      finishSteps(readId, steps);
      timers.current.push(setTimeout(() => afterRead(job), reduced() ? 0 : STEP_MS * steps.length + 120));
    } catch (e) {
      unslow();
      patchMsg(readId, m => ({ ...m, live: false, done: true, reply: null }));
      if (e?.code === 'ABORTED' || job.stage !== 'reading') return;
      console.error('AAI bill read failed', e);
      job.stage = 'error';
      const c = classifyReadError(e, navigator.onLine !== false);
      if (c.type === 'offline' || c.type === 'limit') { queueFor(job, c.type); return; }
      dropPayerAsk(job);
      haptic('error');
      const over = c.retryIn ? { title: 'Too many in a minute', body: `The free reader takes a short breather. Try again in ${c.retryIn}s.` } : {};
      addAi({ jobId: job.id, error: errorReply(c.type, { details: c.details, ...over }) });
    }
  };

  /** Dev only: window.__aaiMock = { raw, ms, error } stands in for Gemini, to walk the flow without spending the free quota. */
  const mockRead = async (blobs, { signal }) => {
    const mk = window.__aaiMock;
    await new Promise((res, rej) => { const t = setTimeout(res, mk.ms ?? 1500); signal?.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { code: 'ABORTED' })); }); });
    if (mk.error) throw mk.error;
    return normaliseRead(mk.raw);
  };

  /** Offline / daily limit → the screenshots wait on the phone; read when back online (limit: tomorrow). */
  const queueFor = (job, reason) => {
    job.stage = 'queued';
    dropPayerAsk(job);
    queueBill({ id: job.id, room: roomCode, blobs: job.blobs, reason, day: localDateStr() });
    haptic('error');
    addAi({ jobId: job.id, error: errorReply(reason) });
  };

  const afterRead = job => {
    const r = job.read;
    if (!r.isBill) { job.stage = 'error'; dropPayerAsk(job); addAi({ jobId: job.id, error: errorReply('notbill') }); return; }
    if (r.unclear.length && !job.unclearOk) {
      job.stage = 'unclear';
      const n = r.unclear.length;
      addAi({ jobId: job.id, error: errorReply('unclear', { title: `Couldn’t read ${n} item${n === 1 ? '' : 's'}`, body: `Part of the screenshot is blurry or cut off. I read the other ${r.items.length - n}.` }) });
      return;
    }
    job.stage = 'asking';
    setAsking(job.id);
    addAi({ jobId: job.id, found: { shop: r.shop, date: r.date, n: r.items.length } });
    if (solo) addAi({ reply: `Nobody else is in **${roomName}** yet, so there's nothing to split.`, chips: [{ id: 'invite', label: 'Invite roommates · share code' }] });
    next(job);
  };

  const next = job => {
    if (job.stage !== 'asking') return;
    if (asksPayer && job.paidBy == null) return;             // the "Who paid?" answer comes first
    showCard(job);
  };

  const showCard = job => {
    job.stage = 'card';
    setAsking(null);
    const { bill, dots } = billFromRead(job.read, { users, me: meId, isPersonal: alone, categories, learned, today, uid },
      { paidBy: job.paidBy, splits: job.splits, names: job.names, shop: job.shop });
    const mm = billMismatch(bill);
    const n = bill.items.filter(i => !i.charges).length;
    const inr = v => `₹${Math.abs(v).toLocaleString('en-IN')}`;
    const reply = mm.failed.length
      ? `Done. ${n} items — I couldn't read ${mm.failed.map(x => `**#${x}**`).join(', ')}${mm.diff > 0 ? `, so ${inr(mm.diff)} is missing` : ''}. Tap it to fix.`
      : mm.off
        ? `Done. ${n} items, but they come to ${inr(mm.sum)} and the bill says ${inr(bill.total)}. Tap **FIX** to sort it.`
        : alone ? `Done. ${n} items, ${inr(bill.total)}. Check it, then save.` : `Done. ${n} items, ${inr(bill.total)}. Tick each item's split (pre-filled with everyone), then save.`;
    addAi({ jobId: job.id, reply, card: { kind: 'bill', bill, dots: session().firstCard ? ['all'] : dots } });
    job.blobs = null;                                        // the screenshots are dropped now
  };

  const answerConsent = (m, a) => {
    closeAsk(m.id);
    addMe({ text: a === 'ok' ? 'OK, read it' : 'Type items', ans: true });
    const job = jobs.current[m.jobId];
    if (a === 'ok') { wr(K_CONSENT, true); if (job) beginRead(job); }
    else { if (job) { job.stage = 'typed'; job.blobs = null; } typeItems(); }
  };
  const answerPayer = (m, id) => {
    const job = jobs.current[m.jobId];
    if (!job) return;
    job.paidBy = id;
    closeAsk(m.id);
    setPaused(false);
    addMe({ text: id === meId ? 'You paid' : `${cleanName(users.find(u => u.id === id)?.name)} paid`, payer: id, ans: true });
    next(job);
  };
  /** Error buttons for a bill (true = handled here). */
  const billAction = (m, a) => {
    const job = jobs.current[m.jobId];
    patchMsg(m.id, x => ({ ...x, resolved: true }));
    if (a === 'ok' || a === 'wait') return true;             // OK · SLOW "Keep waiting"
    if (a === 'type') {
      if (job) { job.stage = 'typed'; job.ctl?.abort(); dropPayerAsk(job); unqueueBill(job.id); job.blobs = null; }
      typeItems();
      return true;
    }
    if (a === 'fix' && job?.read) { job.unclearOk = true; afterRead(job); return true; }
    if (a === 'add') {
      if (busy()) { pushError(errorReply('wait')); return true; }
      loadReader().catch(() => {});
      pickFor.current = m.error?.type === 'unclear' && job?.blobs ? job.id : null;
      fileRef.current?.click();
      return true;
    }
    if (a === 'retry') {
      if (busy()) pushError(errorReply('wait'));
      else if (job?.blobs) beginRead(job);
      else { pickFor.current = null; fileRef.current?.click(); }   // an old chat: the screenshots are gone
      return true;
    }
    return false;
  };

  // queued bills: read them once the chat is open and online (a LIMIT one from the next day)
  const flow = useRef({});
  useEffect(() => { flow.current = { startBill, busy, addAi, loadReader, categories }; });
  useEffect(() => {
    let alive = true;
    const go = async () => {
      if (!alive || navigator.onLine === false || flow.current.busy()) return;
      const e = readyToRead(await queuedBills(roomCode), localDateStr());
      if (!e || !alive) return;
      await unqueueBill(e.id);
      setMessages(ms => ms.map(m => (m.jobId === e.id && m.error && !m.resolved ? { ...m, resolved: true } : m)));
      flow.current.addAi({ reply: e.reason === 'limit' ? 'New day, new limit — reading the bill you saved for today.' : 'Back online — reading the bill you queued.' });
      flow.current.startBill(e.blobs, { quiet: true });
    };
    const t = setTimeout(go, 1600);
    window.addEventListener('online', go);
    return () => { alive = false; clearTimeout(t); window.removeEventListener('online', go); };
  }, [roomCode]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    // dev only: run sample bills from the project folder through the real flow / the raw reader
    const get = paths => Promise.all(paths.map(p => fetch(p).then(r => r.blob())));
    window.__aaiBill = async paths => flow.current.startBill(await get(paths));
    window.__aaiReadRaw = async paths => {
      const { readBill } = await flow.current.loadReader();
      const blobs = await get(paths);
      const t0 = performance.now();
      const read = await readBill(blobs, { categories: flow.current.categories });
      return { ms: Math.round(performance.now() - t0), read };
    };
    return () => { delete window.__aaiBill; delete window.__aaiReadRaw; };
  }, []);

  /** One AAI bill question (consent / who paid / split) — live only while its bill is still in progress. */
  const renderAsk = m => {
    const live = !ro && !m.ask.answered;
    if (m.ask.kind === 'consent') return <ConsentAsk key="ask" live={live} onAnswer={a => answerConsent(m, a)} />;
    if (m.ask.kind === 'payer') return <PayerAsk key="ask" members={members} meId={meId} live={live} paused={paused} onAnswer={id => answerPayer(m, id)} />;
    return null;                                              // (old chats had one split question per item — nothing to show any more)
  };
  /** "Your Blinkit bill from 2 Oct — 9 items." — fetched names dotted; tap the shop for the keypad on it. */
  const renderFound = m => {
    const f = m.found;
    const editable = !ro && asking === m.jobId;
    return (
      <Fragment key="found">
        <div className="ch-say">
          Your <FetchedName value={f.shop} fallback="untitled" editable={editable} label="Rename the shop" onRename={v => { const j = jobs.current[m.jobId]; if (j) j.shop = v; patchMsg(m.id, x => ({ ...x, found: { ...x.found, shop: v } })); }} /> bill
          {f.date ? <> from <b className="ch-ed">{shortDate(f.date)}</b></> : null} — {f.n} item{f.n === 1 ? '' : 's'}.
          {alone ? ' No questions needed, it’s all yours.' : ' Quick ones while I put it together —'}
        </div>
        {editable && !alone && <div className="ch-mono ch-hint">✎ tap a name to fix it</div>}
      </Fragment>
    );
  };

  // keep the newest thing in view
  const ro = !!view;
  const shownMessages = view ? view.messages : messages;
  const last = shownMessages[shownMessages.length - 1];
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' });
  }, [shownMessages.length, last?.shown, last?.done, last?.card?.status, view?.id]);

  const empty = messages.length === 0 && !view;
  const [paused, setPaused] = useState(false);               // touching the chat pauses Who paid's 4s ring
  const [focused, setFocused] = useState(false);           // the composer has the phone keyboard
  const cardProps = { members, categories, meId, isPersonal: alone, roomName, now, readOnly: ro };
  const heat = { members: heatMembers, opens, stats, now, line, onPickDay: d => { haptic('choose'); pickSessionDate(d); fieldRef.current?.focus(); } };

  return createPortal(
    <div className={`ch ${closing ? 'is-out' : ''} ${phase === 'ready' ? 'is-ready' : ''}`} role="dialog" aria-modal="true" aria-label="Aryan AI">
      <div className="ch-glow ch-glow--v" aria-hidden="true" />
      <div className="ch-glow ch-glow--t" aria-hidden="true" />
      <Header onMenu={openMenu} onNew={newChat} onClose={close} canNew={!empty} />

      <div className="ch-scroll" ref={scroller} onPointerDown={e => { if (!e.target.closest('.ch-og')) setPaused(true); }}>
        {empty ? (
          <EmptyState greeting={greeting} compact={focused} heat={heat} />
        ) : (
          <div className="ch-body">
            {shownMessages.map(m => (m.role === 'me' ? (
              m.shots ? <Shots key={m.id} thumbs={m.thumbs} count={m.shots} />
                : <div key={m.id} className={`ch-me ${m.payer || m.ans ? 'ch-me--ans' : ''}`}>{m.payer && members.find(x => x.id === m.payer) ? <Mg m={members.find(x => x.id === m.payer)} /> : null}{m.text}</div>
            ) : (
              <div key={m.id} className="ch-ai">
                <Av />
                <div className="ch-ai__c">
                  <Thinking steps={m.steps} shown={m.shown} done={m.done} open={!!openThink[m.id]} onToggle={() => setOpenThink(o => ({ ...o, [m.id]: !o[m.id] }))} />
                  {(m.done || m.live) && m.reply && <Say text={m.reply} />}
                  {m.found && renderFound(m)}
                  {m.ask && renderAsk(m)}
                  {m.done && m.chips && !ro && m.chips.map(c => <button key={c.id} type="button" className="ch-chipbtn" onClick={invite}>{c.label}</button>)}
                  {m.done && m.error && <ErrorReply err={m.error} resolved={m.resolved} readOnly={ro} onAction={a => errAction(m, a)} />}
                  {m.done && m.card && (m.card.kind === 'quick'
                    ? <QuickCard key={m.id} card={m.card} {...cardProps} onOpen={() => openInHistory(m.card)} onChange={c => patchCard(m.id, () => c)} onConfirm={() => confirm(m.id)} onUndo={() => undo(m.id)} />
                    : <BillCard key={m.id} card={m.card} {...cardProps} onOpen={() => openInHistory(m.card)} onChange={c => patchCard(m.id, () => c)} onConfirm={() => confirm(m.id)} onSeparate={() => confirm(m.id, 'separate')} onUndo={() => undo(m.id)} />)}
                </div>
              </div>
            )))}
          </div>
        )}
      </div>

      <div className="ch-dock">
        <input ref={fileRef} className="ch-file" type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" onChange={onFiles} />
        {empty && focused && <FocusRows bills={bills} usuals={usuals} isPersonal={alone} onBill={sendBillAgain} onUsual={sendUsual} />}
        {sessionDate && (
          <div className="ch-datepill" data-kb>
            <span>Adding for {fromDateStr(sessionDate).getDate()} {MONTH_NAMES[fromDateStr(sessionDate).getMonth()]}</span>
            <button type="button" aria-label="Back to today" onClick={() => { haptic('tap'); setSessionDate(null); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        {ro ? (
          <div className="ch-ro">
            <div className="ch-mono ch-ro__t">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              READ ONLY · CLOSED {new Date(view.closedAt ?? view.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="ch-ro__b">
              {messages.length > 0 && <button type="button" className="ch-btn ch-btn--ghost" onClick={() => { haptic('tap'); setView(null); }}>Back to current chat</button>}
              <button type="button" className="ch-btn ch-grad" onClick={newChat}>New chat</button>
            </div>
          </div>
        ) : (
          <Composer text={text} setText={setText} onSend={send} fieldRef={fieldRef} hint={hint} onBill={pickBill} onFocusChange={setFocused} />
        )}
      </div>

      {menu && <PastChats chats={chats} openId={chatId} current={view ? view.id : chatId} onPick={pickChat} onNew={newChat} onClose={() => setMenu(false)} />}

      {!loaderGone && <ChatLoader out={phase === 'ready'} onSkip={() => { haptic('tap'); setSkipped(true); }} />}
    </div>,
    document.body,
  );
}
