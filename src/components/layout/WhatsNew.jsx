import { useState } from 'react';
import { haptic } from '../../utils/haptics';
import { LineIcon } from '../ui/CategoryIcon';
import Sheet from '../ui/Sheet';
import './WhatsNew.css';

// One-time card for people who used the app before this update (new users never see it).
const KEY = 'splitease_whatsnew_keyboard';
const safeGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
// Read at app start, before this session saves a room: only existing users had one.
const HAD_ROOM = !!safeGet('splitease_room');

const ROWS = [
  { icon: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8', c: '#8B7CFF', t: 'A new keyboard', s: 'Typing uses SplitEase’s own keys. Your recent expenses sit on top as suggestions — tap one to fill it in.' },
  { icon: 'M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3', c: '#5FD4C4', t: 'Paste', s: 'Tap Paste on the suggestion strip, then iPhone’s own Paste bubble.' },
  { icon: 'M12 4l8 8h-4.5v7h-7v-7H4z', c: '#F5C26B', t: 'Capitals & quick delete', s: 'Tap ⇧ for one capital, double-tap for caps lock. Hold ⌫ to delete fast.' },
  { icon: 'M7 7h13l-3-3M17 17H4l3 3', c: '#FF8FB5', t: 'Switch room moved', s: 'It’s the ⇄ button at the top-right of Settings.' },
];

export default function WhatsNew() {
  const [open, setOpen] = useState(() => {
    if (safeGet(KEY)) return false;
    if (!HAD_ROOM) { safeSet(KEY, '1'); return false; }
    return true;
  });
  const close = () => { haptic('choose'); safeSet(KEY, '1'); setOpen(false); };

  return (
    <Sheet open={open} onClose={close} labelledBy="wn-title">
      <span className="wn-kicker">JUST UPDATED</span>
      <h2 className="se-sheet__title" id="wn-title">What’s new</h2>
      <ul className="wn-list">
        {ROWS.map(r => (
          <li key={r.t} className="wn-row">
            <span className="wn-ic" style={{ '--c': r.c }}><LineIcon path={r.icon} size={18} strokeWidth={1.9} /></span>
            <span className="wn-txt"><b>{r.t}</b><span>{r.s}</span></span>
          </li>
        ))}
      </ul>
      <button type="button" className="se-btn se-btn--primary se-press wn-ok" onClick={close}>Got it</button>
    </Sheet>
  );
}
