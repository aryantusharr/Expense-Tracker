import { haptic } from '../../utils/haptics';

/** Selectable pill (filters, payer, members). `selected` drives the gradient state + aria-pressed. */
export default function Chip({ selected = false, onClick, leading, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`se-chip ${className}`}
      aria-pressed={selected}
      onClick={e => { haptic('choose'); onClick?.(e); }}
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
}

/** Small monogram dot for member chips. */
export function ChipDot({ color, children }) {
  return <span className="se-chip__dot" style={{ background: color }}>{children}</span>;
}
