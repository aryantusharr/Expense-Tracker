import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../../utils/haptics';
import FloatingNav from '../layout/FloatingNav';

const fmtN = n => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const prettyDate = d => new Date(`${d}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Save moment (spec §7): printer slot buzz → 4-stop stutter print → receipt flies into the History
 * tab of the nav → nav bounce + History pop + "+1". Tap anywhere during the print to skip to the flight.
 * `onDone` fires when it's over.
 */
export default function SaveMoment({ title, lines, total, date, onDone }) {
  const [phase, setPhase] = useState('print');   // print → fly → plus
  const [fly, setFly] = useState({ dx: 0, dy: 300, x: 0, y: 0 });
  const paper = useRef(null);
  const quick = reduce();
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  // Measure paper → History tab, then fly there.
  const goFly = () => {
    const tab = document.querySelector('.sm .fnav__tab:nth-child(2)')?.getBoundingClientRect();
    const box = paper.current?.getBoundingClientRect();
    if (tab && box) {
      const tx = tab.left + tab.width / 2, ty = tab.top + tab.height / 2;
      setFly({ dx: tx - (box.left + box.width / 2), dy: ty - (box.top + box.height / 2), x: tx, y: ty });
    }
    setPhase('fly');
  };

  useEffect(() => {
    if (phase === 'print') {
      const ticks = quick ? [] : [350, 700, 1050, 1400].map(t => setTimeout(() => haptic('tap'), t));
      const t = setTimeout(goFly, quick ? 400 : 2000);
      return () => { ticks.forEach(clearTimeout); clearTimeout(t); };
    }
    if (phase === 'fly') {
      const t = setTimeout(() => { haptic('success'); setPhase('plus'); }, quick ? 200 : 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => done.current(), quick ? 400 : 900);
    return () => clearTimeout(t);
  }, [phase, quick]);

  return createPortal(
    <div className={`sm ${phase === 'plus' ? 'sm--land' : ''}`} onClick={() => phase === 'print' && goFly()} role="status" aria-label="Saving receipt">
      <div className="sm-slot" aria-hidden="true"><span /></div>
      <div
        ref={paper}
        className={`sm-paper ib-paper ${phase === 'print' ? 'sm-paper--print' : 'sm-paper--fly'} ${phase === 'plus' ? 'sm-gone' : ''}`}
        style={{ '--dx': `${fly.dx}px`, '--dy': `${fly.dy}px` }}
      >
        <div className="ib-paper__head"><span className="ib-paper__brand">RECEIPT</span><span>{prettyDate(date)}</span></div>
        <div className="ib-rule" />
        <div className="ib-paper__title">{title}</div>
        {lines.map((l, i) => (
          <div className="ib-line" key={i}><span className="ib-item__name">{l.name}</span><i /><b>₹{fmtN(l.amount)}</b></div>
        ))}
        <div className="ib-rule" />
        <div className="ib-line ib-line--total"><span>TOTAL</span><i /><b>₹{fmtN(total)}</b></div>
        <span className="ib-zig" aria-hidden="true" />
      </div>
      <FloatingNav />
      {phase === 'plus' && <span className="sm-plus" style={{ left: fly.x, top: fly.y }} aria-hidden="true">+1</span>}
    </div>,
    document.body
  );
}
