import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../../utils/haptics';

const fmtN = n => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Save moment (spec §7): printer slot buzz → stutter print (~3s, 4 stops) → receipt flies away
 * (.85s) → "+1" lands. Tap anywhere to skip to the flight. `onDone` fires when it's over.
 */
export default function SaveMoment({ title, lines, total, date, onDone }) {
  const [phase, setPhase] = useState('print');   // print → fly → plus
  const quick = reduce();
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  useEffect(() => {
    if (phase === 'print') {
      const ticks = quick ? [] : [0, 700, 1400, 2100].map(t => setTimeout(() => haptic('tap'), 500 + t));
      const t = setTimeout(() => setPhase('fly'), quick ? 500 : 3500);
      return () => { ticks.forEach(clearTimeout); clearTimeout(t); };
    }
    if (phase === 'fly') {
      const t = setTimeout(() => { haptic('success'); setPhase('plus'); }, quick ? 200 : 850);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => done.current(), quick ? 400 : 900);
    return () => clearTimeout(t);
  }, [phase, quick]);

  return createPortal(
    <div className="sm" onClick={() => phase === 'print' && setPhase('fly')} role="status" aria-label="Saving receipt">
      <div className="sm-slot" aria-hidden="true"><span /></div>
      <div className={`sm-paper ib-paper ${phase !== 'print' ? 'sm-paper--fly' : 'sm-paper--print'}`}>
        <div className="ib-paper__head"><span className="ib-paper__brand">RECEIPT</span><span>{date}</span></div>
        <div className="ib-rule" />
        <div className="ib-paper__title">{title}</div>
        {lines.map((l, i) => (
          <div className="ib-line" key={i}><span className="ib-item__name">{l.name}</span><i /><b>₹{fmtN(l.amount)}</b></div>
        ))}
        <div className="ib-rule" />
        <div className="ib-line ib-line--total"><span>TOTAL</span><i /><b>₹{fmtN(total)}</b></div>
        <span className="ib-zig" aria-hidden="true" />
      </div>
      <div className="sm-dest" aria-hidden="true">
        {phase === 'plus' && <span className="sm-plus se-pop">+1</span>}
      </div>
    </div>,
    document.body
  );
}
