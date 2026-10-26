// The top of the search results: a count strip, month chips, and a date dropdown (board "Bug 5 · Search A3").
import { useState } from 'react';
import { haptic } from '../../utils/device/haptics';
import { stripText } from './searchData';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const Chevron = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}>
    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SearchResults({ groups, total, pick, onMonth, onDate }) {
  const [menu, setMenu] = useState(false);
  const { primary, secondary } = stripText(groups, total, pick);
  const group = groups.find(g => g.key === pick.month);
  const multiYear = new Set(groups.map(g => g.year)).size > 1;
  const choose = (month) => { haptic('tap'); setMenu(false); onMonth(month); };
  const chooseDate = (key) => { haptic('tap'); setMenu(false); onDate(key); };
  const day = group?.days.find(d => d.key === pick.dateKey);

  return (
    <div className="hs">
      <div className="hs__strip se-glass" aria-live="polite">
        <span className="se-mono hs__main">{primary}</span>
        {secondary && <span className="se-mono hs__sub">{secondary}</span>}
      </div>

      {groups.length > 0 && (
        <div className="hs__chips" role="tablist" aria-label="Months with matches">
          <button type="button" role="tab" aria-selected={pick.month === 'all'} className={`hs__chip se-press ${pick.month === 'all' ? 'is-on' : ''}`} onClick={() => choose('all')}>
            <span className="se-mono">ALL · {total}</span>
          </button>
          {groups.map(g => (
            <button key={g.key} type="button" role="tab" aria-selected={pick.month === g.key} className={`hs__chip se-press ${pick.month === g.key ? 'is-on' : ''}`} onClick={() => choose(g.key)}>
              <span className="se-mono">{g.label}{multiYear ? ` ’${g.year.slice(2)}` : ''} · {g.count}</span>
            </button>
          ))}
        </div>
      )}

      {group && (
        <div className="hs__date">
          <button type="button" className="hs__datebtn se-glass se-press" aria-haspopup="listbox" aria-expanded={menu} onClick={() => { haptic('tap'); setMenu(m => !m); }}>
            <span className="se-mono hs__datelbl">DATE</span>
            <span className="hs__dateval">{day ? day.label : `All dates · ${group.label}`}</span>
            <Chevron open={menu} />
          </button>
          {menu && (
            <>
              <button type="button" className="hs__scrim" aria-label="Close date list" onClick={() => setMenu(false)} />
              <div className="hs__menu se-pop" role="listbox" aria-label="Dates with matches">
                <button type="button" role="option" aria-selected={!pick.dateKey} className={`hs__opt ${!pick.dateKey ? 'is-on' : ''}`} onClick={() => chooseDate(null)}>
                  <span className="se-mono">ALL DATES · {group.label}</span><span className="se-mono hs__optn">{plural(group.count, 'MATCH', 'MATCHES')}</span>
                </button>
                {group.days.map(d => (
                  <button key={d.key} type="button" role="option" aria-selected={pick.dateKey === d.key} className={`hs__opt ${pick.dateKey === d.key ? 'is-on' : ''}`} onClick={() => chooseDate(d.key)}>
                    <span className="se-mono">{d.label}</span><span className="se-mono hs__optn">{plural(d.count, 'MATCH', 'MATCHES')}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
