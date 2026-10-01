import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where, writeBatch, arrayUnion, updateDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { haptic } from '../../../utils/haptics';
import Sheet from '../../ui/Sheet';
import CategoryIcon from '../../ui/CategoryIcon';
import { useToast } from '../../ui/Toast';

const seenKey = code => `se-unmapped-seen-${code}`;
const wasSeen = code => { try { return sessionStorage.getItem(seenKey(code)) === '1'; } catch { return false; } };

/**
 * Fallback for synced copies whose category isn't in this personal room (e.g. the category couldn't
 * be created while offline). On opening the personal room, asks once per visit: create it here, or
 * map those expenses to a category you already have.
 */
export default function UnmappedCategories({ roomCode, expenses, categories }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState({});   // orphan id -> { name, icon }
  const [busy, setBusy] = useState(false);

  const orphans = useMemo(() => {
    const known = new Set(categories.map(c => c.id));
    const m = new Map();
    for (const e of expenses) {
      if (!e.isSynced || !e.categoryId || known.has(e.categoryId)) continue;
      const o = m.get(e.categoryId) || { id: e.categoryId, count: 0, from: e.syncedFromRoomCode };
      o.count += 1;
      m.set(e.categoryId, o);
    }
    return [...m.values()];
  }, [expenses, categories]);

  const key = orphans.map(o => o.id).join('|');
  useEffect(() => {
    if (!orphans.length || wasSeen(roomCode)) return undefined;
    let live = true;
    (async () => {
      const found = {};
      const rooms = [...new Set(orphans.map(o => o.from).filter(Boolean))];
      await Promise.all(rooms.map(async code => {
        try {
          const snap = await getDoc(doc(db, 'rooms', code));
          for (const c of snap.data()?.categories || []) found[`${code}:${c.id}`] = { name: c.name, icon: c.icon };
        } catch { /* name stays unknown */ }
      }));
      if (!live) return;
      setNames(Object.fromEntries(orphans.map(o => [o.id, found[`${o.from}:${o.id}`] || null])));
      setOpen(true);
    })();
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, roomCode]);

  const close = () => {
    try { sessionStorage.setItem(seenKey(roomCode), '1'); } catch { /* private mode */ }
    setOpen(false);
  };

  const create = async o => {
    const n = names[o.id];
    setBusy(true);
    try {
      await updateDoc(doc(db, 'rooms', roomCode), { categories: arrayUnion({ id: o.id, name: n?.name || 'Imported', icon: n?.icon || 'line:other' }) });
      haptic('success');
    } catch (err) { toast({ message: 'Couldn’t create the category', sub: String(err?.message || err), kind: 'error' }); }
    setBusy(false);
  };

  const mapTo = async (o, target) => {
    setBusy(true);
    try {
      const snap = await getDocs(query(collection(db, 'rooms', roomCode, 'expenses'), where('categoryId', '==', o.id)));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach(d => batch.update(d.ref, { categoryId: target.id }));
        await batch.commit();
      }
      haptic('success');
    } catch (err) { toast({ message: 'Couldn’t move the expenses', sub: String(err?.message || err), kind: 'error' }); }
    setBusy(false);
  };

  return (
    <Sheet open={open && orphans.length > 0} onClose={close} labelledBy="se-unmapped-title">
      <h2 className="se-sheet__title" id="se-unmapped-title">New categories from your synced room</h2>
      <p className="dsh-unm__lead">Some synced expenses use a category this room doesn’t have yet. Create it here, or move them to one you already have.</p>
      {orphans.map(o => {
        const n = names[o.id];
        return (
          <div key={o.id} className="dsh-unm">
            <div className="dsh-unm__head">
              <CategoryIcon category={{ id: o.id, name: n?.name || '?', icon: n?.icon }} size={36} />
              <b>{n?.name || 'Unknown category'}</b>
              <span>{o.count} expense{o.count === 1 ? '' : 's'}</span>
            </div>
            <button type="button" className="se-btn se-btn--primary se-btn--sm se-press" disabled={busy} onClick={() => create(o)}>
              Create “{n?.name || 'Imported'}” here
            </button>
            <span className="dsh-unm__or">OR MOVE THEM TO</span>
            <div className="dsh-unm__chips">
              {categories.map(c => (
                <button key={c.id} type="button" className="se-chip se-press" disabled={busy} onClick={() => mapTo(o, c)}>{c.name}</button>
              ))}
            </div>
          </div>
        );
      })}
      <button type="button" className="se-btn se-btn--secondary se-press" onClick={close}>Decide later</button>
    </Sheet>
  );
}
