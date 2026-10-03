import { useState } from 'react';
import { haptic } from '../../utils/haptics';
import { TextField } from '../ui/Keyboard';
import CategoryIcon from '../ui/CategoryIcon';
import DateChips from '../add/DateChips';
import { evalExpr } from '../add/amountExpr';
import { initialOf, shortDay, localDateStr } from '../dashboard/dashboardData';
import { fmtINR, cleanName } from '../../aai/common.js';
import '../add/Add.css';

/**
 * AAI answer cards — boards Bot-Functions (style A glass card) + Bot-Live-Edit-Toast (T1–T3, E1, E2).
 * Tap one value → dashed violet outline, only that control opens. Edit = show every tappable value.
 */

const each = (amount, n) => {
  const v = n ? amount / n : 0;
  return Number.isInteger(v) ? fmtINR(v) : `₹${v.toFixed(2)}`;
};

export function Mono({ m, dim = false }) {
  return <span className={`aai-mono ${dim ? 'is-dim' : ''}`} style={{ '--c': m.color }}>{initialOf(m.name)}</span>;
}

function Actions({ actions, onAction, onEdit, editHints }) {
  return (
    <div className="aai-acts">
      {actions.map(a => (
        <button key={a.label} type="button" className={`aai-btn ${a.primary ? 'aai-btn--go' : ''}`} disabled={a.disabled}
          onClick={() => { haptic(a.primary ? 'choose' : 'tap'); onAction?.(a); }}>{a.label}</button>
      ))}
      {onEdit && (
        <button type="button" className={`aai-btn ${editHints ? 'is-on' : ''}`} aria-pressed={editHints}
          onClick={() => { haptic('tap'); onEdit(); }}>Edit</button>
      )}
    </div>
  );
}

/** The glass card shell: title + sub on the left, big value on the right. */
export function Card({ title, sub, value, tone, children, actions = [], onAction, onEdit, editHints, valueNode }) {
  return (
    <div className={`aai-card-wrap ${tone ? `aai-tone--${tone}` : ''}`}>
      <div className="aai-card">
        <div className="aai-card__main">
          <div className="aai-card__title">{title}</div>
          {sub && <div className="aai-card__sub">{sub}</div>}
          {children}
        </div>
        {valueNode || <span className="aai-card__val">{value}</span>}
      </div>
      {(actions.length > 0 || onEdit) && <Actions actions={actions} onAction={onAction} onEdit={onEdit} editHints={editHints} />}
    </div>
  );
}

/** A tappable value inside a card. */
function Tok({ on, hint, onClick, children, className = '', label }) {
  return (
    <button type="button" className={`aai-tok ${on ? 'is-on' : ''} ${hint ? 'is-hint' : ''} ${className}`} aria-label={label} aria-pressed={on}
      onClick={() => { haptic('tap'); onClick(); }}>{children}</button>
  );
}

const STEPS = [-50, -10, 10, 50];

/**
 * One expense, editable in place. draft = { amount, description, categoryId, date, paidBy, splitAmong }.
 * question: the parser's first question (pick split / which person) — shown under the card.
 */
