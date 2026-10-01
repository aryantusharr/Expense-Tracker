import { useMemo, useRef, useState } from 'react';
import { parseCSVForMapping, applyMappings, importToFirestore } from '../../services/csvImportService';
import { useRoomContext } from '../../context/RoomContext';
import { updateRoomData } from '../../services/roomService';
import { haptic } from '../../utils/haptics';
import { memberStyle, initialOf } from '../dashboard/dashboardData';
import CategoryIcon from '../ui/CategoryIcon';
import Sheet from '../ui/Sheet';

const Mono = ({ i, name, size = 22 }) => (
  <span className="st-mono-m" style={{ '--c': memberStyle(i).color, width: size, height: size, borderRadius: size * 0.32, fontSize: size * 0.5 }}>{initialOf(name)}</span>
);
const dmy = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : String(d || ''); };

/** A select that shows a styled chip (what the board draws) but keeps the native picker. */
function Pick({ value, onChange, placeholder, options }) {
  const cur = options.find(o => o.value === value);
  return (
    <span className={`iw-pick ${cur ? '' : 'is-empty'}`}>
      {cur ? cur.chip : <span className="iw-pick__ph">{placeholder}</span>}
      <select value={value || ''} onChange={e => onChange(e.target.value)} aria-label={placeholder}>
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </span>
  );
}

/** Import CSV wizard (board S6): step bar → before you start → upload → people → groups → categories → preview → importing → N IMPORTED. */
// Why Next is greyed out (iPhone web has no haptics, so the dimmed button alone says nothing).
const BLOCKED = {
  pre: 'Tick the box above to continue',
  ppl: 'Match every name to a member to continue',
  grp: 'Tick at least one person in every group',
  cat: 'Pick a category for every row to continue',
};

