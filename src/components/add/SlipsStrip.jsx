import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';
import Sheet from '../ui/Sheet';
import Monogram from './Monogram';

const nameOf = m => (m?.name || '').replace(/^test[\s_-]+/i, '') || m?.name || '';

/**
 * Compact slips strip (spec §6): a mini PAID BY bill + the seats. Tap the bill to change payer
 * (old name flips away, new one springs in); tap a seat to include / leave out — included seats get
 * a ₹ slip that slides out, left-out seats grey out and their slip tucks back.
 */
export default function SlipsStrip({ members, paidBy, splitAmong, amount, onPayer, onToggle }) {
  const payer = members.find(m => m.id === paidBy) || members[0];
  const [prev, setPrev] = useState(null);
  const [picking, setPicking] = useState(false);
  const lastPayer = useRef(payer?.id);
  useEffect(() => {
    if (payer && lastPayer.current !== payer.id) {
      const old = members.find(m => m.id === lastPayer.current);
      lastPayer.current = payer.id;
      if (old) { setPrev(old); const t = setTimeout(() => setPrev(null), 260); return () => clearTimeout(t); }
    }
    return undefined;
  }, [payer, members]);

  if (!payer) return null;
  const count = splitAmong.length;
  const each = count > 0 && amount > 0 ? Math.round(amount / count) : 0;
  const fmt = n => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const nextPayer = () => {
    const i = members.findIndex(m => m.id === payer.id);
    onPayer(members[(i + 1) % members.length].id);
  };

  return (
    <div className="add-slips se-glass" data-noswipe>
      <button type="button" className="add-bill" style={{ '--c': payer.color }} onClick={() => { haptic('choose'); if (members.length > 4) setPicking(true); else nextPayer(); }} aria-label={`Paid by ${nameOf(payer)}. Tap to change`}>
        <span className="add-bill__label">PAID BY</span>
        <span className="add-bill__name">
          {prev && <span key={`o${prev.id}`} className="add-bill__out" style={{ color: prev.color }}>{nameOf(prev)}</span>}
          <span key={payer.id} className={prev ? 'add-bill__in' : ''} style={{ color: payer.color }}>{nameOf(payer)}</span>
        </span>
        <span className="add-bill__total">₹{fmt(amount)}</span>
      </button>
      <div className="add-slips__col">
        <div className="add-slips__head">
          <span>PAID BY · SPLIT</span>
          <em>{count > 0 ? `₹${fmt(each)} EACH · ${count}` : 'PICK SOMEONE'}</em>
        </div>
        <div className="add-seats" role="group" aria-label="Split with">
          {members.map(m => {
            const on = splitAmong.includes(m.id);
            const isPayer = m.id === payer.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`add-seat ${on ? 'add-seat--on' : ''}`}
                style={{ '--c': m.color }}
                aria-pressed={on}
                aria-label={`${on ? 'Leave out' : 'Include'} ${nameOf(m)}${isPayer ? ' (paid)' : ''}`}
                onClick={() => { haptic('choose'); onToggle(m.id); }}
              >
                <Monogram member={m} size={38} className={isPayer ? 'add-mono--payer' : ''} />
                <span className="add-slip" aria-hidden="true">₹{fmt(each)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Who paid?">
        <div className="add-payers">
          {members.map(m => (
            <button key={m.id} type="button" className={`add-payer ${m.id === payer.id ? 'add-payer--on' : ''}`} style={{ '--c': m.color }}
              onClick={() => { haptic('choose'); onPayer(m.id); setPicking(false); }}>
              <Monogram member={m} size={36} />
              <span>{nameOf(m)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
