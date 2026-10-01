import { useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';

/**
 * Slide to add. Dimmed with the missing-field hint until the form is complete; an early slide / tap
 * shakes the bar and calls onBlocked (pink hint toast). Enter / Space on the thumb works too.
 */
export default function SlideToAdd({ problem, busy, shakeKey, onBlocked, onConfirm }) {
  const trackRef = useRef(null);
  const start = useRef(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const THUMB = 48, PAD = 4;
  const maxX = () => (trackRef.current?.clientWidth || 300) - THUMB - PAD * 2;

  const attempt = () => { if (problem) { haptic('error'); onBlocked?.(); } else onConfirm?.(); };

  const down = e => {
    if (busy) return;
    start.current = e.clientX - x;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = e => { if (start.current != null) setX(Math.max(0, Math.min(maxX(), e.clientX - start.current))); };
  const up = () => {
    if (start.current == null) return;
    start.current = null;
    setDragging(false);
    const done = x > maxX() * 0.85;
    setX(0);
    if (done) attempt();
    else if (x < 6) attempt(); // a plain tap counts as an attempt
  };

  return (
    <div
      ref={trackRef}
      key={shakeKey}
      className={`add-slide ${problem ? 'add-slide--dim' : ''} ${shakeKey ? 'se-shake' : ''}`}
      data-noswipe
    >
      <span className="add-slide__fill" style={{ width: x + THUMB + PAD }} aria-hidden="true" />
      <span className="add-slide__text">{busy ? 'Adding…' : problem || 'Slide to add'}</span>
      <button
        type="button"
        className="add-slide__thumb"
        aria-label={problem ? `Can't add yet: ${problem}` : 'Slide to add expense'}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform .4s var(--se-ease-soft)' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); attempt(); } }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
