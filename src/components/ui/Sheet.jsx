import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const CLOSE_MS = 200; // --se-dur-quick

/**
 * Bottom sheet: slides in (.45s soft), out (.2s ease-out). Closes on scrim tap, Escape,
 * or dragging the handle down. Locks page scroll while open.
 */
export default function Sheet({ open, onClose, title, children, labelledBy }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef(null);
  const dragStart = useRef(null);

  // Mount on open; play the exit animation before unmounting on close.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setMounted(true); setClosing(false); setDragY(0); }
    else if (mounted) setClosing(true);
  }
  useEffect(() => {
    if (!closing) return undefined;
    const t = setTimeout(() => { setMounted(false); setClosing(false); }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!mounted) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const onPointerDown = e => { dragStart.current = e.clientY; setDragging(true); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onPointerMove = e => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    setDragging(false);
    if (dragY > 90) onClose?.();
    else setDragY(0);
  };

  const titleId = labelledBy || (title ? 'se-sheet-title' : undefined);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close"
        className={`se-scrim ${closing ? 'se-fade-out' : 'se-fade-in'}`}
        onClick={onClose}
      />
      <div
        className="se-sheet-wrap"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? 'none' : 'transform .2s var(--se-ease-out)' }}
      >
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`se-sheet ${closing ? 'se-sheet-out' : 'se-sheet-in'}`}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ padding: '4px 0 8px', margin: '-4px 0 -8px', touchAction: 'none', display: 'flex', justifyContent: 'center' }}
          >
            <span className="se-sheet__handle" />
          </div>
          {title && <h2 id="se-sheet-title" className="se-sheet__title">{title}</h2>}
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}
