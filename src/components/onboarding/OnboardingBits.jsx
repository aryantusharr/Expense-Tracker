import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { haptic } from '../../utils/haptics';
import { ICONS } from './onboardingData';
import './Onboarding.css';

export const Icon = ({ d, size = 20, stroke = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d={d} fill="none" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Screen base: page colour + the three drifting orbs (board alphas for dark / light). */
export function ObPage({ children, className = '' }) {
  const { theme } = useTheme();
  const a = theme === 'light' ? [0.2, 0.16, 0.1] : [0.5, 0.32, 0.22];
  return (
    <div className={`se-page ob ${className}`}>
      <div className="ob-sky" aria-hidden="true">
        <span className="se-orb se-orb-1" style={{ width: 300, height: 300, left: -120, top: -60, background: `rgba(124,108,255,${a[0]})` }} />
        <span className="se-orb se-orb-2" style={{ width: 280, height: 280, right: -140, top: 360, background: `rgba(79,212,196,${a[1]})` }} />
        <span className="se-orb se-orb-3" style={{ width: 220, height: 220, left: 40, bottom: -80, background: `rgba(255,111,160,${a[2]})` }} />
      </div>
      {children}
    </div>
  );
}

/** Back button + title + mono subtitle (all onboarding screens except Landing). */
export function ObHeader({ title, sub, onBack }) {
  const navigate = useNavigate();
  return (
    <header className="ob-head">
      <button
        type="button"
        aria-label="Back"
        className="ob-back se-glass se-press"
        onClick={() => { haptic('tap'); (onBack || (() => navigate('/')))(); }}
      >
        <Icon d={ICONS.back} />
      </button>
      <div className="ob-head__text">
        <h1 className="ob-head__title">{title}</h1>
        <span className="ob-head__sub">{sub}</span>
      </div>
    </header>
  );
}
