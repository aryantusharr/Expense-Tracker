import { useEffect, useState } from 'react';
import { haptic } from '../../utils/haptics';
import { PillBuddy } from './Buddy';

const LABEL = {
  idle: 'Open Aryan AI',
  waiting: 'Open Aryan AI — something is waiting',
  reading: 'Open Aryan AI — reading a bill',
  error: 'Open Aryan AI — bill reading needs attention',
};

/** Dashboard header pill (board Bot-Pill-States). 44pt hit area around the 50×14 pill. */
export default function AaiPill({ state = 'idle', open = false, onOpen }) {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return (
    <button type="button" className="aai-pill se-press" aria-label={LABEL[state]} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { haptic('tap'); onOpen?.(); }}>
      <PillBuddy state={state} paused={open || hidden} />
    </button>
  );
}