export function ExpenseCard({ draft, onChange, members, categories, meId, isPersonal, question, onConfirm, confirmLabel = 'Confirm' }) {
  const [editing, setEditing] = useState(null);       // 'amount' | 'people' | 'payer' | 'category' | 'date'
  const [hints, setHints] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const toggle = k => {
    if (k === 'amount') setAmountStr(draft.amount > 0 ? String(Math.round(draft.amount * 100) / 100) : '');
    setEditing(e => (e === k ? null : k));
  };
  const set = patch => onChange({ ...draft, ...patch });
  const setAmount = s => { setAmountStr(s); set({ amount: evalExpr(s) }); };
  const bump = d => {
    haptic('tap');
    const next = Math.max(0, Math.round(((draft.amount || 0) + d) * 100) / 100);
    setAmountStr(next ? String(next) : '');
    set({ amount: next });
  };

  const cat = categories.find(c => c.id === draft.categoryId);
  const payer = members.find(m => m.id === draft.paidBy);
  const split = draft.splitAmong || [];
  const all = members.length > 0 && split.length === members.length;
  const payerName = !payer ? 'who?' : payer.id === meId ? 'you' : cleanName(payer.name);
  const dateLabel = shortDay(draft.date, { upper: false });
  const ok = draft.amount > 0 && (isPersonal || (draft.paidBy && split.length > 0));

  const amountNode = editing === 'amount' ? (
    <TextField kind="amount" value={amountStr} onChange={setAmount} autoFocus className="aai-amt-field" placeholder="0"
      prefix={<span className="aai-amt-field__r">₹</span>} onDone={() => setEditing(null)} aria-label="Amount"
      slotContent={(
        <div className="aai-steps" role="group" aria-label="Adjust amount">
          {STEPS.map(d => <button key={d} type="button" className="aai-step" onClick={() => bump(d)}>{d > 0 ? `+${d}` : `−${-d}`}</button>)}
        </div>
      )} />
  ) : (
    <Tok on={false} hint={hints || !(draft.amount > 0)} onClick={() => toggle('amount')} className="aai-card__val" label="Change amount">
      {draft.amount > 0 ? fmtINR(draft.amount) : '₹—'}
    </Tok>
  );

  const catTok = (
    <Tok on={editing === 'category'} hint={hints || !cat} onClick={() => toggle('category')} label="Change category">
      {cat?.name || 'Category'}
    </Tok>
  );
  const dateTok = <Tok on={editing === 'date'} hint={hints} onClick={() => toggle('date')} label="Change date">{dateLabel}</Tok>;

  const sub = isPersonal ? (
    <>Personal · {catTok} · {dateTok}</>
  ) : (
    <>
      {catTok} · paid by <Tok on={editing === 'payer'} hint={hints || !payer} onClick={() => toggle('payer')} label="Change who paid">{payerName}</Tok>
      {' · '}{all ? `split all ${split.length}` : `split ${split.length} · ${each(draft.amount, split.length)} each`} · {dateTok}
    </>
  );

  return (
    <div className="aai-card-wrap">
      <div className="aai-card">
        <div className="aai-card__main">
          <div className="aai-card__title">{draft.description || 'Expense'}</div>
          <div className="aai-card__sub">{sub}</div>
          {!isPersonal && members.length > 0 && (
            <Tok on={editing === 'people'} hint={hints} onClick={() => toggle('people')} className="aai-monos" label="Change who’s in the split">
              {members.map(m => <Mono key={m.id} m={m} dim={!split.includes(m.id)} />)}
            </Tok>
          )}
        </div>
        {amountNode}
      </div>

      {question && !editing && (
        <button type="button" className="aai-q" onClick={() => toggle(question.kind === 'pickSplit' ? 'people' : 'payer')}>{question.message || `Which ${question.name}?`}</button>
      )}

      {editing === 'people' && (
        <div className="aai-edit aai-edit--row" role="group" aria-label="Who’s in the split">
          {members.map(m => {
            const inn = split.includes(m.id);
            return (
              <button key={m.id} type="button" className="aai-pchip" aria-pressed={inn}
                onClick={() => { haptic('choose'); set({ splitAmong: inn ? (split.length > 1 ? split.filter(x => x !== m.id) : split) : members.map(x => x.id).filter(id => id === m.id || split.includes(id)) }); }}>
                <Mono m={m} dim={!inn} /><span>{m.id === meId ? 'You' : cleanName(m.name)}</span>
              </button>
            );
          })}
        </div>
      )}
      {editing === 'payer' && (
        <div className="aai-edit aai-edit--row" role="radiogroup" aria-label="Who paid">
          <span className="aai-edit__lab">PAID BY</span>
          {members.map(m => (
            <button key={m.id} type="button" role="radio" className="aai-pchip" aria-checked={draft.paidBy === m.id} aria-pressed={draft.paidBy === m.id}
              onClick={() => { haptic('choose'); set({ paidBy: m.id }); setEditing(null); }}>
              <Mono m={m} dim={draft.paidBy !== m.id} /><span>{m.id === meId ? 'You' : cleanName(m.name)}</span>
            </button>
          ))}
        </div>
      )}
      {editing === 'category' && (
        <div className="aai-edit aai-edit--row" role="radiogroup" aria-label="Category">
          {categories.map(c => (
            <button key={c.id} type="button" role="radio" className="aai-cchip" aria-checked={draft.categoryId === c.id}
              onClick={() => { haptic('choose'); set({ categoryId: c.id }); setEditing(null); }}>
              <CategoryIcon category={c} size={28} /><span>{c.name}</span>
            </button>
          ))}
        </div>
      )}
      {editing === 'date' && (
        <div className="aai-edit aai-edit--date">
          <DateChips value={draft.date || localDateStr()} onChange={d => { set({ date: d, dateGiven: true }); setEditing(null); }} />
        </div>
      )}

      <Actions actions={[{ label: confirmLabel, primary: true, disabled: !ok }]} onAction={() => onConfirm?.(draft)}
        onEdit={() => setHints(h => !h)} editHints={hints} />
    </div>
  );
}

