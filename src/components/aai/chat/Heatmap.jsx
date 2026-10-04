import { weekGrid, tier } from '../../../aai/heatmap.js';
import { MONTH_NAMES, fromDateStr, toDateStr, cleanName } from '../../../aai/common.js';
import { Mg, Av } from './parts';

/**
 * "Who opened the app" — one tiny calendar per member (boards AAI-Chat-2A / -3 / -10A).
 * Counts app OPENS, not expenses: 5 week-columns per member. Hidden while the composer has the keyboard.
 * Tap a past day → onPickDay(date) ("Adding for 2 Oct").
 */
function Cell({ date, count, today, who, onPick }) {
  if (!date) return <span className="ch-hm ch-hm--none" aria-hidden="true" />;
  const d = fromDateStr(date);
  const label = `${who}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}: ${count ? `opened ${count} time${count === 1 ? '' : 's'}` : 'not opened'}`;
  const isToday = date === today;
  return (
    <button type="button" className={`ch-hm ${isToday ? 'is-today' : ''}`} data-t={tier(count)} aria-label={isToday ? `${label} (today)` : `${label}. Add expenses for this day`}
      onClick={() => !isToday && onPick?.(date)} tabIndex={isToday ? -1 : 0}><i /></button>
  );
}

export default function Heatmap({ members, opens = {}, stats = {}, now, line, onPickDay }) {
  const today = toDateStr(now);
  const cols = weekGrid(now);
  return (
    <div className="ch-card ch-heat">
      <div className="ch-heat__top">
        <span className="ch-lab">{`WHO OPENED THE APP · ${members.length > 1 ? '5 WEEKS' : 'YOU · 5 WEEKS'}`}</span>
        <span className="ch-lab ch-lab--dim">{MONTH_NAMES[now.getMonth()].toUpperCase()}</span>
      </div>
      <div className="ch-heat__cals">
        {members.map(m => {
          const days = opens[m.id] || {};
          const who = cleanName(m.name);
          return (
            <div key={m.id} className="ch-heat__m" style={{ '--c': m.color, '--cl': m.light }}>
              <div className="ch-heat__who"><Mg m={m} /><span>{who}</span></div>
              <div className="ch-heat__cols">
                {cols.map((col, i) => (
                  <div key={i} className="ch-heat__col">{col.map((d, j) => <Cell key={j} date={d} count={d ? days[d] || 0 : 0} today={today} who={who} onPick={onPickDay} />)}</div>
                ))}
              </div>
              <div className="ch-mono ch-heat__n"><b>{stats[m.id]?.opened ?? 0}</b>/31 days opened</div>
            </div>
          );
        })}
      </div>
      {line && <div className="ch-heat__line"><span className="ch-heat__dot" />{line}</div>}
    </div>
  );
}

/** Empty chat: greeting + calendars. compact = the composer is focused: small greeting, no calendars. */
export function EmptyState({ greeting, compact, heat }) {
  return (
    <div className={`ch-empty ${compact ? 'is-compact' : ''}`}>
      {!compact && <div className="ch-empty__hi"><Av big /></div>}
      <h1 className="ch-greet">{greeting.line1} <span>{greeting.line2}</span></h1>
      {!compact && <Heatmap {...heat} />}
    </div>
  );
}
