import { useMemo, useState } from 'react';
import { generateExpenseReport } from '../../utils/pdfExport';
import { exportToExcel, exportToExcelMonthly } from '../../utils/excelExport';
import { haptic } from '../../utils/haptics';
import { LineIcon } from '../ui/CategoryIcon';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import ImportWizard from './ImportWizard';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const money = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inMonth = (e, m) => { const d = new Date(e.date); return d.getMonth() === m.month && d.getFullYear() === m.year; };

const readBanner = (room, roomCode) => {
  try {
    let ts = room?.lastImportAt;
    let count = room?.lastImportCount;
    if (!ts || count == null) {
      ts = localStorage.getItem('lastImportTimestamp');
      count = localStorage.getItem('lastImportRoomCode') === roomCode ? localStorage.getItem('lastImportItemCount') : null;
    }
    if (!ts || count == null || Date.now() - new Date(ts).getTime() > SEVEN_DAYS) return null;
    return { count: parseInt(count, 10), ts };
  } catch { return null; }
};
const ago = ts => {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

/** Data section (board S6a): export report → scope chips → printing receipt → PDF / Excel; Import CSV. */
// Itemised bills count once (same as History).
const entryCount = list => new Set(list.map(e => (e.isItemised && e.groupId ? `g:${e.groupId}` : e.id))).size;

export default function DataSection({ expenses, users, categories, room, roomCode }) {
  const toast = useToast();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [scope, setScope] = useState('all');          // all | this | pick
  const [picked, setPicked] = useState(null);         // month object when scope === 'pick'
  const [printKey, setPrintKey] = useState(0);
  const [tick, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(null);       // 'pdf' | 'xlsx' while a file is being built

  const banner = useMemo(() => readBanner(room, roomCode), [room, roomCode, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastImport = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('csv-import-history') || '[]')[0] || null; } catch { return null; }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = useMemo(() => {
    const seen = new Map();
    for (const e of expenses) {
      const d = new Date(e.date);
      if (isNaN(d)) continue;
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seen.has(k)) seen.set(k, { year: d.getFullYear(), month: d.getMonth(), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
    }
    return [...seen.values()].sort((a, b) => b.year - a.year || b.month - a.month);
  }, [expenses]);

  const now = new Date();
  const thisMonth = { year: now.getFullYear(), month: now.getMonth(), label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` };
  const monthObj = scope === 'this' ? thisMonth : scope === 'pick' ? picked : null;
  const scoped = useMemo(() => (monthObj ? expenses.filter(e => inMonth(e, monthObj)) : expenses), [expenses, monthObj]);

  // The receipt: month totals for All time, category totals for a single month.
  const receipt = useMemo(() => {
    const amt = e => parseFloat(e.amount) || 0;
    const total = scoped.reduce((s, e) => s + amt(e), 0);
    let lines;
    if (!monthObj) {
      const by = {};
      for (const e of scoped) { const d = new Date(e.date); const k = d.getFullYear() * 12 + d.getMonth(); by[k] = (by[k] || 0) + amt(e); }
      const all = Object.entries(by).sort((a, b) => b[0] - a[0]);
      lines = all.slice(0, 5).map(([k, v]) => [`${MONTH_NAMES[k % 12].slice(0, 3).toUpperCase()} ${Math.floor(k / 12)}`, v]);
      const older = all.slice(5);
      if (older.length) lines.push([`+${older.length} EARLIER ${older.length === 1 ? 'MONTH' : 'MONTHS'}`, older.reduce((s, [, v]) => s + v, 0)]);
    } else {
      const names = Object.fromEntries(categories.map(c => [c.id, c.name]));
      const by = {};
      for (const e of scoped) { const n = names[e.categoryId] || 'Other'; by[n] = (by[n] || 0) + amt(e); }
      const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]);
      lines = sorted.slice(0, 4);
      const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
      if (rest > 0) lines.push(['Other', rest]);
    }
    return { lines: lines.map(([m, v]) => [String(m).toUpperCase(), money(v)]), total: money(total), n: entryCount(scoped) };
  }, [scoped, monthObj, categories]);

  const say = (message, kind, sub) => toast({ message, sub, kind, top: true, duration: 3000 });
  const replay = () => setPrintKey(k => k + 1);
  const open = () => { haptic('tap'); setScope('all'); setPicked(null); replay(); setExportOpen(true); };
  const chooseScope = s => {
    haptic('tap');
    setScope(s);
    if (s === 'pick' && !picked) setPicked(months[0] || null);
    replay();
  };

  const save = async kind => {
    if (saving) return;
    if (!scoped.length) { haptic('error'); say(monthObj ? `No expenses in ${monthObj.label}` : 'Nothing to export yet', 'warn', monthObj ? 'Pick another month' : 'Add an expense first — then export any time'); return; }
    setSaving(kind);
    try {
      const name = room?.name || 'SplitEase';
      let file; let extra = `${scoped.length} rows`;
      if (kind === 'pdf') {
        const r = await generateExpenseReport({ expenses, users, roomName: name, categories, month: monthObj, isPersonal: room?.isPersonal === true, budget: Number(room?.budget) || 0 });
        file = r.filename; extra = `${r.pages} pages`;
      } else file = monthObj ? exportToExcelMonthly(expenses, categories, name, monthObj) : exportToExcel(expenses, categories, name);
      haptic('success');
      setExportOpen(false);
      say(<>{kind === 'pdf' ? 'PDF' : 'Excel'} saved</>, 'success', `${file} · ${extra}`);
    } catch {
      haptic('error');
      say('Couldn’t export the file', 'error', 'Try again · your data is safe');
    }
    setSaving(null);
  };

  const lastTxt = lastImport ? `Last import ${ago(lastImport.timestamp)} · ${lastImport.count} expenses` : 'Bring in a CSV file';

  return (
    <>
      {banner && !dismissed && (
        <div className="dt-banner">
          <span className="dt-banner__tick">✓</span>
          <span className="dt-banner__t"><b>{banner.count} expenses</b> imported <span>· {ago(banner.ts)}</span></span>
          <span className="st-mono">SHOWS 7 DAYS</span>
          <button type="button" aria-label="Dismiss" onClick={() => setDismissed(true)}>×</button>
        </div>
      )}
      <div className="st-card se-glass st-rows">
        <button type="button" className="st-r se-press" onClick={open}>
          <span className="st-r__ic"><LineIcon path="M12 3v12M7 10l5 5 5-5M4 21h16" size={16} strokeWidth={1.9} /></span>
          <span className="st-r__t"><span>Export report</span><small>Prints a report · PDF or Excel</small></span>
          <span className="st-r__chev">›</span>
        </button>
        <button type="button" className="st-r se-press" onClick={() => { haptic('tap'); setImportOpen(true); }}>
          <span className="st-r__ic"><LineIcon path="M12 21V9M7 14l5-5 5 5M4 3h16" size={16} strokeWidth={1.9} /></span>
          <span className="st-r__t"><span>Import CSV</span><small>{lastTxt}</small></span>
          <span className="st-r__chev">›</span>
        </button>
      </div>

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} labelledBy="dt-exp-t">
        <h2 className="se-sheet__title" id="dt-exp-t">Export report</h2>
        <div className="dt-chips">
          {[['all', 'All time'], ['this', 'This month'], ['pick', 'Pick month']].map(([k, l]) => (
            <button key={k} type="button" className={`dt-chip se-press ${scope === k ? 'is-on' : ''}`} onClick={() => chooseScope(k)}>{l}</button>
          ))}
        </div>
        {scope === 'pick' && (
          months.length ? (
            <div className="dt-months">
              {months.map(m => (
                <button key={m.label} type="button" className={`dt-chip dt-chip--sm se-press ${picked?.label === m.label ? 'is-on' : ''}`}
                  onClick={() => { haptic('tap'); setPicked(m); replay(); }}>{m.label}</button>
              ))}
            </div>
          ) : <span className="st-note">No expenses yet.</span>
        )}
        <div className="dt-printer">
          <span className="dt-slot" key={`s${printKey}`} />
          <div className="dt-feed">
            <div className="dt-paper" key={printKey}>
              <b>{(room?.name || 'ROOM').toUpperCase()} · REPORT</b>
              <small>{monthObj ? `${monthObj.label.toUpperCase()} · BY CATEGORY` : `ALL TIME · ${receipt.n} EXPENSES`}</small>
              <i className="dt-rule" />
              {receipt.lines.length ? receipt.lines.map(([m, v]) => (
                <span key={m} className="dt-line"><span>{m}</span><span className="dt-dots" /><span>{v}</span></span>
              )) : <small>NO EXPENSES</small>}
              <i className="dt-rule" />
              <span className="dt-total"><span>TOTAL</span><span>{receipt.total}</span></span>
              <em>|||| ||| || ||||</em>
            </div>
          </div>
        </div>
        <div className="st-btnrow">
          <button type="button" className="se-btn se-btn--primary se-press" disabled={!!saving} onClick={() => save('pdf')}>{saving === 'pdf' ? 'Saving…' : 'Save as PDF'}</button>
          <button type="button" className="se-btn se-btn--secondary se-press" disabled={!!saving} onClick={() => save('xlsx')}>{saving === 'xlsx' ? 'Saving…' : 'Save as Excel'}</button>
        </div>
      </Sheet>

      {importOpen && <ImportWizard onClose={() => { setImportOpen(false); setTick(t => t + 1); }} />}
    </>
  );
}
