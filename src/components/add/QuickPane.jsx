import { useEffect, useMemo, useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';
import CategoryIcon from '../ui/CategoryIcon';
import { localDateStr, shortDay } from '../dashboard/dashboardData';
import AmountOdometer from './AmountOdometer';
import Keypad from './Keypad';
import SlipsStrip from './SlipsStrip';
import SlideToAdd from './SlideToAdd';
import { evalExpr, hasOperator, pressKey } from './amountExpr';

const QUICK_ADDS = [50, 100, 200, 500];
const fmtN = n => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

function AmountCard({ amount, expr, isPersonal, count, onEdit }) {
  const each = count > 0 ? amount / count : 0;
  const pill = isPersonal ? 'PERSONAL' : `₹${fmtN(Math.round(each * 100) / 100)} EACH · ${count}`;
  const showExpr = expr && (hasOperator(expr) || /[.]$/.test(expr));
  return (
    <div className={`add-amt ${amount > 0 ? 'add-amt--on' : ''}`}>
      <span className="add-amt__sheen" aria-hidden="true" />
      <div className="add-amt__top">
        <span className="add-amt__label">AMOUNT</span>
        {amount > 0 && <span className="add-amt__pill se-pop" key={pill}>{pill}</span>}
      </div>
      <div className="add-amt__num se-display">
        <span className="add-amt__rupee">₹</span>
        <AmountOdometer value={amount} height={52} />
        {onEdit && (
          <button type="button" className="add-amt__edit" aria-label="Edit amount" onClick={() => { haptic('tap'); onEdit(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>
      <div className="add-amt__expr se-mono" aria-live="polite">
        {showExpr ? `${expr}${hasOperator(expr) ? ` = ${fmtN(amount)}` : ''}` : ' '}
      </div>
    </div>
  );
}

export default function QuickPane({ c }) {
  const toast = useToast();
  const { form, setField, isPersonal, members } = c;
  const [view, setView] = useState('amount');            // amount (keypad) → form
  const [expr, setExpr] = useState('');
  const [shake, setShake] = useState(0);
  const [amountShake, setAmountShake] = useState(0);
  const amount = parseFloat(form.amount) || 0;
  const catStrip = useRef(null);

  // Bring the picked / auto-picked category into view.
  useEffect(() => {
    catStrip.current?.querySelector('.add-cat--on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [form.categoryId, view]);

  const setAmountFromExpr = next => { setExpr(next); setField.amount(evalExpr(next) ? String(evalExpr(next)) : ''); };
  const onKey = k => setAmountFromExpr(pressKey(expr, k));
  const quickAdd = n => { haptic('tap'); setAmountFromExpr(String(Math.round((evalExpr(expr) + n) * 100) / 100)); };

  const done = () => {
    if (!(amount > 0)) {
      haptic('error');
      setAmountShake(s => s + 1);
      toast({ kind: 'error', message: <b>Enter an amount first</b> });
      return;
    }
    setExpr(String(amount));   // fold: keep the evaluated value as the editable expression
    setView('form');
  };

  const applyRecurring = chip => { haptic('choose'); c.applyRecurring(chip); setExpr(String(chip.lastAmount)); };

  const blocked = () => {
    setShake(s => s + 1);
    toast({ kind: 'error', message: <b>{c.problem}</b> });
  };

  const confirm = async () => {
    const res = await c.submitQuick();
    if (!res.ok) { toast({ kind: 'error', message: <b>{res.message}</b> }); setShake(s => s + 1); return; }
    // Print-to-receipt animation arrives in chunk 3; for now a toast + fresh form.
    toast({ kind: 'success', message: <><b>₹{fmtN(res.amount)}</b> added · {res.description}</> });
    c.resetQuick();
    setExpr('');
    setView('amount');
  };

  // Date strip: today / yesterday / 2 days ago + a picker.
  const dates = useMemo(() => [0, 1, 2].map(n => { const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d); }), []);
  const customDate = !dates.includes(form.date);

  const count = isPersonal ? 1 : form.splitAmong.length;

  return (
    <div className="add-quick">
      <div key={amountShake} className={amountShake ? 'se-shake' : ''}>
        <AmountCard amount={amount} expr={expr} isPersonal={isPersonal} count={count} onEdit={view === 'form' ? () => setView('amount') : null} />
      </div>

      {view === 'amount' ? (
        <div className="add-amount-page se-in">
          <div className="add-chips" data-noswipe>
            {QUICK_ADDS.map(n => (
              <button key={n} type="button" className="se-chip" onClick={() => quickAdd(n)}>+₹{n}</button>
            ))}
          </div>
          {c.recurringExpensesList.length > 0 && (
            <div className="add-chips add-chips--scroll" data-noswipe aria-label="Repeat a recent expense">
              {c.recurringExpensesList.slice(0, 6).map(r => (
                <button key={r.description} type="button" className="se-chip add-rec" onClick={() => applyRecurring(r)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {r.description} · ₹{fmtN(Number(r.lastAmount) || 0)}
                </button>
              ))}
            </div>
          )}
          {!isPersonal && (
            <SlipsStrip
              members={members}
              paidBy={form.paidBy}
              splitAmong={form.splitAmong}
              amount={amount}
              onPayer={id => setField.paidBy(id)}
              onToggle={c.toggleSplit}
            />
          )}
          <Keypad onKey={onKey} />
          <Button block size="lg" onClick={done}>Done</Button>
        </div>
      ) : (
        <div className="add-form se-in">
          <label className="add-field">
            <span className="add-field__label">DESCRIPTION</span>
            <input
              className="add-input"
              value={form.description}
              onChange={e => c.setDescription(e.target.value)}
              placeholder="What was it for?"
              enterKeyHint="done"
              autoComplete="off"
              maxLength={80}
            />
          </label>
          {c.filteredChips.length > 0 && !form.description && (
            <div className="add-chips add-chips--scroll" data-noswipe aria-label="Recent descriptions">
              {c.filteredChips.slice(0, 8).map(d => (
                <button key={d} type="button" className="se-chip" onClick={() => c.setDescription(d)}>{d}</button>
              ))}
            </div>
          )}

          <div className="add-field">
            <span className="add-field__label">CATEGORY {!form.categoryId && <em>· auto-picks from your description</em>}</span>
            <div className="add-cats" ref={catStrip} data-noswipe role="group" aria-label="Category">
              {c.sortedCategories.map(cat => {
                const on = form.categoryId === cat.id;
                return (
                  <button key={cat.id} type="button" className={`add-cat ${on ? 'add-cat--on' : ''}`} aria-pressed={on} onClick={() => { haptic('choose'); c.pickCategory(cat.id); }}>
                    <CategoryIcon category={cat} size={28} />
                    <span>{cat.name}</span>
                    {on && c.autoCat && <b className="add-cat__auto">AUTO</b>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="add-field">
            <span className="add-field__label">DATE</span>
            <div className="add-chips add-chips--scroll" data-noswipe>
              {dates.map((d, i) => (
                <button key={d} type="button" className="se-chip" aria-pressed={form.date === d} onClick={() => { haptic('choose'); setField.date(d); }}>
                  {i === 0 ? 'Today' : i === 1 ? 'Yday' : shortDay(d, { upper: false })}
                </button>
              ))}
              <label className="se-chip add-datepick" aria-pressed={customDate}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM4 11h16M8 4v4M16 4v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {customDate ? shortDay(form.date, { upper: false }) : 'Pick date'}
                <input type="date" value={form.date} max={localDateStr()} onChange={e => e.target.value && setField.date(e.target.value)} aria-label="Pick a date" />
              </label>
            </div>
          </div>

          <SlideToAdd problem={c.problem} busy={c.saving} shakeKey={shake} onBlocked={blocked} onConfirm={confirm} />
        </div>
      )}
    </div>
  );
}