/** Mounted only while open, so every import starts from a clean state. */
export default function ImportWizard({ onClose }) {
  const { room, roomCode, users, categories } = useRoomContext();
  const isPersonal = room?.isPersonal === true;
  const steps = useMemo(() => (isPersonal ? ['pre', 'up', 'cat', 'prev', 'run', 'done'] : ['pre', 'up', 'ppl', 'grp', 'cat', 'prev', 'run', 'done']), [isPersonal]);

  const [step, setStep] = useState('pre');
  const [agreed, setAgreed] = useState(false);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState(null);
  const [drag, setDrag] = useState(false);
  const [raw, setRaw] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [uniq, setUniq] = useState({ cats: [], paid: [], splits: [] });
  // Saved matches from the last import in this room.
  const [maps, setMaps] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(`csv-mappings-${roomCode}`) || '{}');
      return { categoryMap: s.categoryMap || {}, peopleMap: s.peopleMap || {}, splitMap: s.splitMap || {} };
    } catch { return { categoryMap: {}, peopleMap: {}, splitMap: {} }; }
  });
  const [rows, setRows] = useState([]);
  const [extraSkipped, setExtraSkipped] = useState([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const input = useRef(null);

  const idx = steps.indexOf(step);
  const close = () => { if (step === 'run') return; onClose(); };

  const handleFile = async f => {
    if (!f || !/\.csv$/i.test(f.name)) { haptic('error'); setErr('Please choose a .csv file.'); return; }
    setFile(f); setErr(null); setParsing(true);
    try {
      const r = await parseCSVForMapping(f, isPersonal);
      setRaw(r.rawRows); setSkipped(r.skipped);
      setUniq({ cats: r.uniqueCategories, paid: r.uniquePaidBy, splits: r.uniqueSplits });
      // Pre-pick obvious matches (same name, any case) where nothing is saved yet — still editable.
      const norm = x => String(x || '').trim().toLowerCase();
      setMaps(m => {
        const categoryMap = { ...m.categoryMap };
        r.uniqueCategories.forEach(c => { if (!categoryMap[c]) { const hit = categories.find(k => norm(k.name) === norm(c)); if (hit) categoryMap[c] = hit.id; } });
        const peopleMap = { ...m.peopleMap };
        r.uniquePaidBy.forEach(n => {
          if (peopleMap[n]) return;
          const hit = users.find(u => norm(u.name) === norm(n)) || users.filter(u => norm(u.name).split(/\s+/)[0] === norm(n)).find((u, _, a) => a.length === 1);
          if (hit) peopleMap[n] = hit.id;
        });
        return { ...m, categoryMap, peopleMap };
      });
      haptic('success');
      setStep(steps[steps.indexOf('up') + 1]);
    } catch (e) { haptic('error'); setErr(e.message); setFile(null); }
    setParsing(false);
  };

  const complete = () => {
    if (step === 'pre') return agreed;
    if (step === 'ppl') return uniq.paid.every(u => maps.peopleMap[u]);
    if (step === 'grp') return uniq.splits.every(s => maps.splitMap[s]?.length > 0);
    if (step === 'cat') return uniq.cats.every(c => maps.categoryMap[c]);
    if (step === 'prev') return rows.length > 0;
    return true;
  };

  const goPreview = () => {
    const { processedRows, additionalSkipped } = applyMappings(raw, maps, isPersonal, users);
    setRows(processedRows); setExtraSkipped(additionalSkipped);
  };
  const next = () => {
    if (!complete()) { haptic('error'); return; }
    haptic('tap');
    if (step === 'cat') goPreview();
    if (step === 'ppl') {
      // Pre-tick split groups from the people just matched: "All"/"Everyone" → everyone, "Ravi + Asha" → those two.
      setMaps(m => {
        const splitMap = { ...m.splitMap };
        uniq.splits.forEach(sp => {
          if (splitMap[sp]?.length) return;
          if (/^(all|everyone)$/i.test(sp.trim())) { splitMap[sp] = users.map(u => u.id); return; }
          const ids = sp.split(/\s*(?:\+|&|,|\band\b)\s*/i).map(t => m.peopleMap[t.trim()] || m.peopleMap[Object.keys(m.peopleMap).find(k => k.toLowerCase() === t.trim().toLowerCase())]).filter(Boolean);
          if (ids.length) splitMap[sp] = [...new Set(ids)];
        });
        return { ...m, splitMap };
      });
    }
    if (step === 'prev') { runImport(); return; }
    setStep(steps[idx + 1]);
  };
  const back = () => {
    haptic('tap');
    if (step === 'up') setFile(null);
    setStep(steps[idx - 1]);
  };

  const runImport = async () => {
    setStep('run'); setProgress(0);
    const res = await importToFirestore(roomCode, rows, setProgress);
    setResult(res);
    if (res.imported > 0) {
      const now = new Date().toISOString();
      localStorage.setItem(`csv-mappings-${roomCode}`, JSON.stringify(maps));
      const hist = JSON.parse(localStorage.getItem('csv-import-history') || '[]');
      hist.unshift({ timestamp: now, count: res.imported, filename: file?.name || 'unknown.csv' });
      localStorage.setItem('csv-import-history', JSON.stringify(hist.slice(0, 10)));
      localStorage.setItem('lastImportTimestamp', now);
      localStorage.setItem('lastImportRoomCode', roomCode);
      localStorage.setItem('lastImportItemCount', String(res.imported));
      updateRoomData(roomCode, { lastImportAt: now, lastImportCount: res.imported }).catch(() => { /* banner falls back to this phone */ });
    }
    haptic('success');
    setStep('done');
  };

  const resetMatches = () => {
    haptic('tap');
    setMaps({ categoryMap: {}, peopleMap: {}, splitMap: {} });
    localStorage.removeItem(`csv-mappings-${roomCode}`);
  };

  const downloadFailed = () => {
    const lines = [...skipped, ...extraSkipped].map(s => `${s.rowNum},"${String(s.reason).replace(/"/g, '""')}"`)
      .concat((result?.errors || []).map(e => `${e.rowIndex},"${String(e.error).replace(/"/g, '""')}"`));
    const blob = new Blob([`Row Number,Error Message\n${lines.join('\n')}`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'failed_imports.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const userOpts = users.map((u, i) => ({ value: u.id, label: u.name, chip: <span className="iw-chip"><Mono i={i} name={u.name} />{u.name}</span> }));
  const catOpts = categories.map(c => ({ value: c.id, label: c.name, chip: <span className="iw-chip"><CategoryIcon category={c} size={22} />{c.name}</span> }));
  const allSkipped = [...skipped, ...extraSkipped];
  const total = rows.length;
  const done = Math.min(total, Math.round((progress / 100) * total));
  const catName = id => categories.find(c => c.id === id)?.name || id;

  const nextLabel = { pre: 'Continue', ppl: 'Next', grp: 'Next', cat: 'Preview', prev: `Import ${rows.length}` }[step];

  return (
    <Sheet open onClose={close} labelledBy="iw-title">
      <div className="iw-bar">{steps.map((s, i) => <span key={s} className={i <= idx ? 'is-on' : ''} />)}</div>
      <span className="st-mono st-mono--wide">STEP {idx + 1} OF {steps.length}</span>

      {step === 'pre' && (
        <div className="iw-body se-pop">
          <h2 className="se-sheet__title" id="iw-title">Before you import</h2>
          <span className="iw-sub">Your CSV needs these exact column headers:</span>
          <span className="iw-paper iw-paper--block">{['DATE', 'DESCRIPTION', 'CATEGORY', 'AMOUNT', ...(isPersonal ? [] : ['PAID BY', 'SPLIT BETWEEN'])].join(', ')}</span>
          <span className="iw-check"><span className="iw-tick is-on">✓</span>Other columns are ignored</span>
          <span className="iw-check"><span className="iw-tick is-on">✓</span>Dates look like “28 Sep 2026” or 2026-09-28</span>
          <button type="button" className="iw-check iw-check--btn" onClick={() => { haptic('tap'); setAgreed(a => !a); }}>
            <span className={`iw-tick ${agreed ? 'is-on' : 'is-box'}`}>{agreed ? '✓' : ''}</span>My file matches the format
          </button>
        </div>
      )}

      {step === 'up' && (
        <div className="iw-body se-pop">
          <h2 className="se-sheet__title" id="iw-title">Upload CSV</h2>
          <button type="button" className={`iw-drop se-press ${drag ? 'is-drag' : ''}`} onClick={() => input.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V9M7 14l5-5 5 5M4 3h16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{parsing ? 'Reading your file…' : drag ? 'Drop it here' : 'Choose a CSV file'}</span>
            <span className="st-mono">{file ? file.name.toUpperCase() : 'TAP TO BROWSE · .CSV ONLY'}</span>
          </button>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
          {err && <span className="iw-err">{err}</span>}
        </div>
      )}

      {step === 'ppl' && (
        <div className="iw-body se-pop">
          <h2 className="se-sheet__title" id="iw-title">Match people</h2>
          <span className="iw-sub">Names in your file → members of {room?.name}</span>
          {uniq.paid.length === 0 && <span className="iw-sub">No names found in the file.</span>}
          {uniq.paid.map(n => (
            <div key={n} className="iw-row"><span className="iw-paper">{n.toUpperCase()}</span><span className="iw-arrow">→</span>
              <Pick value={maps.peopleMap[n]} placeholder="Choose…" options={userOpts}
                onChange={v => { haptic('choose'); setMaps(m => ({ ...m, peopleMap: { ...m.peopleMap, [n]: v } })); }} /></div>
          ))}
          <button type="button" className="iw-link" onClick={resetMatches}>Forget saved matches</button>
        </div>
      )}

      {step === 'grp' && (
        <div className="iw-body se-pop">
          <h2 className="se-sheet__title" id="iw-title">Split groups</h2>
          <span className="iw-sub">Tick who is in each “split between” value</span>
          {uniq.splits.length === 0 && <span className="iw-sub">No split groups found in the file.</span>}
          {uniq.splits.map(s => {
            const sel = maps.splitMap[s] || [];
            return (
              <div key={s} className="iw-row"><span className="iw-paper">{s.toUpperCase()}</span>
                <span className="iw-monos">
                  {users.map((u, i) => (
                    <button key={u.id} type="button" aria-pressed={sel.includes(u.id)} aria-label={u.name} className={`iw-m ${sel.includes(u.id) ? 'is-on' : ''}`}
                      onClick={() => { haptic('choose'); setMaps(m => { const cur = m.splitMap[s] || []; return { ...m, splitMap: { ...m.splitMap, [s]: cur.includes(u.id) ? cur.filter(x => x !== u.id) : [...cur, u.id] } }; }); }}>
                      <Mono i={i} name={u.name} size={26} />
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
          <button type="button" className="iw-link" onClick={resetMatches}>Forget saved matches</button>
        </div>
      )}

      {step === 'cat' && (
        <div className="iw-body se-pop">
          <h2 className="se-sheet__title" id="iw-title">Match categories</h2>
          {uniq.cats.length === 0 && <span className="iw-sub">No categories found in the file.</span>}
          {uniq.cats.map(c => (
            <div key={c} className="iw-row"><span className="iw-paper">{c.toUpperCase()}</span><span className="iw-arrow">→</span>
              <Pick value={maps.categoryMap[c]} placeholder="Choose…" options={catOpts}
                onChange={v => { haptic('choose'); setMaps(m => ({ ...m, categoryMap: { ...m.categoryMap, [c]: v } })); }} /></div>
          ))}
          <button type="button" className="iw-link" onClick={resetMatches}>Forget saved matches</button>
        </div>
      )}

      {step === 'prev' && (
        <div className="iw-body se-pop">
          <h2 className="se-sheet__title" id="iw-title">Preview</h2>
          <div className="iw-chips">
            <span className="iw-badge iw-badge--ok">{rows.length} READY</span>
            <span className={`iw-badge ${allSkipped.length ? 'iw-badge--bad' : ''}`}>{allSkipped.length} SKIPPED</span>
          </div>
          <div className="iw-sheetpaper">
            {rows.map((r, i) => (
              <span key={i} className="iw-prow"><span>{dmy(r.date)}</span><span>{(r.description || catName(r.categoryId)).toUpperCase()}</span><span>{Number(r.amount).toFixed(2)}</span></span>
            ))}
            {allSkipped.map((s, i) => (
              <span key={`s${i}`} className="iw-prow iw-prow--bad"><span>ROW {s.rowNum}</span><span>{String(s.reason).toUpperCase()}</span></span>
            ))}
            {!rows.length && !allSkipped.length && <span className="iw-prow">NOTHING FOUND</span>}
          </div>
        </div>
      )}

      {step === 'run' && (
        <div className="iw-body se-pop">
          <h2 className="se-sheet__title" id="iw-title">Importing…</h2>
          <div className="dt-printer">
            <span className="dt-slot" />
            <div className="iw-feed">
              <div className="iw-feed__paper" style={{ height: `${Math.max(8, progress * 1.5)}px` }}>
                {rows.slice(0, done).slice(-6).map((r, i) => (
                  <span key={i}><span>{(r.description || catName(r.categoryId)).toUpperCase().slice(0, 22)}</span><span>✓</span></span>
                ))}
              </div>
            </div>
          </div>
          <div className="iw-count"><span>{done} / {total}</span><span>{Math.round(progress)}%</span></div>
        </div>
      )}

      {step === 'done' && (
        <div className="iw-body se-pop">
          <div className="iw-stampwrap"><span id="iw-title" className="ps-stamp ps-stamp--big">{result?.imported || 0} IMPORTED</span></div>
          {(allSkipped.length > 0 || result?.errors?.length > 0) && (
            <div className="iw-skipbox">
              <b>{allSkipped.length + (result?.errors?.length || 0)} {allSkipped.length + (result?.errors?.length || 0) === 1 ? 'row' : 'rows'} skipped</b>
              {[...allSkipped.map(s => `Row ${s.rowNum} · ${s.reason}`), ...(result?.errors || []).map(e => `Row ${e.rowIndex} · ${e.error}`)].slice(0, 4).map(t => <span key={t}>{t}</span>)}
            </div>
          )}
          {(allSkipped.length > 0 || result?.errors?.length > 0) && (
            <button type="button" className="se-btn se-btn--secondary se-btn--block se-press" onClick={downloadFailed}>Download failed rows (CSV)</button>
          )}
        </div>
      )}

      {step !== 'run' && step !== 'done' && step !== 'up' && !complete() && BLOCKED[step] && <p className="iw-blocked" role="status">{BLOCKED[step]}</p>}
      {step !== 'run' && (
        <div className="st-btnrow">
          {step === 'done' ? (
            <button type="button" className="se-btn se-btn--primary se-press" onClick={onClose}>Done</button>
          ) : (
            <>
              <button type="button" className="se-btn se-btn--secondary se-press" onClick={step === 'pre' ? onClose : back}>{step === 'pre' ? 'Cancel' : 'Back'}</button>
              {step !== 'up' && (
                <button type="button" className="se-btn se-btn--primary se-press" style={{ opacity: complete() ? 1 : 0.4 }} aria-disabled={!complete()} onClick={next}>{nextLabel}</button>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
