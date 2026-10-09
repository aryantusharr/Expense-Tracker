import { useEffect, useState } from 'react';
import { DropNumber } from '../../ui/Numbers';
import Sheet from '../../ui/Sheet';
import Button from '../../ui/Button';
import { haptic } from '../../../utils/haptics';
import { fmt, shortDay, MONTHS_SHORT } from '../dashboardData';

export function Mono({ m, size, radius, fontSize, className = '' }) {
  return (
    <span className={`dsh-mono ${className}`} style={{ '--c': m.color, width: size, height: size, borderRadius: radius, fontSize }} aria-hidden="true">
      {m.initial}
    </span>
  );
}

export function SectionChip({ icon, title, count, children }) {
  return (
    <div className="dsh-sec__row">
      <div className="dsh-sec__chip">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2>{title}</h2>
        {count != null && <span className="dsh-count">{count}</span>}
      </div>
      {children}
    </div>
  );
}

/** "NOT LOGGED" ticker — members with no payment dated today — or the all-clear strip. */
export function NudgeStrip({ members, meId }) {
  const missing = members.filter(m => !m.loggedToday);
  if (!members.length) return null;
  if (!missing.length) {
    return (
      <div className="dsh-synced se-in" role="status" style={{ animationDelay: '60ms' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        EVERYONE LOGGED TODAY · ROOM IS IN SYNC
      </div>
    );
  }
  // Only the person who has been silent the longest (never logged = longest): "TEST C SINCE 02 OCT".
  const long = [...missing].sort((x, y) => (x.lastDate || '').localeCompare(y.lastDate || ''))[0];
  const who = long.id === meId ? 'YOU' : long.name.toUpperCase();
  const since = long.lastDate ? `SINCE ${long.lastDate.slice(8, 10)} ${MONTHS_SHORT[Number(long.lastDate.slice(5, 7)) - 1].toUpperCase()}` : 'NO ENTRIES YET';
  const aria = `Not logged today: ${long.id === meId ? 'You' : long.name}, ${long.lastDate ? `since ${shortDay(long.lastDate, { upper: false })}` : 'no entries yet'}.`;
  return (
    <div className="dsh-nudge" role="status" aria-label={aria} style={{ animationDelay: '60ms' }}>
      <span className="dsh-nudge__tag" aria-hidden="true">
        <svg className="se-blink" width="14" height="14" viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3zM12 10v4M12 17h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        NOT LOGGED
      </span>
      <div className="dsh-nudge__ticker" aria-hidden="true">
        <div className="dsh-nudge__txt">{who} {since}</div>
      </div>
    </div>
  );
}

/** Hero: your all-time position, ring of how much of your share you've paid, everyone's net bars. */
export function HeroCard({ model, me, onPickIdentity }) {
  const [ringOn, setRingOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRingOn(true), 500); return () => clearTimeout(t); }, []);

  const { members, settlements } = model;
  const maxAbs = Math.max(1, ...members.map(m => Math.abs(m.all.net)));
  const nets = (
    <div className="dsh-nets">
      <div className="dsh-nets__axis" aria-hidden="true"><span>← OWES</span><span>NET · ALL TIME</span><span>OWED →</span></div>
      <div>
        {members.map((m, i) => {
          const pos = m.all.net >= 0;
          const w = (Math.abs(m.all.net) / maxAbs) * 50;
          const isMe = me && m.id === me.id;
          return (
            <div className="dsh-net" key={m.id}>
              <span className="dsh-net__name" style={{ fontWeight: isMe ? 700 : 500 }}>{isMe ? 'You' : m.name}</span>
              <div className="dsh-net__track">
                {Math.abs(m.all.net) > 0 && (
                  <div className={`dsh-net__bar se-grow-x ${pos ? 'pos' : 'neg'}`} style={{ width: `${w}%`, animationDelay: `${700 + i * 110}ms` }} />
                )}
              </div>
              <span className={`dsh-net__val ${pos ? 'pos-ink' : 'neg-ink'}`}>{pos ? '+' : '−'}{fmt(m.all.net)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!me) {
    return (
      <section className="dsh-hero dsh-hero--even se-in" style={{ animationDelay: '120ms' }}>
        <div className="dsh-hero__halo" />
        <div className="dsh-hero__top">
          <span className="dsh-hero__tag">WHO ARE YOU?</span>
          <span style={{ fontSize: 15, color: 'var(--dsh-ink-2)' }}>Pick your member profile so balances read from your side.</span>
          <Button size="sm" className="dsh-pick" onClick={onPickIdentity}>Pick my profile</Button>
        </div>
        {nets}
      </section>
    );
  }

  const net = me.all.net;
  const state = Math.abs(net) < 1 ? 'even' : net < 0 ? 'neg' : 'pos';
  const cps = state === 'neg'
    ? settlements.filter(s => s.from.id === me.id).map(s => s.to)
    : settlements.filter(s => s.to.id === me.id).map(s => s.from);
  const names = cps.map(c => c.name);
  const nameStr = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0];
  const label = state === 'neg' ? 'YOU OWE' : state === 'pos' ? "YOU'RE OWED" : 'ALL SQUARE';
  const sub = state === 'neg' ? `Pay ${nameStr} to settle up`
    : state === 'pos' ? `${nameStr} ${names.length > 1 ? 'owe' : 'owes'} you`
      : 'Nothing to settle right now';
  // Nothing logged yet → empty ring and "—", not "100% you paid".
  const nothing = me.all.share <= 0 && me.all.paid <= 0;
  const ratio = nothing ? 0 : me.all.share > 0 ? me.all.paid / me.all.share : 1;
  const ringPct = nothing ? '—' : `${Math.round(ratio * 100)}%`;
  const off = (201.06 * (1 - Math.min(1, ringOn ? ratio : 0))).toFixed(1);
  const gradId = state === 'neg' ? 'dshRingNeg' : 'dshRingPos';

  return (
    <section className={`dsh-hero dsh-hero--${state} se-in`} style={{ animationDelay: '120ms' }}>
      <div className="dsh-hero__halo" />
      <div className="dsh-hero__top">
        <div className="dsh-ring" role="img" aria-label={nothing ? 'Nothing paid yet' : `You paid ${ringPct} of your share`}>
          <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
            <defs>
              <linearGradient id="dshRingPos" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--se-violet)" /><stop offset="1" stopColor="var(--se-teal)" /></linearGradient>
              <linearGradient id="dshRingNeg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--se-pink)" /><stop offset="1" stopColor="var(--se-pink-deep)" /></linearGradient>
            </defs>
            <circle cx="38" cy="38" r="32" fill="none" stroke="var(--dsh-ring-track)" strokeWidth="7" />
            <circle className="dsh-ring__arc" cx="38" cy="38" r="32" fill="none" stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round" strokeDasharray="201.06" strokeDashoffset={off} />
          </svg>
          <div className="dsh-ring__txt" aria-hidden="true"><b>{ringPct}</b><span>you paid</span></div>
        </div>
        <div className="dsh-hero__label">
          <span className="dsh-hero__chip" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path d={state === 'neg' ? 'M12 5v14M6 13l6 6 6-6' : state === 'pos' ? 'M12 19V5M6 11l6-6 6 6' : 'M5 12.5l4.5 4.5L19 7.5'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="dsh-hero__tag">{label}</span>
        </div>
        <p className="dsh-hero__num" aria-label={`${label.toLowerCase()} ₹${fmt(net)}`} style={{ '--num-size': `${heroSize(fmt(net).length)}px` }}>
          <span className="cur" aria-hidden="true">₹</span>
          <DropNumber value={fmt(net)} />
        </p>
        <div className="dsh-hero__who">
          {cps.length > 0 && <span style={{ display: 'flex' }}>{cps.map(c => <Mono key={c.id} m={c} />)}</span>}
          <span>{sub}</span>
        </div>
      </div>
      {nets}
    </section>
  );
}

// Big hero digits shrink with length so they never run into the ring (board: 56px for 4 chars at 390pt).
function heroSize(chars) {
  return chars <= 4 ? 56 : chars === 5 ? 46 : chars === 6 ? 40 : chars <= 8 ? 34 : 28;
}

const ARROW_PAY = 'M7 17L17 7M9 7h8v8';
const ARROW_GET = 'M17 7L7 17M15 17H7V9';
const ARROW_NEUTRAL = 'M5 12h14M13 6l6 6-6 6';

export function Settlements({ settlements, meId }) {
  return (
    <section className="dsh-sec se-in" style={{ animationDelay: '200ms' }}>
      <SectionChip icon="M7 7h13l-3-3M17 17H4l3 3" title="Smart settlements" count={settlements.length} />
      {settlements.length === 0 && (
        <div className="dsh-square se-glass">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Everyone's square — nothing to settle.
        </div>
      )}
      {settlements.map((t, i) => {
        const payer = t.from.id === meId, payee = t.to.id === meId;
        const cp = payee ? t.from : payer ? t.to : t.from;
        const line = payer ? `You pay ${t.to.name}` : payee ? `${t.from.name} pays you` : `${t.from.name} → ${t.to.name}`;
        const tone = payer ? 'pay' : payee ? 'get' : '';
        const amtClass = payer ? 'neg-ink' : payee ? 'pos-ink' : '';
        const badgeBg = payer ? 'var(--se-pink-2)' : payee ? 'var(--se-teal-2)' : 'var(--se-text)';
        return (
          <div key={`${t.from.id}-${t.to.id}`} className={`dsh-settle se-glass se-row ${tone ? `dsh-settle--${tone}` : ''}`} style={{ animationDelay: `${300 + i * 90}ms` }}>
            <div className="dsh-settle__who">
              <Mono m={cp} />
              <span className="dsh-settle__badge" style={{ background: badgeBg }} aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 24 24"><path d={payer ? ARROW_PAY : payee ? ARROW_GET : ARROW_NEUTRAL} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </div>
            <span className="dsh-settle__line">{line}</span>
            <span className={`dsh-settle__amt ${amtClass}`}>{payer ? '−' : payee ? '+' : ''}₹{fmt(t.amount)}</span>
          </div>
        );
      })}
    </section>
  );
}

export function IdentitySheet({ open, onClose, members, meId, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} title="Who are you?">
      <span style={{ fontSize: 13, color: 'var(--se-text-2)', marginTop: -6 }}>Pick your member profile so balances read from your side.</span>
      {members.map(m => (
        <button
          key={m.id}
          type="button"
          className={`dsh-who se-press ${m.id === meId ? 'on' : ''}`}
          aria-pressed={m.id === meId}
          onClick={() => { haptic('success'); onPick(m.id); }}
        >
          <Mono m={m} />
          <span>{m.name}</span>
          {m.id === meId && (
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="var(--se-teal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
      ))}
    </Sheet>
  );
}
