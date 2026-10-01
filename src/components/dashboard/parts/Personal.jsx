import { DropNumber } from '../../ui/Numbers';
import { LineIcon } from '../../ui/CategoryIcon';
import { resolveCategoryIcon } from '../../../design/categoryIcons';
import { fmt, shortDay } from '../dashboardData';

/** Scrolling summary strip: this month (of budget) ✦ last month ✦ lifetime ✦ days left. */
export function Ticker({ cur, prev, budget, life, daysLeft }) {
  const parts = [
    `${cur.short.toUpperCase()} ₹${fmt(cur.total)}${budget ? ` OF ₹${fmt(budget)}` : ''}`,
    prev && `${prev.short.toUpperCase()} ₹${fmt(prev.total)}`,
    life.total > 0 && `LIFETIME ₹${fmt(life.total)}${life.since ? ` SINCE ${life.since.short}` : ''}`,
    `${daysLeft} ${daysLeft === 1 ? 'DAY' : 'DAYS'} LEFT`,
  ].filter(Boolean);
  const run = <span>{parts.map((p, i) => <span key={i}>{p} <span className="dsh-star">✦</span> </span>)}</span>;
  return (
    <div className="dsh-ticker se-glass se-in" style={{ animationDelay: '60ms' }} role="status" aria-label={parts.join(', ')}>
      <div className="se-marquee" aria-hidden="true">{run}{run}</div>
    </div>
  );
}

/** Budget ring for the current month (only when a budget is set). */
export function BudgetCard({ monthFull, spent, budget, daysLeft }) {
  const ratio = spent / budget;
  const over = ratio > 1;
  const pct = Math.round(ratio * 100);
  const C = 402.1;
  const off = C * (1 - Math.min(1, ratio));
  const angle = Math.min(1, ratio) * 360;
  const status = over ? 'OVER BUDGET' : 'ON TRACK';
  return (
    <section className="dsh-budget se-glass se-in" style={{ animationDelay: '120ms' }}>
      <div className="dsh-card__head">
        <span className="dsh-eyebrow">{monthFull} BUDGET</span>
        <span className={`dsh-pill ${over ? 'dsh-pill--up' : 'dsh-pill--down'}`}>{status}</span>
      </div>
      <div className="dsh-budget__body">
        <div className="dsh-gauge">
          <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
            <defs>
              <linearGradient id="dshBudgetG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={over ? 'var(--se-pink)' : 'var(--se-violet)'} />
                <stop offset="1" stopColor={over ? 'var(--se-pink-deep)' : 'var(--se-teal)'} />
              </linearGradient>
            </defs>
            <circle cx="75" cy="75" r="64" fill="none" stroke="var(--dsh-ring-track)" strokeWidth="12" />
            <circle className="dsh-gauge__arc" cx="75" cy="75" r="64" fill="none" stroke="url(#dshBudgetG)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} />
            <g className="dsh-gauge__knob" style={{ transform: `rotate(${angle}deg)` }}>
              <circle cx="139" cy="75" r="9" fill="var(--se-text)" />
              <circle cx="139" cy="75" r="4" fill={over ? 'var(--se-pink)' : 'var(--se-teal)'} />
            </g>
          </svg>
          <div className="dsh-gauge__mid">
            <div className="dsh-gauge__num" aria-label={`₹${fmt(spent)} spent`}>
              <span className="cur" aria-hidden="true">₹</span>
              <DropNumber value={fmt(spent)} startDelay={900} />
            </div>
            <span>spent of ₹{fmt(budget)}</span>
          </div>
        </div>
        <div className="dsh-budget__facts">
          <div className="dsh-fact">
            <span>{over ? 'Over by' : 'Left to spend'}</span>
            <b className={over ? 'neg-ink' : 'pos-ink'}>₹{fmt(budget - spent)}</b>
          </div>
          <div className="dsh-fact"><span>Monthly budget</span><b>₹{fmt(budget)}</b></div>
          <div className={`dsh-budget__pace ${over ? 'neg-ink' : 'pos-ink'}`}>{pct}% USED · {daysLeft} {daysLeft === 1 ? 'DAY' : 'DAYS'} LEFT</div>
        </div>
      </div>
    </section>
  );
}

/** Most recent expense in the personal room; synced copies are read-only here. */
export function LastPaid({ tx, categories }) {
  if (!tx) return null;
  const cat = (categories || []).find(c => c.id === tx.categoryId);
  const icon = resolveCategoryIcon(cat);
  return (
    <section className="dsh-last se-glass se-in" style={{ animationDelay: '280ms' }}>
      <div className="dsh-card__head">
        <span className="dsh-eyebrow">LAST PAID EXPENSE</span>
        <span className="dsh-count">{shortDay(tx.date)}</span>
      </div>
      <div className="dsh-last__row">
        <span className="dsh-last__icon" aria-hidden="true"><LineIcon path={icon.path} size={22} strokeWidth={1.7} /></span>
        <div className="dsh-last__mid">
          <span className="dsh-last__name">{tx.name}</span>
          {tx.syncedFrom && (
            <span className="dsh-badge">
              <svg className="se-spin" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Synced from {tx.syncedFrom}
            </span>
          )}
        </div>
        <div className="dsh-last__amt">
          <b>₹{fmt(tx.amount)}</b>
          {tx.syncedFrom && <span>YOUR SHARE</span>}
        </div>
      </div>
      {tx.syncedFrom && (
        <div className="dsh-last__foot">
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Read-only here · edit it in {tx.syncedFrom}
        </div>
      )}
    </section>
  );
}
