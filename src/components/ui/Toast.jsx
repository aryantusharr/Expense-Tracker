import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../../utils/haptics';

const ToastContext = createContext(null);
const OUT_MS = 200;

/**
 * Toasts replace alert(). Usage:
 *   const toast = useToast();
 *   toast({ message: <><b>Dinner</b> torn off · ₹640</>, sub: 'Removed from synced room too',
 *           action: { label: 'Undo', onClick: restore }, kind: 'success' | 'error' | 'aai', duration: 4000,
 *           icon: <svg/>, bar: 5000 /* timer bar under the toast (AAI) *\/ });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback(id => {
    setToasts(ts => ts.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), OUT_MS);
  }, []);

  const show = useCallback(({ duration = 4000, kind, ...t }) => {
    const id = ++seq.current;
    if (kind === 'success') haptic('success');
    if (kind === 'error') haptic('error');
    setToasts(ts => [...ts.slice(-2), { id, kind, ...t }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);


  const renderToast = t => (
    <div key={t.id} className={`se-toast ${t.kind ? `se-toast--${t.kind}` : ''} ${t.leaving ? 'se-toast-out' : 'se-toast-in'}`}>
              {t.icon && <span className="se-toast__ic" aria-hidden="true">{t.icon}</span>}
              <div className="se-toast__body">
                <span className="se-toast__msg">{t.message}</span>
                {t.sub && <span className="se-toast__sub">{t.sub}</span>}
              </div>
              {t.action && (
                <button
                  type="button"
                  className="se-btn se-btn--soft se-btn--sm"
                  onClick={() => { haptic('tap'); t.action.onClick?.(); dismiss(t.id); }}
                >
                  {t.action.label}
                </button>
              )}
              {t.bar && <span className="se-toast__bar" style={{ animationDuration: `${t.bar}ms` }} aria-hidden="true" />}
            </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="se-toasts" role="status" aria-live="polite">
          {toasts.filter(t => !t.top).map(renderToast)}
        </div>,
        document.body
      )}
      {createPortal(
        <div className="se-toasts se-toasts--top" role="status" aria-live="polite">
          {toasts.filter(t => t.top).map(renderToast)}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}


// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.show;
}

/** Close a toast early by the id toast() returned. */
// eslint-disable-next-line react-refresh/only-export-components
export function useToastDismiss() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastDismiss must be used within ToastProvider');
  return ctx.dismiss;
}
