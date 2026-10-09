import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';
import CategoryIcon, { LineIcon } from '../ui/CategoryIcon';
import { resolveCategoryIcon } from '../../design/categoryIcons';
import { initialOf, fmt } from '../dashboard/dashboardData';
import { myPart, isSyncedExp, syncedFrom } from './historyData';

const TEAR_AT = 170;
const SCISSORS = 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12';

/**
 * Drag a row left: dashed pink layer "KEEP PULLING" → past −170px "RELEASE TO TEAR".
 * Release past the line: the row tears into two jagged halves, the list closes up, onTear fires.
 * Locked rows (synced copies) shake gently instead and call onLocked.
 */
export function TearRow({ children, locked, removed, dim = 1, onTap, onTear, onLocked, landed }) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [torn, setTorn] = useState(false);
  const [shake, setShake] = useState(0);
  const st = useRef(null);
  const armed = useRef(false);
  const timer = useRef(null);

  // Undo: bring a torn row back (derive during render, no effect).
  const [prevRemoved, setPrevRemoved] = useState(removed);
  if (removed !== prevRemoved) { setPrevRemoved(removed); if (!removed) setTorn(false); }
  useEffect(() => () => clearTimeout(timer.current), []);

  const down = e => {
    if (torn || e.button > 0) return;
    st.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  };
  const move = e => {
    const s = st.current;
    if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.moved) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { st.current = null; return; }
      if (mx > -7) return;
      s.moved = true;
      e.currentTarget.setPointerCapture?.(s.id);
      setDrag(true);
    }
    const v = Math.min(0, mx);
    setDx(locked ? Math.max(v, -26) : v);
    if (!locked) {
      if (v < -TEAR_AT && !armed.current) { armed.current = true; haptic('choose'); }
      if (v > -TEAR_AT) armed.current = false;
    }
  };
  const up = () => {
    const s = st.current;
    st.current = null;
    if (!s) return;
    const was = dx;
    setDrag(false);
    setDx(0);
    armed.current = false;
    if (!s.moved) { onTap?.(); return; }
    if (locked) {
      if (was < -12) { try { navigator.vibrate?.([8, 30, 8]); } catch { /* best effort */ } setShake(k => k + 1); onLocked?.(); }
      return;
    }
    if (was < -TEAR_AT) {
      try { navigator.vibrate?.([20, 40, 30]); } catch { /* best effort */ }
      setTorn(true);
      timer.current = setTimeout(() => onTear?.(), 500);
    }
  };

  const pull = Math.min(1, -dx / TEAR_AT);
  const ready = -dx > TEAR_AT;
  return (
    <div className={`hr ${removed ? 'hr--gone' : ''} ${landed ? 'hr--landed' : ''}`} style={{ opacity: dim, transition: 'opacity .4s' }}>
      <div className="hr__inner">
        <div className="hr__box">
          {!locked && !torn && (
            <div className="hr__pull" style={{ '--a': Math.min(0.45, -dx / 400), opacity: dx < -4 ? 1 : 0 }} aria-hidden="true">
              <span className="se-mono">{ready ? 'RELEASE TO TEAR' : 'KEEP PULLING'}</span>
              <span style={{ display: 'flex', transform: `scale(${ready ? 1.35 : 1 + pull * 0.1})`, transition: 'transform .2s' }}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path d={SCISSORS} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </div>
          )}
          {!torn ? (
            <div
              key={shake}
              className={`hr__drag ${shake ? 'hr__shake' : ''}`}
              style={{ transform: `translateX(${dx}px)`, transition: drag ? 'none' : 'transform .45s var(--se-ease-soft)' }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap?.(); } }}
            >
              {children}
            </div>
          ) : (
            <div className="hr__torn" aria-hidden="true">
              <div className="hr__half hr__half--top">{children}</div>
              <div className="hr__half hr__half--bot">{children}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The share line under an amount: teal "you get ₹X" / pink "your share ₹X" / muted "personal". */
function shareLine(e, { meId, isPersonal, synced }) {
  if (isPersonal) return synced ? null : { t: 'personal', c: 'mute' }; // synced copies show 'your share' separately
  const p = myPart(e, meId);
  if (!p.involved) return null;
  if (p.delta > 0.5) return { t: `you get ₹${fmt(p.delta)}`, c: 'teal' };
  if (p.delta < -0.5) return { t: `your share ₹${fmt(p.share)}`, c: 'pink' };
  return null;
}

export function ExpenseCard({ e, cat, users, meId, isPersonal }) {
  const synced = isSyncedExp(e);
  const payer = e.paidBy === meId ? 'You' : (users.find(u => u.id === e.paidBy)?.name || 'Someone');
  const sub = isPersonal
    ? (synced ? `Synced from ${syncedFrom(e)}` : 'Just you')
    : `${payer} paid · split ${e.splitAmong?.length || 0}`;
  const line = shareLine(e, { meId, isPersonal, synced });
  return (
    <div className={`hc se-glass ${synced ? 'hc--synced' : ''}`}>
      <CategoryIcon category={cat} size={38} />
      <div className="hc__main">
        <span className="hc__title">{e.description}</span>
        <span className="hc__sub">{sub}</span>
      </div>
      <div className="hc__side">
        <span className="hc__amt se-display">₹{fmt(e.amount)}</span>
        {isPersonal && synced ? <span className="hc__line hc__line--pink se-mono">your share</span>
          : line && <span className={`hc__line hc__line--${line.c} se-mono`}>{line.t}</span>}
      </div>
      {synced && (
        <>
          <span className="hc__copy se-mono" aria-hidden="true">COPY</span>
          <span className="hc__lock" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Itemised bill: parent card with a printer slot; tapping prints the sub-receipt downward
 * (2.4s, 4 stops, slot buzz, "PRINTING…", tick haptics). Lines open the receipt editor.
 */
export function BillCard({ bill, catOf, users, meId, isPersonal, dim, removed, onEditItem, onTear, onLocked, landed }) {
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const synced = isSyncedExp(bill.e);

  const toggle = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const next = !open;
    setOpen(next);
    setPrinting(next);
    if (next) {
      timers.current = [280, 670, 1000, 1400].map(ms => setTimeout(() => haptic('tap'), ms));
      timers.current.push(setTimeout(() => setPrinting(false), 2400));
    }
  };

  const payer = bill.e.paidBy === meId ? 'You' : (users.find(u => u.id === bill.e.paidBy)?.name || 'Someone');
  const mine = bill.items.reduce((a, it) => { const p = myPart(it, meId); return { paid: a.paid + p.paid, share: a.share + p.share, involved: a.involved || p.involved }; }, { paid: 0, share: 0, involved: false });
  const delta = mine.paid - mine.share;
  const line = isPersonal ? (synced ? { t: 'your share', c: 'pink' } : { t: 'personal', c: 'mute' })
    : !mine.involved ? null : delta > 0.5 ? { t: `you get ₹${fmt(delta)}`, c: 'teal' } : delta < -0.5 ? { t: `your share ₹${fmt(mine.share)}`, c: 'pink' } : null;
  const sub = isPersonal ? (synced ? `Synced from ${syncedFrom(bill.e)} · ${bill.items.length} items` : `${bill.items.length} items`) : `${payer} paid · ${bill.items.length} items`;

  return (
    <TearRow locked={synced} removed={removed} dim={dim} landed={landed} onTear={onTear} onLocked={onLocked} onTap={toggle}>
      <div className="hb">
        <div className={`hb__top ${printing ? 'hb__buzz' : ''}`}>
          <div className="hb__head">
            <CategoryIcon category={catOf(bill.e)} size={38} />
            <div className="hc__main">
              <span className="hc__title">{bill.name}</span>
              <span className="hc__sub">{sub}</span>
            </div>
            <div className="hc__side">
              <span className="hc__amt se-display">₹{fmt(bill.total)}</span>
              {line && <span className={`hc__line hc__line--${line.c} se-mono`}>{line.t}</span>}
            </div>
          </div>
          <span className="hb__slot" aria-hidden="true" />
          <span className="hb__hint se-mono">{open ? (printing ? 'PRINTING…' : 'TAP TO FOLD') : `TAP TO PRINT ${bill.items.length} ITEMS`}</span>
        </div>
        {open && (
          <div className="hb__feed" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
            <div className="hb__paper se-mono" style={{ animation: 'hist-printD 2.4s linear both' }}>
              {bill.items.map((it, i) => {
                const icon = resolveCategoryIcon(catOf(it));
                const who = (it.splitAmong || []).map(id => initialOf(users.find(u => u.id === id)?.name));
                return (
                  <button type="button" key={it.id} className="hb__line" onClick={() => onEditItem(it)} disabled={synced}>
                    <span className="hb__stamp" style={{ transform: `rotate(${[-5, 4, -3, 6][i % 4]}deg)` }}><LineIcon path={icon.path} size={9} strokeWidth={2.2} /></span>
                    <span className="hb__name">{(it.description || '').toUpperCase()}</span>
                    {!isPersonal && <span className="hb__who">{who.map((w, k) => <span key={k}>{w}</span>)}</span>}
                    <span className="hb__dots" />
                    <span className="hb__amt">{(parseFloat(it.amount) || 0).toFixed(2)}</span>
                  </button>
                );
              })}
              <div className="hb__total"><span>TOTAL · {bill.items.length} ITEMS</span><span>{bill.total.toFixed(2)}</span></div>
            </div>
          </div>
        )}
      </div>
    </TearRow>
  );
}
