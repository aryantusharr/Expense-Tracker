import { useLocation, useNavigate } from 'react-router-dom';
import { haptic } from '../../utils/haptics';
import './FloatingNav.css';

// Floating glass nav from the Dashboard board: 3 tabs + the breathing add button.
const TABS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { path: '/history', label: 'History', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2' },
  { path: '/settings', label: 'Settings', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4' },
];

export default function FloatingNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = TABS.findIndex(t => pathname.startsWith(t.path));

  return (
    <nav className="fnav se-in" aria-label="Main" style={{ animationDelay: '520ms' }}>
      <div className="fnav__bar se-glass">
        {active >= 0 && <span className="fnav__ind" style={{ '--i': active }} aria-hidden="true" />}
        <div className="fnav__tabs">
          {TABS.map((t, i) => (
            <button
              key={t.path}
              type="button"
              className={`fnav__tab se-press ${i === active ? 'is-on' : ''}`}
              aria-current={i === active ? 'page' : undefined}
              onClick={() => { haptic('tap'); navigate(t.path); }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="fnav__add"
        aria-label="Add expense"
        onClick={() => { haptic('choose'); navigate('/add'); }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </nav>
  );
}
