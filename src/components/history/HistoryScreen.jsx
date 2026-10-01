import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRoomContext } from '../../context/RoomContext';
import { useToast } from '../ui/Toast';
import { haptic } from '../../utils/haptics';
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
const SAVE_TIMEOUT_MS = 6000;

export default function HistoryScreen() {
  const { roomCode, room, expenses, users, categories, userIdentity } = useRoomContext();
  const toast = useToast();
  const { state } = useLocation();
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
  const inputRef = useRef(null);
  const ql = q.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (ql.length < 2) return [];
    const out = [];
    if (!isPersonal) users.forEach((u, i) => { if ((u.name || '').toLowerCase().includes(ql)) out.push({ kind: 'payer', id: u.id, label: `${u.id === meId ? 'You' : u.name} paid`, color: memberStyle(i).color }); });
    categories.forEach(c => { if ((c.name || '').toLowerCase().includes(ql)) out.push({ kind: 'cat', id: c.id, label: c.name, color: resolveCategoryIcon(c).color }); });
    return out.slice(0, 3);
  }, [ql, users, categories, isPersonal, meId]);

  // focus() must happen inside the tap itself or iOS won't raise the keyboard, so the input is always mounted.
  const openSearch = () => { if (open) return; haptic('tap'); inputRef.current?.focus(); setOpen(true); };
  const closeSearch = e => { e?.stopPropagation(); setOpen(false); setQ(''); };
  const applyFilter = f => { haptic('tap'); setFilter(f); setOpen(false); setQ(''); };

  const itemMatches = e => {
    if (filter && (filter.kind === 'payer' ? e.paidBy !== filter.id : e.categoryId !== filter.id)) return false;
    if (!ql) return true;
    const hay = `${e.description || ''} ${e.groupName || ''} ${catOf(e)?.name || ''} ${users.find(u => u.id === e.paidBy)?.name || ''} ${e.amount}`.toLowerCase();
    return hay.includes(ql.replace(/[₹,]/g, ''));
  };
  const entryDim = en => ((filter || ql) ? ((en.kind === 'bill' ? en.items.some(itemMatches) : itemMatches(en.e)) ? 1 : 0.25) : 1);

  // ---- tear delete with Undo (the real delete waits until the toast is gone) ----
  const [hidden, setHidden] = useState(() => new Set());
  const pending = useRef(new Map());
  const commit = key => {
    const p = pending.current.get(key);
    if (!p) return;
    clearTimeout(p.timer);
    pending.current.delete(key);
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
    pending.current.set(key, { ids, timer: setTimeout(() => commit(key), UNDO_MS + 200) });
    haptic('success');
    toast({
      message: <><b>{en.kind === 'bill' ? en.name : e.description}</b> torn off · ₹{fmt(en.kind === 'bill' ? en.total : e.amount)}</>,
      sub: others.length ? `Also removed from ${others.join(' and ')}’s personal ${others.length > 1 ? 'rooms' : 'room'}` : 'Removed from history',
      duration: UNDO_MS,
      action: { label: 'Undo', onClick: () => { const p = pending.current.get(key); if (p) { clearTimeout(p.timer); pending.current.delete(key); } setHidden(h => { const n = new Set(h); n.delete(key); return n; }); } },
    });
  };

  const locked = en => toast({ message: <>Synced from <b>{syncedFrom(en.e)}</b> — edit or delete it there.</>, duration: 2600 });

  // ---- edit (board 6b) ----
  const [editing, setEditing] = useState(null);
  const saveEdit = async (updates, newGroupName) => {
    const e = editing;
    const run = (async () => {
      await updateExpense(roomCode, e.id, updates, room);
      if (newGroupName) await updateGroupName(roomCode, e.groupId, newGroupName, room);
    })();
    // Offline writes queue inside Firestore and never resolve — don't leave the sheet hanging.
    const outcome = await Promise.race([run.then(() => 'ok', err => err), new Promise(r => setTimeout(() => r('slow'), SAVE_TIMEOUT_MS))]);
    if (outcome !== 'ok' && outcome !== 'slow') { toast({ message: 'Couldn’t save the change', sub: String(outcome?.message || outcome), kind: 'error' }); }
    else { haptic('choose'); }
    setEditing(null);
  };

  // ---- arrival from Add (the receipt just flew into History) ----
  const [wasLanded] = useState(() => !!state?.landed);
  const landedId = useMemo(() => {
    if (!wasLanded) return null;
    let best = null;
    months.forEach(m => m.days.forEach(d => d.entries.forEach(en => { if (!best || en.createdAt > best.createdAt) best = en; })));
    return best ? best.id : null;
  }, [wasLanded, months]);

  const headCount = `${entryCount} ${entryCount === 1 ? 'EXPENSE' : 'EXPENSES'} · ${(room?.name || '').toUpperCase()}`;

  if (!expenses.length) return <EmptyHistory roomName={(room?.name || '').toUpperCase()} />;

  const side = month ? monthSide(month, { isPersonal, budget }) : null;
  const listExtra = (open && suggestions.length) || filter ? 38 : 0;
  const tint = filter ? `color-mix(in srgb, ${filter.color} 50%, transparent)` : undefined;

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
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search “chai”, “Ravi”, “₹500”" aria-label="Search expenses" enterKeyHint="search" tabIndex={open ? 0 : -1} />
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
        {month && !fan && month.days.map(day => (
          <section key={`${month.key}-${day.key}`} className="hist__day se-pop" style={{ animationDuration: '.45s' }}>
            <div className="hist__dayhead">
              <span className="se-mono">{day.label}</span>
              <span className="se-mono hist__daytot">₹{fmt(day.total)}</span>
            </div>
            {day.entries.map(en => en.kind === 'bill' ? (
              <BillCard
                key={en.id} bill={en} catOf={catOf} users={users} meId={meId} isPersonal={isPersonal}
                dim={entryDim(en)} removed={hidden.has(en.id)} landed={en.id === landedId}
                onEditItem={it => setEditing(it)} onTear={() => tear(en)} onLocked={() => locked(en)}
              />
            ) : (
              <TearRow
                key={en.id} locked={isSyncedExp(en.e)} removed={hidden.has(en.id)} dim={entryDim(en)} landed={en.id === landedId}
                onTap={() => (isSyncedExp(en.e) ? locked(en) : setEditing(en.e))} onTear={() => tear(en)} onLocked={() => locked(en)}
              >
                <ExpenseCard e={en.e} cat={catOf(en.e)} users={users} meId={meId} isPersonal={isPersonal} />
              </TearRow>
            ))}
          </section>
        ))}
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
