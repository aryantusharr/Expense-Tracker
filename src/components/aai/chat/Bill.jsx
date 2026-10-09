import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../../utils/haptics';
import { cleanName } from '../../../aai/common.js';
import { Mg } from './parts';
import { TextEdit } from './Cards';

/**
 * Bill screenshots in the chat: thumbnails in my message, the consent reply and "Who paid?" (4s ring, You pre-picked).
 * Who splits what is NOT asked here — every item starts as All N and is confirmed with its tick on the bill card.
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

export const RING_MS = 4000;

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

/** The ring that runs around the pre-picked chip; it empties in 4s. */
function Ring({ paused }) {
  return (
    <svg className={`ch-ring ${paused ? 'is-paused' : ''}`} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="98" height="38" rx="12" fill="none" pathLength="151" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 4s countdown → onFire. Stops while paused (she touched the chat) or when not live. Returns seconds left. */
function useCountdown({ live, paused, onFire }) {
  const [left, setLeft] = useState(RING_MS);
  const fire = useRef(onFire);
  useEffect(() => { fire.current = onFire; });
  useEffect(() => {
    const start = Date.now();
    const t0 = setTimeout(() => setLeft(RING_MS), 0);
    if (!live || paused) return () => clearTimeout(t0);
    const iv = setInterval(() => setLeft(Math.max(0, RING_MS - (Date.now() - start))), 250);
    const t = setTimeout(() => fire.current(), RING_MS);
    return () => { clearTimeout(t0); clearInterval(iv); clearTimeout(t); };
  }, [live, paused]);
  return Math.ceil(left / 1000);
}

/** "Who paid?" — You first, pre-picked with the 4s ring (it answers by itself); a tap answers sooner. */
export function PayerAsk({ members, meId, live, paused, onAnswer }) {
  const list = ordered(members, meId);
  const pre = meId || list[0]?.id;
  const secs = useCountdown({ live, paused, onFire: () => onAnswer(pre, true) });
  if (!live) return null;
  return (
    <div className="ch-og" style={cols(list.length)} role="group" aria-label="Who paid">
      {list.map(m => (
        <button key={m.id} type="button" className={`ch-pchip ${m.id === pre ? 'on' : ''}`} aria-pressed={m.id === pre} onClick={() => { haptic('choose'); onAnswer(m.id); }}>
          <Mg m={m} /><span>{nameOf(m, meId)}</span>
          {m.id === pre && <><Ring paused={paused} /><span className="ch-mono ch-ring__s">{paused ? '' : `${secs}s`}</span></>}
        </button>
      ))}
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
