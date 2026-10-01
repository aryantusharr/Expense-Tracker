import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../../utils/haptics';

const ToastContext = createContext(null);
const OUT_MS = 200;

/**
 * Toasts replace alert(). Usage:
 *   const toast = useToast();
 *   toast({ message: <><b>Dinner</b> torn off · ₹640</>, sub: 'Removed from synced room too',
 *           action: { label: 'Undo', onClick: restore }, kind: 'success' | 'error', duration: 4000 });
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

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="se-toasts" role="status" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`se-toast ${t.kind ? `se-toast--${t.kind}` : ''} ${t.leaving ? 'se-toast-out' : 'se-toast-in'}`}>
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
            </div>
          ))}
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
