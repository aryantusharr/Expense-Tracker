import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRoomContext } from '../../context/RoomContext';
import { haptic } from '../../utils/haptics';
import { TextField, useKeyboard } from '../ui/Keyboard';
import { useToast } from '../ui/Toast';
import { memberStyle, localDateStr } from '../dashboard/dashboardData';
import { parse } from '../../aai/parse.js';
import { buildChips, hiddenIds, hideChip } from '../../aai/chips.js';
import { cleanName } from '../../aai/common.js';
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

export default function AaiSheet({ onClose, onConfirm }) {
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
    toast({ message: 'Coming in the next update', top: true, duration: 1800 });   // duplicate / bill queue / repeat bill
  };

  const confirm = payload => {
    if (onConfirm) { onConfirm(payload); return; }
    haptic('choose');
    toast({ message: 'Saving gets wired up in the next step', top: true, duration: 2000 });
  };

  const hasCard = intent.type !== 'empty';
  const card = (() => {
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
    </>,
    document.body,
  );
}
