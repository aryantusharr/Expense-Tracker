import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoomContext } from '../../context/RoomContext';
import { useToast, useToastDismiss } from '../ui/Toast';
import { haptic } from '../../utils/haptics';
import { TextField } from '../ui/Keyboard';
import { resolveCategoryIcon } from '../../design/categoryIcons';
import { memberStyle, fmt } from '../dashboard/dashboardData';
import { updateExpense, updateGroupName, deleteExpense } from '../../services/expenseService';
import { buildHistory, monthSide, isSyncedExp, syncedFrom } from './historyData';
import MonthStack from './MonthStack';
import { TearRow, ExpenseCard, BillCard } from './Rows';
import EditSheet from './EditSheet';
import EmptyHistory from './EmptyHistory';
import './History.css';

const UNDO_MS = 4500;

export default function HistoryScreen() {
  const { roomCode, room, expenses, users, categories, userIdentity } = useRoomContext();
  const toast = useToast();
  const dismissToast = useToastDismiss();
  const isPersonal = room?.isPersonal === true;
  const budget = Number(room?.budget) || 0;
  const meId = isPersonal ? (users[0]?.id ?? null) : (userIdentity || null);

  const { months, entryCount } = useMemo(() => {
    const h = buildHistory(expenses, { meId, isPersonal, budget });
    if (!meId) h.months.forEach(m => { m.net = null; });
    return h;
  }, [expenses, meId, isPersonal, budget]);

  const catOf = e => categories.find(c => c.id === e.categoryId);

  // ---- month stack ----
  const [mo, setMo] = useState(0);
  const [fan, setFan] = useState(false);
  const selIdx = Math.min(mo, months.length - 1);
  const month = months[selIdx];
  const pressMonth = i => { if (!fan) setFan(true); else { setMo(i); setFan(false); } };

  // ---- scroll: stack shrinks, slim sticky bar takes over ----
  const [y, setY] = useState(0);
  const onScroll = e => { const v = e.currentTarget.scrollTop; if (Math.abs(v - y) > 4) setY(v); };
  const shrink = { s: Math.max(0.86, 1 - y / 900), o: Math.max(0, 1 - y / 170) };
  const stuck = y > 150;

  // ---- search + filter (board 4f) ----
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(null);
  const ql = q.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (ql.length < 2) return [];
    const out = [];
    if (!isPersonal) users.forEach((u, i) => { if ((u.name || '').toLowerCase().includes(ql)) out.push({ kind: 'payer', id: u.id, label: `${u.id === meId ? 'You' : u.name} paid`, color: memberStyle(i).color }); });
    categories.forEach(c => { if ((c.name || '').toLowerCase().includes(ql)) out.push({ kind: 'cat', id: c.id, label: c.name, color: resolveCategoryIcon(c).color }); });
    return out.slice(0, 3);
  }, [ql, users, categories, isPersonal, meId]);

  // focus() must happen inside the tap itself or iOS won't raise the keyboard, so the input is always mounted.
  const openSearch = () => { if (open) return; haptic('tap'); setOpen(true); };
  const closeSearch = e => { e?.stopPropagation(); setOpen(false); setQ(''); };
  const applyFilter = f => { haptic('tap'); setFilter(f); setOpen(false); setQ(''); };

  const itemMatches = e => {
    if (filter && (filter.kind === 'payer' ? e.paidBy !== filter.id : e.categoryId !== filter.id)) return false;
    if (!ql) return true;
    const hay = `${e.description || ''} ${e.groupName || ''} ${catOf(e)?.name || ''} ${users.find(u => u.id === e.paidBy)?.name || ''} ${e.amount}`.toLowerCase();
    return hay.includes(ql.replace(/[₹,]/g, ''));
  };
  const searching = Boolean(filter || ql);
  const matchEn = en => (en.kind === 'bill' ? en.items.some(itemMatches) : itemMatches(en.e));
  const entryDim = en => (searching ? (matchEn(en) ? 1 : 0.25) : 1);

  // ---- tear delete with Undo (the real delete waits until the toast is gone) ----
  const [hidden, setHidden] = useState(() => new Set());
  const pending = useRef(new Map());
  const commit = key => {
    const p = pending.current.get(key);
    if (!p) return;
    clearTimeout(p.timer);
    pending.current.delete(key);
    if (p.toastId) dismissToast(p.toastId); // Undo is no longer possible — don't leave the button up
    p.ids.forEach(id => deleteExpense(roomCode, id, room).catch(() => {}));
  };
  const flushAll = () => [...pending.current.keys()].forEach(commit);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushAll(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flushAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const tear = en => {
    const key = en.id;
    const ids = en.kind === 'bill' ? en.items.map(i => i.id) : [en.id];
    const e = en.e;
    setHidden(h => new Set(h).add(key));
    const others = isPersonal ? [] : users.filter(u => u.id !== meId && u.personalRoomCode && (e.splitAmong || []).includes(u.id)).map(u => u.name);
    const p = { ids, timer: setTimeout(() => commit(key), UNDO_MS + 200), toastId: null };
    pending.current.set(key, p);
    haptic('success');
    p.toastId = toast({
      message: <><b>{en.kind === 'bill' ? en.name : e.description}</b> torn off · ₹{fmt(en.kind === 'bill' ? en.total : e.amount)}</>,
      sub: others.length ? `Also removed from ${others.join(' and ')}’s personal ${others.length > 1 ? 'rooms' : 'room'}` : 'Removed from history',
      duration: UNDO_MS,
      action: { label: 'Undo', onClick: () => { const p = pending.current.get(key); if (p) { clearTimeout(p.timer); pending.current.delete(key); } setHidden(h => { const n = new Set(h); n.delete(key); return n; }); } },
    });
  };

  const locked = en => toast({ message: <>Synced from <b>{syncedFrom(en.e)}</b> — edit or delete it there.</>, duration: 2600 });

  // ---- edit (board 6b) ----
  const [editing, setEditing] = useState(null);
  // Close the sheet straight away; Firestore applies the change locally at once and syncs in the background.
  const saveEdit = (updates, newGroupName) => {
    const e = editing;
    setEditing(null);
    haptic('choose');
    (async () => {
      await updateExpense(roomCode, e.id, updates, room, expenses);
      if (newGroupName) await updateGroupName(roomCode, e.groupId, newGroupName, room);
    })().catch(err => toast({ message: 'Couldn’t save the change', sub: String(err?.message || err), kind: 'error' }));
  };

  const headCount = `${entryCount} ${entryCount === 1 ? 'EXPENSE' : 'EXPENSES'} · ${(room?.name || '').toUpperCase()}`;

  if (!expenses.length) return <EmptyHistory roomName={(room?.name || '').toUpperCase()} />;

  const side = month ? monthSide(month, { isPersonal, budget }) : null;

  // While searching/filtering: the month on screen dims non-matches (board 4f); matches from every
  // other month are listed underneath so older expenses can still be found.
  const OTHER_CAP = 60;
  const hereHits = searching && month ? month.days.reduce((s, d) => s + d.entries.filter(matchEn).length, 0) : 0;
  const otherDays = searching ? months.flatMap((m, i) => (i === selIdx ? [] : m.days
    .map(d => ({ key: `${m.key}-${d.key}`, label: d.label, year: (m.short || "").split(" ")[1] || "", entries: d.entries.filter(matchEn) }))
    .filter(d => d.entries.length))) : [];
  const otherHits = otherDays.reduce((s, d) => s + d.entries.length, 0);
  const otherShown = otherDays.reduce((acc, d) => {
    const left = OTHER_CAP - acc.n;
    if (left > 0) { const entries = d.entries.slice(0, left); acc.days.push({ ...d, entries }); acc.n += entries.length; }
    return acc;
  }, { days: [], n: 0 }).days;
  const listExtra = (open && suggestions.length) || filter ? 38 : 0;
  const tint = filter ? `color-mix(in srgb, ${filter.color} 50%, transparent)` : undefined;

  const renderEntry = (en, dim) => (en.kind === 'bill' ? (
    <BillCard
      key={en.id} bill={en} catOf={catOf} users={users} meId={meId} isPersonal={isPersonal}
      dim={dim} removed={hidden.has(en.id)}
      onEditItem={it => setEditing(it)} onTear={() => tear(en)} onLocked={() => locked(en)}
    />
  ) : (
    <TearRow
      key={en.id} locked={isSyncedExp(en.e)} removed={hidden.has(en.id)} dim={dim}
      onTap={() => (isSyncedExp(en.e) ? locked(en) : setEditing(en.e))} onTear={() => tear(en)} onLocked={() => locked(en)}
    >
      <ExpenseCard e={en.e} cat={catOf(en.e)} users={users} meId={meId} isPersonal={isPersonal} />
    </TearRow>
  ));

  return (
    <div className="se-page hist" style={{ '--extra': `${listExtra}px` }}>
      <div className="hist__sky" aria-hidden="true">
        <span className="se-orb se-orb-1 hist__orb hist__orb--1" style={tint ? { background: tint } : undefined} />
        <span className="se-orb se-orb-2 hist__orb hist__orb--2" />
        <span className="se-orb se-orb-3 hist__orb hist__orb--3" />
      </div>

      <header className="hist__head">
        <div className="hist__bar">
          <div className="hist__title" style={{ opacity: open ? 0 : 1 }}>
            <h1>History</h1>
            <span className="se-mono">{headCount}</span>
          </div>
          <div className={`hist__search se-glass ${open ? 'is-open' : ''}`} onClick={openSearch} role="search">
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {open
              ? <TextField value={q} onChange={setQ} placeholder="Search “chai”, “Ravi”, “₹500”" aria-label="Search expenses" caps="none" maxLength={40} autoFocus />
              : <span className="hist__ph">Search “chai”, “Ravi”, “₹500”</span>}
            {open && <button type="button" className="hist__x" onClick={closeSearch} aria-label="Close search">×</button>}
          </div>
        </div>
        {open && suggestions.length > 0 && (
          <div className="hist__chips se-pop">
            <span className="se-mono">FILTER BY</span>
            {suggestions.map(s => (
              <button key={`${s.kind}${s.id}`} type="button" className="hist__chip se-press" style={{ '--c': s.color }} onClick={() => applyFilter(s)}>+ {s.label}</button>
            ))}
          </div>
        )}
        {filter && (
          <div className="hist__chips se-pop">
            <button type="button" className="hist__chip hist__chip--on se-press" style={{ '--c': filter.color }} onClick={() => { haptic('tap'); setFilter(null); }}>{filter.label} ×</button>
          </div>
        )}
      </header>

      {month && (
        <div className="hist__stick" style={{ opacity: stuck ? 1 : 0, transform: `translateY(${stuck ? 0 : -8}px)` }} aria-hidden={!stuck}>
          <span className="se-mono">{month.short}</span>
          <span className="hist__stick-r">
            <span className="se-display">₹{fmt(month.total)}</span>
            {side && <span className="se-display" style={{ color: side.color, fontSize: 13 }}>{side.value}</span>}
          </span>
        </div>
      )}

      <div className="hist__list" onScroll={onScroll}>
        <MonthStack months={months} selIdx={selIdx} fan={fan} onPress={pressMonth} isPersonal={isPersonal} budget={budget} shrink={shrink} />

        {month && month.days.length === 0 && (
          <p className="hist__none se-mono">NOTHING IN {month.name} YET</p>
        )}
        {searching && !fan && (
          <p className="hist__hits se-mono" aria-live="polite">
            {hereHits + otherHits === 0 ? 'NO MATCHES'
              : `${hereHits} IN ${month?.short || 'THIS MONTH'}${otherHits ? ` · ${otherHits} IN OTHER MONTHS ↓` : ''}`}
          </p>
        )}
        {month && !fan && month.days.map(day => (
          <section key={`${month.key}-${day.key}`} className="hist__day se-pop" style={{ animationDuration: '.45s' }}>
            <div className="hist__dayhead">
              <span className="se-mono">{day.label}</span>
              <span className="se-mono hist__daytot">₹{fmt(day.total)}</span>
            </div>
            {day.entries.map(en => renderEntry(en, entryDim(en)))}
          </section>
        ))}
        {searching && !fan && otherShown.length > 0 && (
          <>
            <p className="hist__other se-mono">OTHER MONTHS</p>
            {otherShown.map(day => (
              <section key={day.key} className="hist__day">
                <div className="hist__dayhead"><span className="se-mono">{day.label} {day.year}</span></div>
                {day.entries.map(en => renderEntry(en, 1))}
              </section>
            ))}
            {otherHits > OTHER_CAP && <p className="hist__none se-mono">+{otherHits - OTHER_CAP} MORE · NARROW THE SEARCH</p>}
          </>
        )}
        {fan && <p className="hist__none se-mono">PICK A MONTH</p>}
      </div>

      {editing && (
        <EditSheet
          key={editing.id} expense={editing} users={users} categories={categories}
          isPersonal={isPersonal} meId={meId} onClose={() => setEditing(null)} onSave={saveEdit}
        />
      )}
    </div>
  );
}
