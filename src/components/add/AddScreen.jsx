import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '../ui/Button';
import { haptic } from '../../utils/haptics';
import { useAddController } from './useAddController';
import QuickPane from './QuickPane';
import ItemsPane from './ItemsPane';
import './Add.css';

const MODES = [['quick', 'Quick'], ['split', 'Items']];

export default function AddScreen() {
  const c = useAddController();
  const navigate = useNavigate();
  const touch = useRef(null);
  const idx = c.mode === 'split' ? 1 : 0;

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'));
  const setMode = m => { if (m !== c.mode) { haptic('choose'); c.setMode(m); } };

  // Horizontal swipe between modes (ignored on scrolling strips + the slider).
  const onTouchStart = e => {
    const t = e.touches[0];
    touch.current = e.target.closest('[data-noswipe]') ? null : { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = e => {
    const s = touch.current; touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) setMode(dx < 0 ? 'split' : 'quick');
  };

  return (
    <div className="se-page add">
      <div className="add-sky" aria-hidden="true">
        <span className="se-orb se-orb-1 add-orb add-orb--1" />
        <span className="se-orb se-orb-2 add-orb add-orb--2" />
        <span className="se-orb se-orb-3 add-orb add-orb--3" />
      </div>
      <main className="add-main">
        <header className="add-head se-in">
          <IconButton label="Close" onClick={close}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </IconButton>
          <div className="add-mode" role="tablist" aria-label="Add mode" style={{ '--i': idx }}>
            <span className="add-mode__ind" aria-hidden="true" />
            {MODES.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={c.mode === key} className="add-mode__seg" onClick={() => setMode(key)}>{label}</button>
            ))}
          </div>
          <span style={{ width: 44 }} aria-hidden="true" />
        </header>

        <div className="add-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="add-track" style={{ transform: `translateX(${-idx * 100}%)` }}>
            <section className={`add-pane ${idx === 0 ? '' : 'add-pane--off'}`} aria-hidden={idx !== 0}>
              <QuickPane c={c} />
            </section>
            <section className={`add-pane ${idx === 1 ? '' : 'add-pane--off'}`} aria-hidden={idx !== 1}>
              <ItemsPane c={c} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
