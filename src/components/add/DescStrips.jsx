import { haptic } from '../../utils/haptics';
import { matchChips } from './addHelpers';

/**
 * Suggestions under a text field (the phone keyboard has no strip of our own): strip 1 = most used (all time),
 * strip 2 = recent. Typing narrows both; a chip already shown in strip 1 isn't repeated in strip 2.
 * onPointerDown keeps the keyboard up while you tap.
 */
export default function DescStrips({ used = [], recent = [], typed = '', onPick, usedLabel = 'MOST USED', recentLabel = 'RECENT' }) {
  const u = matchChips(used, typed, 14);
  const shown = new Set(u.map(x => x.toLowerCase()));
  const r = matchChips(recent, typed, 14).filter(x => !shown.has(x.toLowerCase()));
  if (!u.length && !r.length) return null;
  const strip = (label, list) => !list.length ? null : (
    <div className="add-sg" data-noswipe role="group" aria-label={label}>
      <span className="add-sg__lab se-mono">{label}</span>
      {list.map(d => (
        <button key={d} type="button" className="add-sg__chip" onPointerDown={e => e.preventDefault()} onClick={() => { haptic('choose'); onPick(d); }}>{d}</button>
      ))}
    </div>
  );
  return <div className="add-sgs">{strip(usedLabel, u)}{strip(recentLabel, r)}</div>;
}
