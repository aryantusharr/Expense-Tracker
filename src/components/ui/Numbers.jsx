import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../utils/haptics';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Counts from 0 to `target` (ease-out quart). Reduce motion → shows the final number. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCountUp(target, { delay = 900, duration = 1800 } = {}) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    let raf;
    const t0 = performance.now() + delay;
    const step = t => {
      const k = Math.max(0, Math.min(1, (t - t0) / duration));
      setValue(target * (1 - Math.pow(1 - k, 4)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration]);
  return value;
}

/** Slot-machine reel digits (month totals). `height` = line height in px. */
export function RollingNumber({ value, height = 48, startDelay = 500 }) {
  const [rolled, setRolled] = useState(() => prefersReducedMotion());
  useEffect(() => {
    const t = setTimeout(() => setRolled(true), prefersReducedMotion() ? 0 : startDelay);
    return () => clearTimeout(t);
  }, [startDelay]);
  let di = 0;
  return (
    <span className="se-reels" aria-label={value} style={{ height }}>
      {value.split('').map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} aria-hidden="true" style={{ lineHeight: `${height}px` }}>{ch}</span>;
        const idx = di++;
        const n = rolled ? Number(ch) : 0;
        return (
          <span key={i} aria-hidden="true" className="se-reel-window" style={{ height }}>
            <span className="se-reel" style={{ transform: `translateY(${-n * height}px)`, transitionDelay: `${idx * 70}ms` }}>
              {DIGITS.map(g => <span key={g} style={{ height, lineHeight: `${height}px` }}>{g}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Digits that drop in one by one (hero amount, budget spent). */
export function DropNumber({ value, startDelay = 250, step = 70, className = '', style }) {
  return (
    <>
      {value.split('').map((c, i) => (
        <span key={`${value}-${i}`} className={`se-drop ${className}`} style={{ ...style, animationDelay: `${startDelay + i * step}ms` }} aria-hidden="true">
          {c}
        </span>
      ))}
    </>
  );
}
