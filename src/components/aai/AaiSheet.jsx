import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext } from '../../context/RoomContext';
import { haptic } from '../../utils/haptics';
import { TextField, useKeyboard } from '../ui/Keyboard';
import { useToast } from '../ui/Toast';
import { memberStyle, localDateStr } from '../dashboard/dashboardData';
import { parse } from '../../aai/parse.js';
import { buildChips, hiddenIds, hideChip } from '../../aai/chips.js';
import { cleanName, fmtINR } from '../../aai/common.js';
import { remindPlan } from '../../aai/commands.js';
import SaveMoment from '../add/SaveMoment';
import { saveExpense, saveMany, saveBill, runPlan, shareOut } from './aaiSave';
import { BigBuddy } from './Buddy';
import AaiChips from './AaiChips';
import { ExpenseCard, ManyCard, BillCard, Card } from './AnswerCard';
import { commandCard } from './cardModel';
import { canInstall, onInstallable, promptInstall } from './installPrompt';
import './Aai.css';

/**
 * AAI sheet (boards Bot-Sheet-Final / -Personal / -Light): ✕ only, big buddy says hi from the printer slot,
 * one Bill screenshot tile (no payment tile — her decision 3 Oct), the paper AAI field (keyboard with a
 * 1–0 digit row, Done = Ask), suggestion chips above the keyboard, and the answer card that builds live.
 */

const CLOSE_MS = 200;
const PARSE_DELAY = 150;          // card rises 150ms after the last key (board T2)
const K_DRAFT = 'splitease_aai_draft';
const K_CHIPS = 'splitease_aai_chips';
const K_LAST = 'splitease_aai_last';

const read = (k, fb = null) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const LINES = {
  shared: ['Kya add karein?', 'Try "chai 40, auto 120"', 'Ask "kitna dena hai?"'],
  personal: ['Kya track karein?', 'Try "250 movie"', 'Ask "food this month"'],
};

