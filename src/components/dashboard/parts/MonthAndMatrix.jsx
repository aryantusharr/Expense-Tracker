import { useEffect, useRef } from 'react';
import { RollingNumber, useCountUp } from '../../ui/Numbers';
import { LineIcon } from '../../ui/CategoryIcon';
import { haptic } from '../../../utils/haptics';
import { fmt } from '../dashboardData';
import { SectionChip } from './Shared';

/** Delta pill vs previous month. Spending less is good (teal), more is pink. */
function Delta({ cur, prev, prevLabel }) {
  if (prev == null) return <span className="dsh-pill dsh-pill--flat">FIRST MONTH</span>;
  if (!prev) return <span className="dsh-pill dsh-pill--flat">NEW</span>;
  const dl = ((cur - prev) / prev) * 100;
  return (
    <span className="dsh-delta">
      <span>vs {prevLabel} ₹{fmt(prev)}</span>
      <span className={`dsh-pill ${dl < 0 ? 'dsh-pill--down' : 'dsh-pill--up'}`}>{dl < 0 ? '▼ ' : '▲ '}{Math.abs(dl).toFixed(1)}%</span>
    </span>
  );
}

export function LifetimeSpend({ total, months, className = '', style }) {
  const shown = useCountUp(total);
  return (
    <div className={`dsh-life ${className}`} style={style}>
      <div className="dsh-life__head"><span>Lifetime spend</span><span>{months} {months === 1 ? 'MONTH' : 'MONTHS'}</span></div>
      <b className="se-grad-text-r" aria-label={`₹${fmt(total)}`}>₹{fmt(shown)}</b>
    </div>
  );
}

/**
 * Month card: selected month total on reels, delta, lifetime (shared only), tappable bars.
 * budget (personal): dashed line + over-budget bars in pink.
 */
