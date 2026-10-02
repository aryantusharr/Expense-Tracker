import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../../utils/haptics';
import { VERSION } from '../../version/version';
import './UpdateToast.css';

const COUNT = 5;
const short = v => String(v || '').replace(/\.0$/, '');
// Never reload under someone's fingers: mid-add or while the keyboard is open, wait.
const busy = () => window.location.pathname.startsWith('/add') || document.documentElement.classList.contains('se-kb-open');

/**
 * Board Version-Final 7A2: when a new release takes over (sw.js changed → new service worker),
 * "Updating to vX in 5s" with a pulsing dot, then reload. Later = pick it up on the next open.
 */
export default function UpdateToast() {
  const [next, setNext] = useState(null);   // version we're updating to
  const [left, setLeft] = useState(COUNT);
  const hadController = useRef(typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return undefined;
    const onChange = async () => {
      if (!hadController.current) { hadController.current = true; return; }   // first install, not an update
      let v = '';
      try { v = (await (await fetch('/version.json', { cache: 'no-store' })).json()).version; } catch { /* offline */ }
      if (!v || v === VERSION) return;
      setLeft(COUNT);
      setNext(v);
    };
    const check = () => sw.getRegistration().then(r => r?.update()).catch(() => {});
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    sw.addEventListener('controllerchange', onChange);
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(check, 30 * 60 * 1000);
    return () => { sw.removeEventListener('controllerchange', onChange); document.removeEventListener('visibilitychange', onVis); clearInterval(iv); };
  }, []);

  useEffect(() => {
    if (!next) return undefined;
    if (left > 0) { const t = setTimeout(() => setLeft(n => n - 1), 1000); return () => clearTimeout(t); }
    const go = () => { if (busy()) return; haptic('choose'); window.location.reload(); };
    go();
    const iv = setInterval(go, 1000);
    return () => clearInterval(iv);
  }, [next, left]);

  if (!next) return null;
  return createPortal(
    <div className="upd se-glass" role="status">
      <span className="upd__dot" aria-hidden="true" />
      <span className="upd__txt">{left > 0 ? `Updating to v${short(next)} in ${left}s` : `Updating to v${short(next)}…`}</span>
      <button type="button" className="upd__later" onClick={() => { haptic('tap'); setNext(null); }}>Later</button>
    </div>,
    document.body,
  );
}
