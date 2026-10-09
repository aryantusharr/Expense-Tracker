import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../../utils/haptics';
import { cleanName, fmtINR } from '../../../aai/common.js';
import { Mg } from './parts';
import { TextEdit } from './Cards';

/**
 * Bill screenshots in the chat (boards AAI-Chat-5 / -11A): thumbnails in my message, the consent reply,
 * "Who paid?" and one "split with?" per item — both with a 3s ring that auto-picks (touching the chat pauses it) —
 * and the one-time warn toast for "Same for the rest".
 */

export const RING_MS = 3000;

/** My message: the screenshots as thumbnails (blob URLs while the chat is open; grey slips once the chat is stored). */
export function Shots({ thumbs, count }) {
  const n = thumbs?.length || count || 1;
  return (
    <div className="ch-shots" aria-label={`${n} bill screenshot${n === 1 ? '' : 's'}`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="ch-shot">
          {thumbs?.[i] ? <img src={thumbs[i]} alt="" /> : Array.from({ length: 6 }, (_, k) => <i key={k} />)}
        </span>
      ))}
    </div>
  );
}

/** The ring that runs around a pre-picked chip; it empties in 3s. */
function Ring({ paused, k }) {
  return (
    <svg key={k} className={`ch-ring ${paused ? 'is-paused' : ''}`} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="98" height="38" rx="12" fill="none" pathLength="151" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 3s countdown → onFire. Restarts when `k` changes; stops while paused or when not live. Returns seconds left. */
function useCountdown({ live, paused, k, onFire }) {
  const [left, setLeft] = useState(RING_MS);
  const fire = useRef(onFire);
  useEffect(() => { fire.current = onFire; });
  useEffect(() => {
    const start = Date.now();
    const tick = () => setLeft(Math.max(0, RING_MS - (Date.now() - start)));
    const t0 = setTimeout(() => setLeft(RING_MS), 0);
    if (!live || paused) return () => clearTimeout(t0);
    const iv = setInterval(tick, 250);
    const t = setTimeout(() => fire.current(), RING_MS);
    return () => { clearTimeout(t0); clearInterval(iv); clearTimeout(t); };
  }, [live, paused, k]);
  return Math.ceil(left / 1000);
}

const ordered = (members, meId) => [...members].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0));
const nameOf = (m, meId) => (m.id === meId ? 'You' : cleanName(m.name));
const cols = n => ({ gridTemplateColumns: `repeat(${Math.min(n, 4)}, 1fr)` });

/** Consent, once per phone (11A). */
export function ConsentAsk({ live, onAnswer }) {
  if (!live) return null;
  return (
    <div className="ch-og" style={cols(2)}>
      <button type="button" className="ch-pchip on" onClick={() => { haptic('choose'); onAnswer('ok'); }}>OK, read it</button>
      <button type="button" className="ch-pchip" onClick={() => { haptic('tap'); onAnswer('type'); }}>Type items</button>
    </div>
  );
}

/** "Who paid?" — You first with the 3s ring; one tap answers. */
export function PayerAsk({ members, meId, live, paused, onAnswer }) {
  const list = ordered(members, meId);
  const pre = meId || list[0]?.id;
  const secs = useCountdown({ live, paused, k: 0, onFire: () => onAnswer(pre, true) });
  if (!live) return null;
  return (
    <div className="ch-og" style={cols(list.length)} role="group" aria-label="Who paid">
      {list.map(m => (
        <button key={m.id} type="button" className={`ch-pchip ${m.id === pre ? 'on' : ''}`} aria-pressed={m.id === pre} onClick={() => { haptic('choose'); onAnswer(m.id); }}>
          <Mg m={m} /><span>{nameOf(m, meId)}</span>
          {m.id === pre && <><Ring paused={paused} k={0} /><span className="ch-mono ch-ring__s">{paused ? '' : `${secs}s`}</span></>}
        </button>
      ))}
    </div>
  );
}

/**
 * "<item> · ₹40 — split with?" — pre-picked = the previous answer (first: All). All N answers at once; a name toggles
 * and restarts the ring; "Same for the rest" (every item, until used) → warn toast. Paused → a "Next" chip appears.
 */