export function MonthCard({ months, sel, onSelect, life, budget = 0, delay = 360 }) {
  const m = months[sel];
  const prev = sel > 0 ? months[sel - 1] : null;
  const chartH = budget ? 170 : 160;
  const maxVal = Math.max(1, ...months.map(x => x.total), budget ? budget * 1.2 : 0);
  const scale = 120 / maxVal;
  const over = budget > 0 && m.total > budget;
  const budgetY = Math.round(budget * scale) + 21;

  return (
    <section className="dsh-card se-glass se-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="dsh-card__head">
        <span className="dsh-eyebrow">{m.full}</span>
        <Delta cur={m.total} prev={prev ? prev.total : null} prevLabel={prev?.short} />
      </div>
      <div className="dsh-big" aria-label={`${m.full} total ₹${fmt(m.total)}`}>
        <span className="cur" aria-hidden="true">₹</span>
        <RollingNumber key={m.key} value={fmt(m.total)} startDelay={m === months[months.length - 1] ? 500 : 0} />
      </div>
      {budget > 0 && (
        <span className="dsh-budget-pill" style={{ background: over ? 'rgba(255,143,181,0.14)' : 'rgba(95,212,196,0.12)' }}>
          <span className={over ? 'neg-ink' : 'pos-ink'}>₹{fmt(Math.abs(budget - m.total))} {over ? 'OVER' : 'UNDER'} BUDGET</span>
        </span>
      )}
      {life && <LifetimeSpend total={life.total} months={life.months} />}
      <div className="dsh-bars" style={{ height: chartH }}>
        {budget > 0 && (
          <>
            <div className="dsh-budget-line" style={{ bottom: budgetY }} />
            <span className="dsh-budget-tag" style={{ bottom: budgetY + 4 }}>BUDGET ₹{budget >= 1000 ? `${+(budget / 1000).toFixed(1)}K` : fmt(budget)}</span>
          </>
        )}
        <div className="dsh-bars__grid" style={{ height: chartH, gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
          {months.map((x, i) => {
            const h = Math.max(4, Math.round(x.total * scale));
            const on = i === sel;
            const ov = budget > 0 && x.total > budget;
            return (
              <button
                key={x.key}
                type="button"
                className={`dsh-bar ${on ? 'on' : ''} ${ov ? 'over' : ''}`}
                style={{ height: chartH }}
                aria-label={`${x.full} total ₹${fmt(x.total)}${ov ? ', over budget' : ''}`}
                aria-pressed={on}
                onClick={() => { if (on) return; haptic(ov ? 'error' : 'tap'); onSelect(i); }}
              >
                {on && <span className="dsh-bar__tip se-tip" style={{ bottom: h + 28 }}>₹{(x.total / 1000).toFixed(1)}K</span>}
                <div className="dsh-bar__fill se-grow-y" style={{ height: h, animationDelay: `${500 + i * 80}ms` }} />
                <span className="dsh-bar__m">{x.short.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Category × month table, sticky first column, selected month highlighted, % vs previous month. */
export function SpendingMatrix({ matrix, selKey, budget = 0, delay = 440 }) {
  const scroller = useRef(null);
  useEffect(() => {
    // Start scrolled to the most recent months.
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [matrix]);
  if (!matrix) return null;
  const cols = `120px repeat(${matrix.months.length}, 90px) 100px`;
  const width = 120 + matrix.months.length * 90 + 100;

  return (
    <section className="dsh-sec se-in" style={{ animationDelay: `${delay}ms`, gap: 12 }}>
      <SectionChip icon="M4 4h16v16H4zM4 10h16M10 4v16" title="Spending matrix" count={matrix.rows.length}>
        <span className="dsh-hint" aria-hidden="true">% VS PREV MONTH →</span>
      </SectionChip>
      <div className="dsh-matrix se-glass" ref={scroller} role="region" aria-label="Spending by category and month" tabIndex={0}>
        <div style={{ width }} role="table">
          <div className="dsh-mx-row dsh-mx-head" style={{ gridTemplateColumns: cols }} role="row">
            <span className="dsh-mx-sticky" role="columnheader">CATEGORY</span>
            {matrix.months.map(m => (
              <span key={m.key} className="dsh-mx-num" role="columnheader" style={{ color: m.key === selKey ? 'var(--se-text)' : undefined }}>{m.short}</span>
            ))}
            <span className="dsh-mx-num" role="columnheader" style={{ color: 'var(--se-text)', paddingRight: 16 }}>TOTAL</span>
          </div>
          {matrix.rows.map((r, ri) => (
            <div key={r.id} className="dsh-mx-row dsh-mx-body se-row" style={{ gridTemplateColumns: cols, animationDelay: `${600 + Math.min(ri, 8) * 70}ms` }} role="row">
              <span className="dsh-mx-sticky" role="rowheader"><LineIcon path={r.icon.path} size={14} strokeWidth={1.8} /><span>{r.name}</span></span>
              {r.cells.map(c => (
                <span key={c.key} className={`dsh-mx-cell ${c.key === selKey ? 'on' : ''}`} role="cell">
                  <b>{c.v ? fmt(c.v) : '—'}</b>
                  {c.d != null
                    ? <i className={c.d < 0 ? 'pos-ink' : 'neg-ink'}>{c.d < 0 ? '▼' : '▲'}{Math.abs(c.d).toFixed(0)}%</i>
                    : <i>—</i>}
                </span>
              ))}
              <span className="dsh-mx-total" role="cell">₹{fmt(r.total)}</span>
            </div>
          ))}
          <div className="dsh-mx-row dsh-mx-foot" style={{ gridTemplateColumns: cols }} role="row">
            <span className="dsh-mx-sticky" role="rowheader">Grand total</span>
            {matrix.totals.map(t => (
              <span key={t.key} className={`dsh-mx-num ${budget && t.v > budget ? 'neg-ink' : ''}`} role="cell">₹{fmt(t.v)}</span>
            ))}
            <span className="dsh-mx-num se-grad-text" style={{ paddingRight: 16 }} role="cell">₹{fmt(matrix.grand)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