/** "chai 40, auto 120, sabzi 230" → 3 expenses, or 1 bill with 3 items (tap to switch). */
export function ManyCard({ intent, asBill, onToggle, onConfirm }) {
  const n = intent.count;
  return (
    <Card
      title={asBill ? `1 bill · ${fmtINR(intent.total)}` : `${n} found · ${fmtINR(intent.total)}`}
      sub={<Tok on={false} hint onClick={onToggle} label="Switch between separate expenses and one bill">{asBill ? `or ${n} separate expenses` : `or 1 bill with ${n} items`}</Tok>}
      value={asBill ? `${n} items` : `${n} expenses`}
      actions={[{ label: 'Confirm', primary: true }]}
      onAction={onConfirm}
    >
      <div className="aai-lines">
        {intent.expenses.map((e, i) => <span key={i}><b>{e.description || 'Expense'}</b>{fmtINR(e.amount)}</span>)}
      </div>
    </Card>
  );
}

/** Typed bill: "dmart 1240: atta 320 all, chips 90 me+ravi, rest all". */
export function BillCard({ intent, members, meId, onConfirm }) {
  const payer = members.find(m => m.id === intent.paidBy);
  const who = !payer ? 'who paid?' : payer.id === meId ? 'paid by you' : `paid by ${cleanName(payer.name)}`;
  const items = intent.lines.length + (intent.rest ? 1 : 0);
  const sub = intent.mismatch
    ? (intent.restAmount < 0 ? `Items are ${fmtINR(-intent.restAmount)} more than the total` : `${fmtINR(intent.restAmount)} not covered · add "rest all"`)
    : `${who} · ${items} ${items === 1 ? 'line' : 'lines'}${intent.rest ? ` · rest ${fmtINR(intent.rest.amount)}` : ''}`;
  return (
    <Card title={intent.merchant || 'Bill'} sub={sub} value={fmtINR(intent.total)} tone={intent.mismatch ? 'neg' : undefined}
      actions={[{ label: 'Confirm', primary: true, disabled: intent.mismatch || !payer }]} onAction={onConfirm}>
      <div className="aai-lines">
        {intent.lines.map((l, i) => <span key={i}><b>{l.description || 'Item'}</b>{fmtINR(l.amount)}</span>)}
        {intent.rest && <span><b>Rest</b>{fmtINR(intent.rest.amount)}</span>}
      </div>
    </Card>
  );
}
