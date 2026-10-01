import { haptic } from '../../utils/haptics';
import { fmt } from '../dashboard/dashboardData';
import { monthSide } from './historyData';

/**
 * Board 1k: current month on top, earlier months peeking 20px below (scaled 5% per step).
 * Tap → the stack fans (70px steps); tap a month → it comes to front and the list switches.
 */
export default function MonthStack({ months, selIdx, fan, onPress, isPersonal, budget, shrink }) {
  const n = months.length;
  const order = [selIdx, ...months.map((_, i) => i).filter(i => i !== selIdx)];
  const height = fan ? 172 + (n - 1) * 70 : n > 1 ? 172 + 70 : 172;
  return (
    <div className="hm" style={{ height, transform: `scale(${shrink.s})`, opacity: shrink.o }}>
      {months.map((mo, i) => {
        const d = order.indexOf(i);
        const side = monthSide(mo, { isPersonal, budget });
        const y = fan ? d * 70 : d * 20;
        const s = fan ? 1 : 1 - d * 0.05;
        const o = fan ? 1 : d > 3 ? 0 : 1 - d * 0.18;
        return (
          <button
            key={mo.key} type="button" className="hm__card"
            style={{ '--t': mo.tint, transform: `translateY(${y}px) scale(${s})`, zIndex: fan ? 1 + d : 10 - d, opacity: o, pointerEvents: !fan && d > 3 ? 'none' : undefined }}
            onClick={() => { haptic(fan ? 'choose' : 'tap'); onPress(i); }}
            aria-label={`${mo.name}, ${mo.count} expenses`}
          >
            <span className="hm__row">
              <span className="se-mono hm__name">{mo.name}</span>
              <span className="se-mono hm__count">{mo.count} {mo.count === 1 ? 'EXPENSE' : 'EXPENSES'}</span>
            </span>
            <span className="hm__big">
              <span className="se-display hm__total"><i>₹</i>{fmt(mo.total)}</span>
              {side && (
                <span className="hm__net">
                  <span className="se-mono">{side.label}</span>
                  <span className="se-display" style={{ color: side.color }}>{side.value}</span>
                </span>
              )}
            </span>
            <svg className="hm__spark" width="100%" height="40" viewBox="0 0 300 44" preserveAspectRatio="none" aria-hidden="true">
              <path d={mo.spark} fill="none" stroke={mo.tint} strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
      {n > 1 && <span className="se-mono hm__hint" style={{ opacity: fan ? 0 : 1 }}>TAP THE STACK FOR OTHER MONTHS</span>}
    </div>
  );
}
