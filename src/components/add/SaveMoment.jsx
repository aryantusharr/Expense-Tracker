import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../../utils/haptics';
import { LineIcon } from '../ui/CategoryIcon';
import FloatingNav from '../layout/FloatingNav';
import './SaveMoment.css';

const fmtN = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prettyDate = d => new Date(`${d}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Board "App-Add-Expense" save sequence: slot buzz + paper slides out of the printer in 4 stops (2.8s),
// at 3.0s the nav slides in and the receipt flies into History (.85s), then nav bounce + History pop + "+1".
const PRINT_MS = 3000;
const FLY_MS = 850;
const LAND_MS = 1000;
const TICKS = [340, 800, 1180, 1640, 2300];

/**
 * lines: [{ name, amount, iconPath? }] · rows: extra [{ a, b }] lines (e.g. SPLIT 3 WAYS) · paid: "RAVI PAID" or ''.
 * Tap anywhere during the print to skip ahead to the flight.
 */
export default function SaveMoment({ title, lines, rows = [], total, date, paid, room, onDone }) {
  const [phase, setPhase] = useState('print');   // print → fly → land
  const [fly, setFly] = useState({ dx: 0, dy: 240, bx: 0, by: 0 });
  const paper = useRef(null);
  const quick = reduce();
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  const goFly = () => {
    const tab = document.querySelector('.sm .fnav__tab:nth-child(2)');
    const box = paper.current?.getBoundingClientRect();
    if (tab && box) {
      const t = tab.getBoundingClientRect();
      const ico = tab.querySelector('svg').getBoundingClientRect();
      setFly({
        dx: t.left + t.width / 2 - (box.left + box.width / 2), dy: t.top + t.height / 2 - (box.top + box.height / 2),
        bx: ico.right - 2, by: ico.top - 9,
      });
    }
    setPhase('fly');
  };

  useEffect(() => {
    if (phase === 'print') {
      haptic('choose');
      const ticks = quick ? [] : TICKS.map(t => setTimeout(() => haptic('tap'), t));
      const t = setTimeout(goFly, quick ? 400 : PRINT_MS);
      return () => { ticks.forEach(clearTimeout); clearTimeout(t); };
    }
    if (phase === 'fly') {
      const t = setTimeout(() => { haptic('success'); setPhase('land'); }, quick ? 200 : FLY_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => done.current(), quick ? 400 : LAND_MS);
    return () => clearTimeout(t);
  }, [phase, quick]);

  return createPortal(
    <div className={`sm sm--${phase}`} onClick={() => phase === 'print' && goFly()} role="status" aria-label="Saving receipt">
      <div className="sm-win" style={{ '--dx': `${fly.dx}px`, '--dy': `${fly.dy}px` }}>
        <div ref={paper} className={`sm-paper ${phase === 'print' ? 'sm-paper--print' : phase === 'fly' ? 'sm-paper--fly' : 'sm-gone'}`}>
          <b className="sm-paper__title">{title}</b>
          <span className="sm-paper__date">{prettyDate(date)}{paid ? ` · ${paid}` : ''}</span>
          <span className="sm-paper__rule" />
          {lines.map((l, i) => (
            <span className="sm-paper__line" key={i}>
              {l.iconPath && <span className="sm-stamp" aria-hidden="true"><LineIcon path={l.iconPath} size={10} strokeWidth={2.4} /></span>}
              <span className="sm-paper__name">{l.name}</span><span>{fmtN(l.amount)}</span>
            </span>
          ))}
          {rows.map((r, i) => <span className="sm-paper__line" key={`r${i}`}><span className="sm-paper__name">{r.a}</span><span>{r.b}</span></span>)}
          <span className="sm-paper__rule" />
          <span className="sm-paper__total"><span>TOTAL</span><span>₹{fmtN(total)}</span></span>
          <span className="sm-paper__added">✓ ADDED TO {room}</span>
          <span className="sm-paper__bars" aria-hidden="true">|||| ||| || |||| |</span>
        </div>
      </div>

      {phase === 'print' && (
        <div className="sm-slot">
          <span className="sm-slot__slit" aria-hidden="true" />
          <span className="sm-slot__label">PRINTING…</span>
        </div>
      )}
      <div className={`sm-nav sm-nav--${phase}`}><FloatingNav /></div>
      {phase === 'land' && <span className="sm-plus" style={{ left: fly.bx, top: fly.by }} aria-hidden="true">+1</span>}
    </div>,
    document.body
  );
}
