import { useState } from 'react';
import { haptic } from '../../../utils/haptics';
import { cleanName, fmtINR } from '../../../aai/common.js';
import { Mg } from './parts';
import { TextEdit } from './Cards';

/**
 * Bill screenshots in the chat: thumbnails in my message, the consent reply, "Who paid?" and ONE "Split with?" for the
 * whole bill (every item starts with it; fine-tune per item on the bill card). No timers — a tap answers.
 */

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

/** "Who paid?" — one tap answers. */
export function PayerAsk({ members, meId, live, onAnswer }) {
  const list = ordered(members, meId);
  if (!live) return null;
  return (
    <div className="ch-og" style={cols(list.length)} role="group" aria-label="Who paid">
      {list.map(m => (
        <button key={m.id} type="button" className="ch-pchip" onClick={() => { haptic('choose'); onAnswer(m.id); }}>
          <Mg m={m} /><span>{nameOf(m, meId)}</span>
        </button>
      ))}
    </div>
  );
}

/** "Split with?" — once for the whole bill. Pre-picked = the last answer (first time: All). Names toggle; Next › confirms. */
export function SplitAsk({ ask, members, meId, live, onAnswer }) {
  const all = members.map(m => m.id);
  const [sel, setSel] = useState(ask.picked?.length ? ask.picked : all);
  if (!live) return null;
  const allOn = sel.length === all.length;
  const toggle = id => {
    haptic('choose');
    setSel(s => (s.includes(id) ? (s.length > 1 ? s.filter(x => x !== id) : s) : all.filter(x => x === id || s.includes(x))));
  };
  return (
    <div className="ch-og" style={cols(members.length + 1)} role="group" aria-label="Who splits the bill">
      <button type="button" className={`ch-pchip ${allOn ? 'on' : ''}`} aria-pressed={allOn} onClick={() => { haptic('choose'); setSel(all); }}>All {all.length}</button>
      {ordered(members, meId).map(m => {
        const on = !allOn && sel.includes(m.id);
        return (
          <button key={m.id} type="button" className={`ch-pchip ${on ? 'on' : ''}`} aria-pressed={sel.includes(m.id)} onClick={() => toggle(m.id)}>
            <Mg m={m} dim={!sel.includes(m.id)} /><span>{nameOf(m, meId)}</span>
          </button>
        );
      })}
      <div className="ch-og__wide" style={{ gridColumn: '1 / -1' }}>
        <button type="button" className="ch-pchip ch-pchip--next ch-pchip--full" onClick={() => { haptic('choose'); onAnswer(sel); }}>Next ›</button>
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

/** "Potato 1 kg · ₹40 — split with?" */
export function ItemLine({ ask, editable, onRename }) {
  return (
    <>
      <FetchedName value={ask.name} fallback={`Item ${ask.index + 1}`} editable={editable} onRename={onRename} label={`Rename item ${ask.index + 1}`} />
      {ask.qty ? <span className="ch-mono ch-qty"> {ask.qty}</span> : null} · {ask.amount == null ? '₹—' : fmtINR(ask.amount)} — split with?
    </>
  );
}
