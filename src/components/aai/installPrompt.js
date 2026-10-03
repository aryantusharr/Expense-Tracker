/**
 * Android one-tap Install: Chrome fires `beforeinstallprompt` once, early, so we catch it at import time
 * and keep it for the "Install SplitEase" chip. iPhone never fires it (no chip there).
 */
let deferred = null;
const subs = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    subs.forEach(f => f(true));
  });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach(f => f(false)); });
}

export const canInstall = () => !!deferred;
export function onInstallable(f) { subs.add(f); return () => subs.delete(f); }

/** Shows Chrome's install dialog. Resolves true when the user accepted. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  subs.forEach(f => f(false));
  e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}