function useDelayed(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function draftFrom(intent, sessionDate) {
  if (intent.type === 'unknown') return { amount: 0, description: intent.description || intent.text, categoryId: null, date: sessionDate || localDateStr(), paidBy: null, splitAmong: [] };
  return {
    amount: intent.amount, description: intent.description, categoryId: intent.categoryId,
    date: !intent.dateGiven && sessionDate ? sessionDate : intent.date, dateGiven: intent.dateGiven,
    paidBy: intent.paidBy, splitAmong: intent.splitAmong,
  };
}

export default function AaiSheet({ onClose }) {
  const { room, roomCode, expenses, users, categories, userIdentity } = useRoomContext();
  const kb = useKeyboard();
  const toast = useToast();
  const isPersonal = room?.isPersonal === true;
  const members = useMemo(() => users.map((u, i) => ({ ...u, ...memberStyle(i) })), [users]);
  const meId = userIdentity && users.some(u => u.id === userIdentity) ? userIdentity : (isPersonal ? users[0]?.id ?? null : null);
  const me = users.find(u => u.id === meId);

  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    haptic('tap');
    kb?.close();
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };

  // Draft text survives closing the sheet; the "Adding for" date does not (resets on close).
  const [text, setText] = useState(() => read(K_DRAFT, '') || '');
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => () => write(K_DRAFT, textRef.current.trim() ? textRef.current : null), []);
  const [sessionDate, setSessionDate] = useState(null);
  const today = localDateStr();
  const pickSessionDate = d => setSessionDate(d && d !== today ? d : null);

  // Page doesn't scroll behind; Escape closes.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape' && !kb?.active) close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  });

  // Rotating bubble line (≤24 chars).
  const lines = LINES[isPersonal ? 'personal' : 'shared'];
  const [li, setLi] = useState(0);
  useEffect(() => { const t = setInterval(() => setLi(i => (i + 1) % lines.length), 4200); return () => clearInterval(t); }, [lines.length]);

  // Parse 150ms after the last key.
  const settled = useDelayed(text, PARSE_DELAY);
  const now = useMemo(() => new Date(), [settled]); // eslint-disable-line react-hooks/exhaustive-deps
  const intent = useMemo(
    () => parse(settled, { users, me: meId, categories, expenses, isPersonal, now }),
    [settled, users, meId, categories, expenses, isPersonal, now],
  );

  // Expense draft = parsed intent + whatever the user changed in the card (reset when the sentence changes).
  const [edit, setEdit] = useState({ for: null, draft: null });
  const baseDraft = useMemo(() => (intent.type === 'expense' || intent.type === 'unknown' ? draftFrom(intent, sessionDate) : null), [intent, sessionDate]);
  const draft = edit.for === settled && edit.draft ? edit.draft : baseDraft;
  const changeDraft = d => {
    if (d.date !== draft?.date) pickSessionDate(d.date);
    setEdit({ for: settled, draft: d });
  };
  const [asBill, setAsBill] = useState(false);

  // Chips (only when no card is showing).
  const [hiddenStore, setHiddenStore] = useState(() => read(K_CHIPS, null));
  const [installable, setInstallable] = useState(canInstall);
  useEffect(() => onInstallable(setInstallable), []);
  const chips = useMemo(() => buildChips({
    now: new Date(), expenses, users, me: meId, categories, isPersonal,
    lastAai: read(K_LAST, null), hidden: hiddenIds(hiddenStore, new Date()), installable,
  }), [expenses, users, meId, categories, isPersonal, hiddenStore, installable]);
  const hide = c => { const next = hideChip(hiddenStore, c.id, new Date()); write(K_CHIPS, next); setHiddenStore(next); };
  const fieldRef = useRef(null);
  const pickChip = async c => {
    const a = c.action || {};
    const say = t => { setText(t); fieldRef.current?.focus(); };
    if (a.kind === 'install') { hide(c); await promptInstall(); return; }
    if (a.kind === 'focus') { fieldRef.current?.focus(); return; }
    if (a.kind === 'text') { say(a.text); return; }
    if (a.kind === 'undo') { say('undo'); return; }
    if (a.kind === 'settle') { say('settle all'); return; }
    if (a.kind === 'remind') { const u = users.find(x => x.id === a.personId); say(`remind ${cleanName(u?.name || '').toLowerCase()}`); return; }
    if (a.kind === 'repeat') {
      const e = expenses.find(x => x.id === a.expenseId);
      if (e) say(`${e.amount} ${e.description}`.toLowerCase());
      return;
    }
    if (a.kind === 'expense' && a.draft) { say(`${a.draft.amount} ${a.draft.description}`.toLowerCase()); return; }
    if (a.kind === 'duplicate') {
      const keep = expenses.find(x => x.id === a.keep); const dup = expenses.find(x => x.id === a.remove);
      if (keep && dup) setChipCard({ kind: 'duplicate', keep, dup });
      return;
    }
    if (a.kind === 'repeat-bill') {
      const lines = expenses.filter(x => x.groupId === a.groupId);
      if (lines.length) setChipCard({ kind: 'repeat-bill', lines });
      return;
    }
    toast({ message: 'Bill queue arrives with bill reading', top: true, duration: 1800 });
  };

  // ── Saving ──
  const ctx = { roomCode, room, expenses, users, categories, meId, isPersonal };
  const [busy, setBusy] = useState(false);
  const [moment, setMoment] = useState(null);     // SaveMoment props while the receipt prints
  const after = useRef(null);                     // toast shown once the receipt has landed
  const [chipCard, setChipCard] = useState(null); // duplicate / repeat-bill chip card (no typing)

  const fail = e => { console.error(e); toast({ kind: 'error', message: <b>{e?.message || 'Couldn’t save — try again'}</b>, top: true }); };
  const successToast = ({ message, sub, share }) => ({
    top: true, kind: 'aai', duration: 5000, bar: 5000, message: <b>{message}</b>, sub: sub || undefined,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
    action: share ? { label: 'Share', onClick: () => shareOut(share) } : undefined,
  });
  const clearEntry = () => { setText(''); setEdit({ for: null, draft: null }); setAsBill(false); setChipCard(null); };
  const done = () => {
    setMoment(null);
    clearEntry();
    if (after.current) { toast(after.current); after.current = null; }
    setTimeout(() => fieldRef.current?.focus(), 120);
  };
  const needsPayer = list => !isPersonal && list.some(x => !x.paidBy);

  const confirm = async payload => {
    if (busy || moment) return;
    setBusy(true);
    try {
      if (payload.type === 'action') {
        const a = payload.action;
        if (a.kind === 'remind') {
          const p = remindPlan(expenses, users, meId, a.personId, room?.name);
          if (p.ok) await shareOut(p.text);
        } else if (a.kind === 'whatsapp') {
          await shareOut(a.text);
        } else if (a.kind === 'run') {
          const r = await runPlan(ctx, a.plan);
          if (a.plan.action === 'delete') write(K_LAST, null);
          haptic('success');
          toast(successToast(r.toast));
          clearEntry();
        }
        return;
      }
      let res;
      if (payload.type === 'expense') {
        res = await saveExpense(ctx, payload.draft);
        if (payload.draft.dateGiven) pickSessionDate(payload.draft.date);
      } else if (payload.type === 'many') {
        const it = payload.intent;
        if (needsPayer(it.expenses)) { toast({ kind: 'error', message: <b>Who paid? Pick your name on the Dashboard first</b>, top: true }); return; }
        res = payload.asBill
          ? await saveBill(ctx, { name: 'Bill', date: it.expenses[0].date, paidBy: it.expenses[0].paidBy, items: it.billAlt.lines.map((l, i) => ({ ...l, splitAmong: it.expenses[i].splitAmong })) })
          : await saveMany(ctx, it);
        if (it.expenses[0].dateGiven) pickSessionDate(it.expenses[0].date);
      } else if (payload.type === 'bill') {
        const it = payload.intent;
        const items = it.lines.map(l => ({ ...l, categoryId: l.categoryId || it.categoryId }));
        if (it.rest?.amount > 0) items.push({ description: 'Rest', amount: it.rest.amount, categoryId: it.categoryId, splitAmong: it.rest.splitAmong });
        res = await saveBill(ctx, { name: it.merchant || 'Bill', date: it.date, paidBy: it.paidBy, items });
      } else if (payload.type === 'repeat-bill') {
        res = await saveBill(ctx, payload.bill);
      }
      if (!res) return;
      if (res.ids.length) write(K_LAST, { ids: res.ids, at: Date.now() });
      after.current = successToast(res);
      setMoment(res.moment);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const hasCard = intent.type !== 'empty' || !!chipCard;
  const card = (() => {
    if (chipCard && intent.type === 'empty') {
      if (chipCard.kind === 'duplicate') {
        const { dup } = chipCard;
        return (
          <Card key="dup" title="Possible duplicate" sub={`${dup.description} · same amount twice close together`} value={fmtINR(parseFloat(dup.amount) || 0)} tone="neg"
            actions={[{ label: 'Remove the newer one', primary: true }, { label: 'Keep both' }]}
            onAction={a => (a.primary ? confirm({ type: 'action', action: { kind: 'run', plan: { action: 'delete', ids: [dup.id], summary: `${dup.description} · ${fmtINR(parseFloat(dup.amount) || 0)}` } } }) : setChipCard(null))} />
        );
      }
      const g = chipCard.lines; const f = g[0];
      const total = g.reduce((t, x) => t + (parseFloat(x.amount) || 0), 0);
      return (
        <Card key="rb" title={f.groupName || 'Bill'} sub={`${g.length} items · paid by ${f.paidBy === meId ? 'you' : cleanName(users.find(u => u.id === f.paidBy)?.name || '')} · dated today`} value={fmtINR(total)}
          actions={[{ label: 'Add again', primary: true }]}
          onAction={() => confirm({ type: 'repeat-bill', bill: { name: f.groupName || 'Bill', date: sessionDate || today, paidBy: f.paidBy, items: g.map(x => ({ description: x.description, amount: parseFloat(x.amount) || 0, categoryId: x.categoryId, splitAmong: x.splitAmong })) } })}>
          <div className="aai-lines">{g.map(x => <span key={x.id}><b>{x.description}</b>{fmtINR(parseFloat(x.amount) || 0)}</span>)}</div>
        </Card>
      );
    }
    switch (intent.type) {
      case 'expense':
      case 'unknown':
        return (
          <ExpenseCard key="exp" draft={draft} onChange={changeDraft} members={members} categories={categories} meId={meId}
            isPersonal={isPersonal} question={intent.questions?.[0] || (intent.needsIdentity ? { kind: 'pickPerson', message: 'Who paid? Tap to pick' } : null)}
            onConfirm={d => confirm({ type: 'expense', draft: d })} />
        );
      case 'many':
        return <ManyCard key="many" intent={intent} asBill={asBill} onToggle={() => setAsBill(b => !b)} onConfirm={() => confirm({ type: 'many', intent, asBill })} />;
      case 'bill':
        return <BillCard key="bill" intent={intent} members={members} meId={meId} onConfirm={() => confirm({ type: 'bill', intent })} />;
      case 'command': {
        const m = commandCard(intent, { expenses, users, meId, categories, isPersonal, now, roomName: room?.name, roomCode, lastAai: read(K_LAST, null) });
        return m && <Card key={`cmd-${intent.cmd}`} {...m} onAction={a => confirm({ type: 'action', action: a, intent })} />;
      }
      default:
        return null;
    }
  })();

  const chipsNode = !hasCard && chips.length ? <AaiChips chips={chips} onPick={pickChip} onHide={hide} /> : null;
  const kbOpen = !!kb?.active;

  return createPortal(
    <>
      <div className={`aai-scrim ${closing ? 'is-out' : ''}`} onClick={close} aria-hidden="true" />
      <div className={`aai-sheet ${closing ? 'is-out' : ''}`} role="dialog" aria-modal="true" aria-label="Aryan AI">
        <button type="button" className="aai-x se-press" aria-label="Close" onClick={close}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <div className="aai-head">
          <BigBuddy />
          <div className="aai-bubble" aria-live="polite">
            Hi {me ? cleanName(me.name) : 'there'}!
            <span key={li} className="aai-bubble__line">{lines[li]}</span>
          </div>
        </div>

        <div className="aai-body">
          <button type="button" className="aai-tile se-press" onClick={() => { haptic('tap'); toast({ message: 'Bill reading arrives in the next update', top: true, duration: 2000 }); }}>
            <span className="aai-tile__ic" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="3" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
            </span>
            <span className="aai-tile__txt"><b>Bill screenshot</b><span>UP TO 4 · ZEPTO, SWIGGY, ANY BILL</span></span>
            <svg className="aai-tile__go" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          {sessionDate && (
            <div className="aai-datepill">
              <span>Adding for {new Date(`${sessionDate}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              <button type="button" aria-label="Back to today" onClick={() => { haptic('tap'); setSessionDate(null); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
              </button>
            </div>
          )}

          <TextField
            value={text} onChange={setText} maxLength={240} caps="none" autoFocus digitRow doneLabel="Ask"
            className="aai-field" placeholder={isPersonal ? 'e.g. 250 movie' : 'e.g. paid 450 dinner with ravi'}
            fieldRef={fieldRef} slotContent={chipsNode} aria-label="Ask AAI or add an expense"
          />

          {card && <div className="aai-answer">{card}</div>}
          {!kbOpen && chipsNode && <AaiChips chips={chips} onPick={pickChip} onHide={hide} inline />}
        </div>
      </div>
      {moment && <SaveMoment {...moment} className="aai-sm" onDone={done} />}
    </>,
    document.body,
  );
}
