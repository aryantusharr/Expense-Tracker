import { useRef } from 'react';
import { haptic } from '../../utils/haptics';

/** Suggestion chips (board Bot-Sheet-Final, SG-A): 44px glass chips, tinted icon square + label + mono detail. */

const I = {
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20h4',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  pencil: 'M4 20h4L19 9l-4-4L4 16z',
  receipt: 'M5 2.5h14v19l-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5-2.4-1.5L5 21.5zM9 8h6M9 12h6M9 16h3',
  search: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.5-4.5',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  plus: 'M12 5v14M5 12h14',
  down: 'M12 4v11M7 10l5 5 5-5M5 20h14',
};

// Board colours: urgent pink · money owed teal · habits violet (rent amber) · questions violet.
const LOOK = {
  'undo-last': ['undo', '#FF8FB5'],
  duplicate: ['copy', '#FF8FB5'],
  'bill-waiting': ['receipt', '#FF8FB5'],
  'settle-plan': ['arrow', '#5FD4C4'],
  'same-as-yesterday': ['pencil', '#B3A8FF'],
  'usual-now': ['clock', '#B3A8FF'],
  'rent-due': ['receipt', '#F5C26B'],
  'not-logged': ['plus', '#B3A8FF'],
  'repeat-bill': ['receipt', '#B3A8FF'],
  install: ['down', '#5FD4C4'],
};
const look = c => LOOK[c.id] || (c.group === 'owed' ? ['bell', '#5FD4C4'] : c.group === 'questions' ? ['search', '#B3A8FF'] : ['pencil', '#B3A8FF']);

/** Long-press (550ms) hides a chip until midnight. */
function Chip({ chip, onPick, onHide }) {
  const t = useRef(null);
  const held = useRef(false);
  const [icon, c] = look(chip);
  const start = () => { held.current = false; t.current = setTimeout(() => { held.current = true; haptic('choose'); onHide?.(chip); }, 550); };
  const stop = () => clearTimeout(t.current);
  return (
    <button type="button" className="aai-chip" style={{ '--c': c }}
      onPointerDown={e => { e.preventDefault(); start(); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      onClick={() => { if (held.current) return; haptic('choose'); onPick(chip); }}>
      <span className="aai-chip__ic" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={I[icon]} /></svg>
      </span>
      <span className="aai-chip__txt"><b>{chip.label}</b>{chip.detail && <span>{chip.detail}</span>}</span>
    </button>
  );
}

export default function AaiChips({ chips, onPick, onHide, inline = false }) {
  if (!chips.length) return null;
  return (
    <div className={`aai-chips ${inline ? 'aai-chips--inline' : ''}`} data-noswipe role="toolbar" aria-label="Suggestions">
      {chips.map(c => <Chip key={c.id} chip={c} onPick={onPick} onHide={onHide} />)}
    </div>
  );
}
