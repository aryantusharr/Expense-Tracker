import { haptic } from '../../utils/haptics';

/**
 * Pill button. variant: primary (violet→teal) · secondary (outline) · ghost · soft (teal, e.g. Undo) · danger
 * size: md (48px) · lg (52px) · sm (40px, rounded-rect)
 */
export default function Button({
  variant = 'primary', size = 'md', block = false, className = '', onClick, type = 'button', children, ...rest
}) {
  const cls = [
    'se-btn', `se-btn--${variant}`, size !== 'md' && `se-btn--${size}`, block && 'se-btn--block', className,
  ].filter(Boolean).join(' ');
  return (
    <button
      type={type}
      className={cls}
      onClick={e => { haptic('tap'); onClick?.(e); }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Round 44px icon-only button — always give it an aria-label. */
export function IconButton({ label, onClick, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`se-icon-btn ${className}`}
      aria-label={label}
      onClick={e => { haptic('tap'); onClick?.(e); }}
      {...rest}
    >
      {children}
    </button>
  );
}
