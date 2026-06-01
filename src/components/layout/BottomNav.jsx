import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './BottomNav.css';

const baseTabs = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/add', label: 'Add', icon: 'add' },
  { path: '/history', label: 'History', icon: 'history' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

function NavIcon({ name, isActive }) {
  const color = isActive ? 'var(--accent-light)' : 'var(--text-secondary)';
  const strokeWidth = isActive ? 2.2 : 1.8;

  const icons = {
    dashboard: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
    add: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    history: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8v4l2.5 2.5" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
    settings: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    inbox: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  };

  return icons[name] || null;
}

export default function BottomNav({ pendingCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Dynamically compute tabs
  const activeTabs = [...baseTabs];
  if (pendingCount > 0) {
    activeTabs.splice(2, 0, { path: '/review', label: 'Inbox', icon: 'inbox' });
  }

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {activeTabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              className={`nav-tab ${isActive ? 'active' : ''}`}
              onClick={() => navigate(tab.path)}
              id={`nav-${tab.label.toLowerCase()}`}
            >
              {isActive && (
                <motion.div
                  className="nav-indicator"
                  layoutId="nav-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <motion.span
                className="nav-icon-wrap"
                animate={{
                  scale: isActive ? 1.15 : 1,
                  y: isActive ? -2 : 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{ position: 'relative' }}
              >
                <NavIcon name={tab.icon} isActive={isActive} />
                {tab.path === '/review' && pendingCount > 0 && (
                  <span className="inbox-badge-bounce">{pendingCount}</span>
                )}
              </motion.span>
              <span className="nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
