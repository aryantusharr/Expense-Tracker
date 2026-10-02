import { useMemo } from 'react';
import { haptic } from '../../utils/haptics';
import { localDateStr, shortDay } from '../dashboard/dashboardData';

/** Date strip: Today / Yday / 2 days ago + a picker chip. */
export default function DateChips({ value, onChange }) {
  const dates = useMemo(() => [0, 1, 2].map(n => { const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d); }), []);
  const custom = !dates.includes(value);
  return (
    <div className="add-field">
      <span className="add-field__label">DATE</span>
      <div className="add-chips add-chips--scroll" data-noswipe>
        {dates.map((d, i) => (
          <button key={d} type="button" className="se-chip" aria-pressed={value === d} onClick={() => { haptic('choose'); onChange(d); }}>
            {i === 0 ? 'Today' : i === 1 ? 'Yday' : shortDay(d, { upper: false })}
          </button>
        ))}
        <label className="se-chip add-datepick" aria-pressed={custom}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM4 11h16M8 4v4M16 4v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {custom ? shortDay(value, { upper: false }) : 'Pick date'}
          <input type="date" value={value} max={localDateStr()} onChange={e => e.target.value && onChange(e.target.value)} aria-label="Pick a date" />
        </label>
      </div>
    </div>
  );
}
