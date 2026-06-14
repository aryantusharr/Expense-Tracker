/**
 * MathPlaceholder — animated cycling placeholder for amount input fields.
 * Renders as a CSS animation cycling through math examples.
 * Low visual weight, slow transitions, non-distracting.
 */

import { useEffect, useState } from 'react';

const EXAMPLES = [
  '50+20=70',
  '120-45=75',
  '15×4=60',
  '400÷8=50',
  '80+30=110',
  '200-75=125',
];

export function MathPlaceholder({ className = '', style = {} }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Fade out, swap, fade in — every 2.8s
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % EXAMPLES.length);
        setVisible(true);
      }, 350);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`math-placeholder ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        fontSize: '0.85em',
        fontWeight: 400,
        color: 'var(--text-tertiary)',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {EXAMPLES[index]}
    </span>
  );
}

/**
 * Returns a placeholder string for use in native input placeholder attr.
 * Since inputs can't contain animated children, we provide a static example.
 * The full animated version is overlaid when the input has no value.
 */
export function getStaticMathPlaceholder() {
  return '50+20=70';
}
