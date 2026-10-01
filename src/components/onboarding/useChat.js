import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';

const wait = ms => new Promise(r => setTimeout(r, ms));

/** Tiny scripted-chat engine: bot() shows the typing dots for 650ms, then the bubble. */
export function useChat() {
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const bot = useCallback(async text => {
    setTyping(true);
    await wait(650);
    if (!alive.current) return;
    setTyping(false);
    setMsgs(m => [...m, { me: false, t: text }]);
  }, []);
  const say = useCallback(text => { haptic('tap'); setMsgs(m => [...m, { me: true, t: text }]); }, []);
  /** Strike through the last thing the user said and stamp it TAKEN. */
  const markLastBad = useCallback(() => {
    setMsgs(m => m.map((x, i) => (i === m.length - 1 ? { ...x, bad: true } : x)));
  }, []);

  return { msgs, typing, bot, say, markLastBad, wait };
}
