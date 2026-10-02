import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';
import CategoryIcon from '../ui/CategoryIcon';
import AmountOdometer from './AmountOdometer';
import Keypad from './Keypad';
import { SuggestBar, TextField } from '../ui/Keyboard';
import SlipsStrip from './SlipsStrip';
import SlideToAdd from './SlideToAdd';
import SaveMoment from './SaveMoment';
import DateChips from './DateChips';
import { resolveCategoryIcon } from '../../design/categoryIcons';
import { evalExpr, hasOperator, pressKey } from './amountExpr';
import { matchChips } from './addHelpers';

const QUICK_ADDS = [50, 100, 200, 500];
const nameOf = m => (m?.name || '').replace(/^test[\s_-]+/i, '') || m?.name || '';
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
  const [saved, setSaved] = useState(null);
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

  // Fill the amount, let the odometer roll, then move on to the description page.
  const recTimer = useRef(null);
  useEffect(() => () => clearTimeout(recTimer.current), []);
  const applyRecurring = chip => {
    haptic('choose');
    c.applyRecurring(chip);
    setExpr(String(chip.lastAmount));
    clearTimeout(recTimer.current);
    if (Number(chip.lastAmount) > 0) recTimer.current = setTimeout(() => setView('form'), 450);
  };

  const blocked = () => {
    setShake(s => s + 1);
    toast({ kind: 'error', message: <b>{c.problem}</b> });
  };

  const nudge = useRef(null);     // budget nudge, shown once the save moment is over
  const pending = useRef(null);   // the save, running while the receipt prints
  const fail = message => { nudge.current = null; setSaved(null); toast({ kind: 'error', message: <b>{message}</b> }); setShake(s => s + 1); };
  const confirm = async () => {
    const err = c.quickCheck();
    if (err) { fail(err); return; }
    nudge.current = c.budgetNudge(amount, form.date);
    // Print straight away; the save runs underneath. A failed save stops the print and keeps the form.
    const cat = c.sortedCategories.find(x => x.id === form.categoryId);
    const payer = members.find(m => m.id === form.paidBy);
    const n = form.splitAmong.length;
    const title = form.description.trim();
    setSaved({
      title, date: form.date, total: amount, room: c.room?.name || c.roomCode,
      paid: isPersonal ? '' : `${nameOf(payer)} PAID`,
      lines: [{ name: title, amount, iconPath: cat ? resolveCategoryIcon(cat).path : undefined }],
      rows: isPersonal || n < 1 ? [] : [{ a: `SPLIT ${n} WAYS`, b: `${n} × ${fmtN(Math.round(amount / n * 100) / 100)}` }],
    });
    pending.current = c.submitQuick();
    const res = await pending.current;
    if (!res.ok) fail(res.message);
  };
  const finish = async () => {
    const res = await pending.current;
    pending.current = null;
    if (!res?.ok) return;   // already shown as an error
    setSaved(null); c.resetQuick(); setExpr(''); setView('amount');
    if (nudge.current) { if (nudge.current.kind === 'warn') haptic('error'); toast({ ...nudge.current, duration: 5000 }); nudge.current = null; }
  };

  const count = isPersonal ? 1 : form.splitAmong.length;

  return (
    <div className="add-quick">
      {saved && <SaveMoment {...saved} onDone={finish} />}
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
          <div className="add-padzone">
            <SuggestBar className="kb-sugg--page" items={c.recurringExpensesList.slice(0, 8).map(r => ({
              key: r.description, rec: true, label: `${r.description} · ₹${fmtN(Number(r.lastAmount) || 0)}`, onPick: () => applyRecurring(r),
            }))} />
            <Keypad onKey={onKey} />
            <Button block size="lg" onClick={done}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="add-form se-in">
          <div className="add-field">
            <span className="add-field__label">DESCRIPTION</span>
            <TextField className="add-input" value={form.description} onChange={c.setDescription} placeholder="What was it for?" maxLength={80} aria-label="Description"
              suggestions={matchChips(c.filteredChips, form.description).map(d => ({ label: d, onPick: () => c.setDescription(d) }))} />
          </div>

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

          <DateChips value={form.date} onChange={d => setField.date(d)} />

          <SlideToAdd problem={c.problem} busy={c.saving} shakeKey={shake} onBlocked={blocked} onConfirm={confirm} />
        </div>
      )}
    </div>
  );
}
