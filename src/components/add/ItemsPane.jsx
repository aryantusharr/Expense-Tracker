import { useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';
import CategoryIcon, { LineIcon } from '../ui/CategoryIcon';
import { resolveCategoryIcon } from '../../design/categoryIcons';
import { initialOf, localDateStr, shortDay } from '../dashboard/dashboardData';
import SlipsStrip from './SlipsStrip';
import SlideToAdd from './SlideToAdd';
import SaveMoment from './SaveMoment';
import DateChips from './DateChips';
import { TextField } from '../ui/Keyboard';
import { evaluateMathExpression, matchChips } from './addHelpers';

const fmtN = n => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Receipt paper (spec §6): mono type, dashed rules, dotted leaders, zigzag bottom, ink stamps before items. */
function Receipt({ name, total, rows, remaining, members, categories, isPersonal, date, muted, onRemove, onDate }) {
  const empty = !name && !total;
  const stamp = id => resolveCategoryIcon(categories.find(c => c.id === id));
  const who = split => (split.length === members.length ? 'ALL' : members.filter(m => split.includes(m.id)).map(m => initialOf(m.name)).join(''));
  return (
    <>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="ib-worn"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" /></filter>
    </svg>
    <div className={`ib-paper se-print ${muted ? 'ib-paper--muted' : ''}`}>
      <div className="ib-paper__head">
        <span className="ib-paper__brand">NEW BILL</span>
        <label className="ib-paper__date">
          {date === localDateStr() ? 'TODAY' : shortDay(date)}
          <input type="date" value={date} max={localDateStr()} onChange={e => e.target.value && onDate(e.target.value)} aria-label="Bill date" />
        </label>
      </div>
      <div className="ib-rule" />
      <div className="ib-paper__title">{name || (empty ? 'Bill name' : '—')}</div>
      <div className="ib-line ib-line--total"><span>TOTAL</span><i /><b>₹{fmtN(total || 0)}</b></div>
      {rows.length > 0 && <div className="ib-rule" />}
      {rows.map(r => {
        const ic = stamp(r.categoryId);
        return (
          <div className="ib-line ib-item se-pop" key={r.id}>
            <span className="ib-stamp" aria-hidden="true"><LineIcon path={ic.path} size={14} strokeWidth={2} /></span>
            <span className="ib-item__name">{r.description}{!isPersonal && <em>{who(r.splitAmong)}</em>}</span>
            <i />
            <b>₹{fmtN(parseFloat(r.amount) || 0)}</b>
            <button type="button" className="ib-x" aria-label={`Remove ${r.description}`} onClick={() => onRemove(r.id)}>×</button>
          </div>
        );
      })}
      {rows.length > 0 && (
        <>
          <div className="ib-rule" />
          <div className={`ib-line ib-left ${Math.abs(remaining) < 0.01 ? 'ib-left--ok' : remaining < 0 ? 'ib-left--over' : ''}`}>
            <span>{Math.abs(remaining) < 0.01 ? 'FULLY SPLIT' : remaining < 0 ? 'OVER BY' : 'LEFT TO SPLIT'}</span>
            <i />
            <b>{Math.abs(remaining) < 0.01 ? '✓' : `₹${fmtN(Math.abs(remaining))}`}</b>
          </div>
        </>
      )}
      <span className="ib-zig" aria-hidden="true" />
    </div>
    </>
  );
}

export default function ItemsPane({ c }) {
  const toast = useToast();
  const { form, setField, isPersonal, members, sortedCategories: cats } = c;
  const [stage, setStage] = useState('setup');          // setup → bill
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState({ description: '', amount: '', categoryId: '', splitAmong: [] });
  const [auto, setAuto] = useState(false);
  const [manual, setManual] = useState(false); // tapped a category for this line — don't auto-change it
  const [shake, setShake] = useState(0);
  const [slideShake, setSlideShake] = useState(0);
  const [saved, setSaved] = useState(null);

  const total = parseFloat(c.billTotal) || 0;
  const ready = total > 0 && c.billName.trim() && (isPersonal || form.paidBy);
  const draftAmt = parseFloat(draft.amount) || 0;
  const draftProblem = !draft.description.trim() ? 'Add a description' : !(draftAmt > 0) ? 'Enter an amount' : !draft.categoryId ? 'Pick a category' : (!isPersonal && draft.splitAmong.length === 0) ? 'Pick who to split with' : '';

  const evalTotal = () => { const v = evaluateMathExpression(c.billTotal); if (v !== null) c.setBillTotal(String(v)); };
  const evalDraft = () => { const v = evaluateMathExpression(draft.amount); if (v !== null) setDraft(d => ({ ...d, amount: String(v) })); };

  const start = () => {
    if (!ready) { haptic('error'); setShake(s => s + 1); toast({ kind: 'error', message: <b>{total <= 0 ? 'Enter a total' : 'Add a bill name'}</b> }); return; }
    haptic('choose');
    setStage('bill');
    openDraft();
  };

  const openDraft = () => {
    const last = c.rows[c.rows.length - 1];
    const left = c.rows.length === 0 ? total : c.remaining;
    setDraft({
      description: '',
      amount: left > 0 ? String(left) : '',
      categoryId: last?.categoryId || '',
      splitAmong: isPersonal ? [] : (last?.splitAmong || form.splitAmong),
    });
    setAuto(false);
    setManual(false);
    setDrafting(true);
  };

  const setDesc = val => {
    const next = manual ? null : c.guessCat(val);
    setDraft(d => ({ ...d, description: val, ...(next ? { categoryId: next } : {}) }));
    if (next) setAuto(true);
  };

  const toggleSeat = id => setDraft(d => ({ ...d, splitAmong: d.splitAmong.includes(id) ? d.splitAmong.filter(x => x !== id) : [...d.splitAmong, id] }));

  const print = () => {
    if (draftProblem) { haptic('error'); setShake(s => s + 1); toast({ kind: 'error', message: <b>{draftProblem}</b> }); return; }
    haptic('choose');
    c.addRow({ ...draft, description: draft.description.trim() });
    setDrafting(false);
  };

  const totalField = useRef(null);   // Next: bill name → total, item → amount
  const amountField = useRef(null);
  const nudge = useRef(null);     // budget nudge, shown once the save moment is over
  const pending = useRef(null);   // the save, running while the receipt prints
  const fail = message => { nudge.current = null; setSaved(null); toast({ kind: 'error', message: <b>{message}</b> }); setSlideShake(s => s + 1); };
  const confirm = async () => {
    if (c.billProblem) { fail(c.billProblem); return; }
    nudge.current = c.budgetNudge(total, form.date);
    // Print straight away; the save runs underneath. A failed save stops the print and keeps the bill.
    const payer = members.find(m => m.id === form.paidBy);
    setSaved({
      title: c.billName.trim(), date: form.date, total, room: c.room?.name || c.roomCode,
      paid: isPersonal ? '' : `${(payer?.name || '').replace(/^test[\s_-]+/i, '').toUpperCase()} PAID`,
      lines: c.rows.map(r => ({ name: r.description, amount: parseFloat(r.amount), iconPath: resolveCategoryIcon(cats.find(x => x.id === r.categoryId)).path })),
    });
    pending.current = c.submitBill();
    const res = await pending.current;
    if (!res.ok) fail(res.message);
  };
  const finish = async () => {
    const res = await pending.current;
    pending.current = null;
    if (!res?.ok) return;   // already shown as an error
    setSaved(null); c.resetBill(); setStage('setup'); setDrafting(false);
    if (nudge.current) { if (nudge.current.kind === 'warn') haptic('error'); toast({ ...nudge.current, duration: 5000 }); nudge.current = null; }
  };

  const names = c.itemisedGroupNamesList.map(g => g.groupName);

  return (
    <div className="add-quick ib">
      {saved && <SaveMoment {...saved} onDone={finish} />}
      <Receipt
        name={c.billName.trim()} total={total} rows={c.rows} remaining={c.remaining}
        members={members} categories={cats} isPersonal={isPersonal} date={form.date}
        muted={stage === 'setup' && !c.billName && !total} onRemove={id => { haptic('tap'); c.removeRow(id); }} onDate={setField.date}
      />

      {stage === 'setup' && (
        <div className="add-form se-in">
          <div className="add-field">
            <span className="add-field__label">BILL NAME</span>
            <TextField className="add-input" value={c.billName} onChange={c.setBillName} placeholder="e.g. Dinner at Social" maxLength={60} caps="words" aria-label="Bill name" next={totalField}
              suggestions={matchChips(names, c.billName).map(n => ({ label: n, onPick: () => c.setBillName(n) }))} />
          </div>
          <div className="add-field">
            <span className="add-field__label">TOTAL</span>
            <TextField className="add-input se-mono" kind="amount" fieldRef={totalField} value={c.billTotal} onChange={c.setBillTotal} onBlur={evalTotal} placeholder="₹ 0" maxLength={40} aria-label="Total" />
          </div>
          {!isPersonal && (
            <SlipsStrip members={members} paidBy={form.paidBy} splitAmong={form.splitAmong} amount={total} onPayer={id => setField.paidBy(id)} onToggle={c.toggleSplit} payerOnly />
          )}
          <DateChips value={form.date} onChange={setField.date} />
          <div key={shake} className={shake ? 'se-shake' : ''}>
            <Button block size="lg" className={ready ? '' : 'ib-btn--dim'} onClick={start}>Start adding items</Button>
          </div>
        </div>
      )}

      {stage === 'bill' && drafting && (
        <div className="add-form se-in ib-panel">
          <div className="add-field">
            <span className="add-field__label">ITEM</span>
            <TextField className="add-input" value={draft.description} onChange={setDesc} placeholder="What was it for?" maxLength={80} aria-label="Item" next={amountField}
              suggestions={matchChips(c.itemChips, draft.description).map(d => ({ label: d, onPick: () => setDesc(d) }))} />
          </div>
          <div className="add-field">
            <span className="add-field__label">AMOUNT</span>
            <TextField className="add-input se-mono" kind="amount" fieldRef={amountField} value={draft.amount} onChange={v => setDraft(d => ({ ...d, amount: v }))} onBlur={evalDraft} placeholder="₹ 0" maxLength={40} aria-label="Item amount" />
          </div>
          <div className="add-field">
            <span className="add-field__label">CATEGORY</span>
            <div className="add-cats" data-noswipe role="group" aria-label="Category">
              {cats.map(cat => {
                const on = draft.categoryId === cat.id;
                return (
                  <button key={cat.id} type="button" className={`add-cat ${on ? 'add-cat--on' : ''}`} aria-pressed={on} onClick={() => { haptic('choose'); setAuto(false); setManual(true); setDraft(d => ({ ...d, categoryId: cat.id })); }}>
                    <CategoryIcon category={cat} size={28} />
                    <span>{cat.name}</span>
                    {on && auto && <b className="add-cat__auto">AUTO</b>}
                  </button>
                );
              })}
            </div>
          </div>
          {!isPersonal && (
            <SlipsStrip members={members} paidBy={form.paidBy} splitAmong={draft.splitAmong} amount={draftAmt} onPayer={id => setField.paidBy(id)} onToggle={toggleSeat} hidePayer />
          )}
          <div key={`d${shake}`} className={shake ? 'se-shake' : ''}>
            <Button block size="lg" className={draftProblem ? 'ib-btn--dim' : ''} onClick={print}>Print to receipt</Button>
          </div>
          {c.rows.length > 0 && <button type="button" className="ib-link" onClick={() => setDrafting(false)}>Cancel item</button>}
        </div>
      )}

      {stage === 'bill' && !drafting && (
        <div className="add-form se-in">
          {c.remaining > 0.009 && (
            <Button block variant="ghost" onClick={() => { haptic('choose'); openDraft(); }}>Add item</Button>
          )}
          <SlideToAdd problem={c.billProblem} busy={c.saving} shakeKey={slideShake} onBlocked={() => { setSlideShake(s => s + 1); toast({ kind: 'error', message: <b>{c.billProblem}</b> }); }} onConfirm={confirm} />
          <button type="button" className="ib-link" onClick={() => { c.resetBill(); setStage('setup'); }}>Start over</button>
        </div>
      )}
    </div>
  );
}
