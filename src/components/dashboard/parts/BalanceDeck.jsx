import { useState } from 'react';
import { haptic } from '../../../utils/haptics';
import { fmt, shortDay } from '../dashboardData';
import { SectionChip } from './Shared';

const CARD_H = 200;
const FAN_GAP = 214;
const STACK = [{ y: 0, s: 0.9, o: 0.65 }, { y: 16, s: 0.95, o: 0.85 }, { y: 32, s: 1, o: 1 }];

/**
 * Balance cards as a deck: yours on top. Tap → fan out / restack.
 * Each card's MON|ALL toggle flips it to the all-time back face.
 */
export default function BalanceDeck({ members, meId, monthLabel, since }) {
  const [expanded, setExpanded] = useState(false);
  const [flipped, setFlipped] = useState(null);

  const frontId = flipped || meId || members[0]?.id;
  const order = members.filter(m => m.id !== frontId).concat(members.filter(m => m.id === frontId));
  const n = order.length;
  const fanned = expanded && !flipped;
  const visible = Math.min(n, 3);
  const deckH = fanned ? n * FAN_GAP - (FAN_GAP - CARD_H) : CARD_H + (visible - 1) * 16;

  const reset = () => { setFlipped(null); setExpanded(false); };

  return (
    <section className="dsh-sec se-in" style={{ animationDelay: '280ms', gap: 12 }}>
      <SectionChip icon="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zM3 7l3-3h11M16 14h2" title="Balances" count={n} />
      <div className="dsh-deck" style={{ height: deckH }}>
        {order.map((m, i) => {
          const isFront = i === n - 1;
          const slot = STACK[Math.max(0, 3 - (n - i))] || { y: 0, s: 0.9, o: 0 };
          const hidden = !fanned && n - i > 3;
          const y = fanned ? i * FAN_GAP : slot.y - (3 - visible) * 16;
          const isFlipped = flipped === m.id;
          const pct = m.month.share > 0 ? Math.round((m.month.paid / m.month.share) * 100) : null;
          const last = m.last ? `Paid ₹${fmt(m.last.amount)} for ${m.last.name} · ${shortDay(m.last.date, { upper: false })}` : 'No payments yet';
          const isMe = m.id === meId;
          return (
            <div
              key={m.id}
              className="dsh-deck__card"
              style={{
                transform: `translateY(${y}px) scale(${fanned ? 1 : slot.s})`,
                zIndex: i + 1, opacity: hidden ? 0 : fanned ? 1 : slot.o,
                pointerEvents: hidden ? 'none' : undefined,
              }}
              aria-hidden={hidden || undefined}
            >
              <div className="dsh-deal" style={{ animationDelay: `${300 + (n - 1 - i) * 120}ms` }}>
                <button
                  type="button"
                  className="dsh-deck__hit"
                  aria-label={flipped ? 'Flip back and restack' : expanded ? 'Close balance cards' : 'Open balance cards'}
                  aria-expanded={expanded}
                  onClick={() => {
                    if (flipped) { haptic('choose'); reset(); return; }
                    haptic('success'); setExpanded(e => !e);
                  }}
                >
                  <div className="dsh-flip" style={{ transform: `rotateY(${isFlipped ? 180 : 0}deg)` }}>
                    <div className="dsh-face dsh-face--front" style={{ '--c': m.color }}>
                      <div className="dsh-face__top">
                        <div className="dsh-face__fill" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: m.cardBg }} />
                        <div className="dsh-sheen" />
                        <div className="dsh-face__name">
                          <span>{m.name}</span>
                          {isMe && <span className="dsh-you">YOU</span>}
                        </div>
                        <div className="dsh-face__net">
                          <b>{m.month.net >= 0 ? '+₹' : '−₹'}{fmt(m.month.net)}</b>
                          <span>{pct == null ? '—' : `${pct}%`} PAID</span>
                        </div>
                      </div>
                      <div className="dsh-face__sheet">
                        <div className="dsh-kv"><span>PAID</span><b>₹{fmt(m.month.paid)}</b></div>
                        <div className="dsh-kv"><span>SHARE</span><b>₹{fmt(m.month.share)}</b></div>
                        <span className="dsh-face__last">Last · {last}</span>
                      </div>
                    </div>
                    <div className="dsh-face dsh-face--back">
                      <span className="n">{m.name}</span>
                      <div>
                        <b style={{ color: m.all.net >= 0 ? '#3A2CA8' : '#B0305F' }}>{m.all.net >= 0 ? '+₹' : '−₹'}{fmt(m.all.net)}</b>
                        <span className="m">PAID ₹{fmt(m.all.paid)} · SHARE ₹{fmt(m.all.share)}</span>
                      </div>
                      <span className="since">{since ? `SINCE ${since}` : 'ALL TIME'}</span>
                    </div>
                  </div>
                </button>
                {(fanned || isFront) && !hidden && (
                  <button
                    type="button"
                    className="dsh-seg se-press se-pop"
                    aria-label={isFlipped ? `Flip ${m.name}'s card back to ${monthLabel}` : `Flip ${m.name}'s card to all time`}
                    aria-pressed={isFlipped}
                    onClick={() => {
                      if (isFlipped) { haptic('choose'); reset(); return; }
                      haptic('success'); setFlipped(m.id); setExpanded(false);
                    }}
                  >
                    <span className={isFlipped ? '' : 'on'}>{monthLabel}</span>
                    <span className={isFlipped ? 'on all' : ''}>ALL</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
