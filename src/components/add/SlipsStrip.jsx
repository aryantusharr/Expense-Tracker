import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';
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
  const share = count > 0 && amount > 0 ? amount / count : 0;
  const nextPayer = () => {
    const i = members.findIndex(m => m.id === payer.id);
    onPayer(members[(i + 1) % members.length].id);
  };

  return (
    <div className="add-slips se-glass" data-noswipe>
      <button type="button" className="add-bill" style={{ '--c': payer.color }} onClick={() => { haptic('choose'); nextPayer(); }} aria-label={`Paid by ${nameOf(payer)}. Tap to change`}>
        <span className="add-bill__label">PAID BY</span>
        <span className="add-bill__name">
          {prev && <span key={`o${prev.id}`} className="add-bill__out" style={{ color: prev.color }}>{nameOf(prev)}</span>}
          <span key={payer.id} className={prev ? 'add-bill__in' : ''} style={{ color: payer.color }}>{nameOf(payer)}</span>
        </span>
      </button>
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
              aria-label={`${nameOf(m)}${isPayer ? ' (paid)' : ''}`}
              onClick={() => { haptic('choose'); onToggle(m.id); }}
            >
              <Monogram member={m} size={36} className={isPayer ? 'add-mono--payer' : ''} />
              <span className="add-slip" aria-hidden={!on}>₹{share.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
