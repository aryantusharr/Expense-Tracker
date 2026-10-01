import { useState } from 'react';
import Sheet from '../ui/Sheet';
import CategoryIcon from '../ui/CategoryIcon';
import { haptic } from '../../utils/haptics';
import { localDateStr, MONTHS_SHORT } from '../dashboard/dashboardData';

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const prettyDate = d => { const [y, m, dd] = d.split('-').map(Number); return `${dd} ${MONTHS_SHORT[m - 1]} ${y}`; };

/**
 * Board 6b: the expense as a paper receipt. Tap one line → dashed violet outline + caret and
 * only that line's control appears underneath (amount ± chips, category chips, date strip …).
 * Mounted fresh per expense (key) so the draft starts from the saved values.
 */
export default function EditSheet({ expense, users, categories, isPersonal, meId, onClose, onSave }) {
  const [d, setD] = useState(() => ({
    description: expense.description || '',
    categoryId: expense.categoryId,
    date: expense.date,
    paidBy: expense.paidBy,
    splitAmong: expense.splitAmong || [],
    amount: parseFloat(expense.amount) || 0,
    groupName: expense.groupName || '',
  }));
  const [field, setField] = useState('amt');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const name = id => (id === meId ? 'You' : users.find(u => u.id === id)?.name || '—');
  const cat = categories.find(c => c.id === d.categoryId);
  const bill = expense.isItemised && expense.groupId;

  const days = [0, 1, 2, 3, 4].map(n => { const t = new Date(); t.setDate(t.getDate() - n); return { key: localDateStr(t), wd: n === 0 ? 'TODAY' : n === 1 ? 'YDAY' : WD[t.getDay()], dn: t.getDate() }; });

  const save = async () => {
    if (!(d.amount > 0)) { setErr('Amount must be more than ₹0'); haptic('error'); setField('amt'); return; }
    if (!isPersonal && d.splitAmong.length === 0) { setErr('Pick at least one person to split with'); haptic('error'); setField('split'); return; }
    if (bill && !d.groupName.trim()) { setErr('Bill name is required'); haptic('error'); setField('bill'); return; }
    setSaving(true);
    await onSave({
      description: d.description.trim() || 'Untitled',
      amount: Math.round(d.amount * 100) / 100,
      categoryId: d.categoryId,
      date: d.date,
      ...(isPersonal ? {} : { paidBy: d.paidBy, splitAmong: d.splitAmong }),
    }, bill && d.groupName.trim() !== expense.groupName ? d.groupName.trim() : null);
  };

  const line = (k, label, value) => (
    <button key={k} type="button" className={`he__line ${field === k ? 'is-on' : ''}`} onClick={() => { haptic('tap'); setField(k); }}>
      <span className="he__lab">{label}</span>
      <span className="he__dots" />
      <span className="he__val">{value}</span>
      {field === k && <span className="he__caret" />}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title={undefined} labelledBy="he-title">
      <div className="he">
        <div className="he__paper se-mono">
          <span id="he-title" className="he__title">{(bill ? d.groupName || expense.description : d.description || 'EXPENSE').toUpperCase()}</span>
          <span className="he__rule" />
          {bill && line('bill', 'BILL', d.groupName || '—')}
          {line('desc', 'DESCRIPTION', d.description || '—')}
          {line('cat', 'CATEGORY', cat?.name || 'Other')}
          {line('date', 'DATE', prettyDate(d.date))}
          {!isPersonal && line('paid', 'PAID BY', name(d.paidBy))}
          {!isPersonal && line('split', 'SPLIT', d.splitAmong.length ? d.splitAmong.map(name).join(' · ') : '—')}
          {line('amt', 'AMOUNT', d.amount.toFixed(2))}
        </div>

        {field === 'amt' && (
          <div className="he__ctl se-pop">
            <div className="he__chips">
              {[-10, 10, 50, 100].map(n => (
                <button key={n} type="button" className="he__chip se-press" onClick={() => { haptic('tap'); set('amount', Math.max(0, d.amount + n)); }}>{n < 0 ? '−' : '+'}₹{Math.abs(n)}</button>
              ))}
            </div>
            <input className="he__input" inputMode="decimal" aria-label="Amount" value={d.amount || ''} placeholder="0"
              onChange={e => set('amount', parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0)} />
          </div>
        )}
        {field === 'desc' && <input className="he__input he__input--wide se-pop" aria-label="Description" autoFocus value={d.description} onChange={e => set('description', e.target.value)} />}
        {field === 'bill' && <input className="he__input he__input--wide se-pop" aria-label="Bill name" autoFocus value={d.groupName} onChange={e => set('groupName', e.target.value)} />}
        {field === 'cat' && (
          <div className="he__strip se-pop">
            {categories.map(c => (
              <button key={c.id} type="button" className={`he__cat se-press ${c.id === d.categoryId ? 'is-on' : ''}`} onClick={() => { haptic('choose'); set('categoryId', c.id); }}>
                <CategoryIcon category={c} size={28} />{c.name}
              </button>
            ))}
          </div>
        )}
        {field === 'date' && (
          <div className="he__strip se-pop">
            {days.map(x => (
              <button key={x.key} type="button" className={`he__day se-press ${d.date === x.key ? 'is-on' : ''}`} onClick={() => { haptic('tap'); set('date', x.key); }}>
                <span className="se-mono">{x.wd}</span><b>{x.dn}</b>
              </button>
            ))}
            <label className={`he__day se-press ${days.some(x => x.key === d.date) ? '' : 'is-on'}`}>
              <span className="se-mono">PICK</span><b>···</b>
              <input type="date" value={d.date} max={localDateStr()} onChange={e => e.target.value && set('date', e.target.value)} aria-label="Pick a date" />
            </label>
          </div>
        )}
        {field === 'paid' && (
          <div className="he__strip se-pop">
            {users.map(u => (
              <button key={u.id} type="button" className={`he__cat se-press ${u.id === d.paidBy ? 'is-on' : ''}`} onClick={() => { haptic('choose'); set('paidBy', u.id); }}>{name(u.id)}</button>
            ))}
          </div>
        )}
        {field === 'split' && (
          <div className="he__strip se-pop">
            {users.map(u => {
              const on = d.splitAmong.includes(u.id);
              return (
                <button key={u.id} type="button" className={`he__cat se-press ${on ? 'is-on' : ''}`} aria-pressed={on}
                  onClick={() => { haptic('tap'); set('splitAmong', on ? d.splitAmong.filter(x => x !== u.id) : [...d.splitAmong, u.id]); }}>{name(u.id)}</button>
              );
            })}
          </div>
        )}

        {err && <p className="he__err">{err}</p>}
        <div className="he__btns">
          <button type="button" className="se-btn se-btn--secondary se-btn--lg se-press" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button type="button" className="se-btn se-btn--primary se-btn--lg se-press" style={{ flex: 1.5 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </Sheet>
  );
}