export function SplitAsk({ ask, members, meId, live, paused, onAnswer, onSame, onResume }) {
  const all = members.map(m => m.id);
  const [sel, setSel] = useState(ask.picked?.length ? ask.picked : all);
  const [k, setK] = useState(0);
  const secs = useCountdown({ live, paused, k, onFire: () => onAnswer(sel, true) });
  if (!live) return null;
  const allOn = sel.length === all.length;
  const toggle = id => {
    haptic('choose');
    setSel(s => (s.includes(id) ? (s.length > 1 ? s.filter(x => x !== id) : s) : all.filter(x => x === id || s.includes(x))));
    setK(n => n + 1);
    onResume();
  };
  const ring = on => on && <><Ring paused={paused} k={k} />{!paused && <span className="ch-mono ch-ring__s">{secs}s</span>}</>;
  return (
    <div className="ch-og" style={cols(members.length + 1)} role="group" aria-label={`Who splits ${ask.name || 'this item'}`}>
      <button type="button" className={`ch-pchip ${allOn ? 'on' : ''}`} aria-pressed={allOn} onClick={() => { haptic('choose'); onAnswer(all); }}>
        All {all.length}{ring(allOn)}
      </button>
      {ordered(members, meId).map(m => {
        const on = !allOn && sel.includes(m.id);
        return (
          <button key={m.id} type="button" className={`ch-pchip ${on ? 'on' : ''}`} aria-pressed={sel.includes(m.id)} onClick={() => toggle(m.id)}>
            <Mg m={m} dim={!sel.includes(m.id)} /><span>{nameOf(m, meId)}</span>{ring(on && sel[sel.length - 1] === m.id)}
          </button>
        );
      })}
      <div className="ch-og__wide" style={{ gridColumn: '1 / -1' }}>
        <button type="button" className="ch-pchip ch-pchip--wide" onClick={() => { haptic('tap'); onSame(sel); }}>Same for the rest</button>
        {paused && <button type="button" className="ch-pchip ch-pchip--next" onClick={() => { haptic('choose'); onAnswer(sel); }}>Next ›</button>}
      </div>
    </div>
  );
}

/** A fetched name in a reply: plain text with a dotted underline; tap → keypad on that word. */
export function FetchedName({ value, fallback, editable, onRename, label }) {
  const [on, setOn] = useState(false);
  const [v, setV] = useState(value);
  if (!editable) return <b className="ch-fetched">{value || fallback}</b>;
  if (on) {
    return <TextEdit value={v} onChange={setV} onClose={() => { setOn(false); if (v.trim() && v.trim() !== value) onRename(v.trim()); else setV(value); }} label={label} caps="words" className="ch-inl--fetched" />;
  }
  return <button type="button" className="ch-fetched ch-ed" aria-label={label} onClick={() => { haptic('tap'); setOn(true); }}>{value || fallback}</button>;
}

/** "Same for the rest" — the one-time warn toast (app's warn style, role=alertdialog). */
export function SameWarn({ label, count, onApply, onCancel }) {
  const [never, setNever] = useState(false);
  return (
    <div className="ch-warn" role="alertdialog" aria-labelledby="chWarnM" aria-describedby="chWarnS">
      <div className="ch-warn__top">
        <span className="ch-warn__ic" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></svg>
        </span>
        <div className="ch-warn__t">
          <span id="chWarnM"><b>{label}</b> will apply to all <b>{count} remaining</b> item{count === 1 ? '' : 's'}</span>
          <span id="chWarnS" className="ch-warn__s">You can still change any item on the bill card</span>
        </div>
      </div>
      <div className="ch-warn__b">
        <label className="ch-warn__chk"><input type="checkbox" checked={never} onChange={e => setNever(e.target.checked)} /> Don’t ask me again</label>
        <button type="button" className="ch-warn__x" onClick={() => { haptic('tap'); onCancel(); }}>Cancel</button>
        <button type="button" className="ch-warn__ok" autoFocus onClick={() => { haptic('choose'); onApply(never); }}>Apply</button>
      </div>
    </div>
  );
}

/** "Potato 1 kg · ₹40 — split with?" */
export function ItemLine({ ask, editable, onRename }) {
  return (
    <>
      <FetchedName value={ask.name} fallback={`Item ${ask.index + 1}`} editable={editable} onRename={onRename} label={`Rename item ${ask.index + 1}`} />
      {ask.qty ? <span className="ch-mono ch-qty"> {ask.qty}</span> : null} · {ask.amount == null ? '₹—' : fmtINR(ask.amount)} — split with?
    </>
  );
}
