import { haptic } from '../../utils/haptics';

// Operators sit in the LEFT column, ⌫ bottom-right (spec §9).
const KEYS = [
  '÷', '7', '8', '9',
  '×', '4', '5', '6',
  '−', '1', '2', '3',
  '+', '.', '0', '⌫',
];

export default function Keypad({ onKey }) {
  return (
    <div className="add-keys" role="group" aria-label="Amount keypad">
      {KEYS.map(k => {
        const op = '÷×−+'.includes(k);
        return (
          <button
            key={k}
            type="button"
            className={`add-key ${op ? 'add-key--op' : ''} ${k === '⌫' ? 'add-key--back' : ''}`}
            aria-label={k === '⌫' ? 'Delete' : k === '.' ? 'Decimal point' : k}
            onClick={() => { haptic('tap'); onKey(k); }}
          >
            {k === '⌫' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7zM13 9.5l5 5M18 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : k}
          </button>
        );
      })}
    </div>
  );
}
