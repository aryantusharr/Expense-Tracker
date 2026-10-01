import { db } from '../services/firebase';
import { collection, doc, getDoc, getDocs, writeBatch, updateDoc, arrayUnion } from 'firebase/firestore';
import { getMemberShare } from '../services/expenseService';
import { resolvePersonalCategory } from './syncExpenseToPersonal';

const BATCH = 400; // Firestore allows 500 writes per batch

/**
 * Sync all existing shared expenses for a user to their personal room.
 * Called when sync is first enabled or re-enabled. Reads each room once and writes in batches,
 * so ~800 copies take seconds rather than a minute. Existing copies (same parentExpenseId) are
 * updated in place and stale ones deleted, so re-running it also repairs old copies. onProgress(done, total) is optional.
 */
export async function syncExistingSharedExpenses(sharedRoomCode, sharedRoomName, personalRoomCode, userId, onProgress) {
  const [sharedSnap, sharedRoomSnap, personalRoomSnap, personalSnap] = await Promise.all([
    getDocs(collection(db, 'rooms', sharedRoomCode, 'expenses')),
    getDoc(doc(db, 'rooms', sharedRoomCode)),
    getDoc(doc(db, 'rooms', personalRoomCode)),
    getDocs(collection(db, 'rooms', personalRoomCode, 'expenses')),
  ]);

  const personalRoom = personalRoomSnap.exists() ? personalRoomSnap.data() : {};
  const personalUserId = personalRoom.users?.[0]?.id || 'user-personal';
  const sharedCategories = sharedRoomSnap.exists() ? sharedRoomSnap.data().categories || [] : [];

  // shared category id -> personal category id (matched by name; missing ones copied in once)
  const personalCategories = [...(personalRoom.categories || [])];
  const toAdd = [];
  const catMap = {};
  const mapCategory = sharedId => {
    if (!sharedId) return sharedId;
    if (sharedId in catMap) return catMap[sharedId];
    const { id, add } = resolvePersonalCategory(personalCategories, sharedCategories.find(c => c.id === sharedId), sharedRoomCode);
    if (add) { personalCategories.push(add); toAdd.push(add); }
    catMap[sharedId] = id || sharedId;
    return catMap[sharedId];
  };

  // Copies already in the personal room from THIS shared room, by parent id.
  const existing = new Map();
  personalSnap.docs.forEach(d => { const x = d.data(); if (x.parentExpenseId && (!x.syncedFromRoomCode || x.syncedFromRoomCode === sharedRoomCode)) existing.set(x.parentExpenseId, d.ref); });
  const kept = new Set();

  const personalExpensesRef = collection(db, 'rooms', personalRoomCode, 'expenses');
  const writes = [];
  const now = new Date().toISOString();
  for (const sharedDoc of sharedSnap.docs) {
    const sharedExp = sharedDoc.data();
    const share = getMemberShare(parseFloat(sharedExp.amount) || 0, sharedExp.splitAmong || [], userId);
    if (share <= 0) continue;
    const syncedData = {
      description: sharedExp.description,
      amount: share,
      categoryId: mapCategory(sharedExp.categoryId),
      date: sharedExp.date,
      paidBy: personalUserId,
      splitAmong: [personalUserId],
      isSynced: true,
      syncedFromRoomCode: sharedRoomCode,
      syncedFromRoomName: sharedRoomName,
      parentExpenseId: sharedDoc.id,
      updatedAt: now,
      ...(sharedExp.isItemised ? { isItemised: true, groupId: sharedExp.groupId, groupName: sharedExp.groupName } : {}),
    };
    const ref = existing.get(sharedDoc.id);
    kept.add(sharedDoc.id);
    writes.push(ref ? { ref, data: syncedData, update: true } : { ref: doc(personalExpensesRef), data: { ...syncedData, createdAt: now } });
  }

  // Stale copies (parent deleted, or this member's share is now 0) go too.
  existing.forEach((ref, pid) => { if (!kept.has(pid)) writes.push({ ref, del: true }); });

  if (toAdd.length) await updateDoc(doc(db, 'rooms', personalRoomCode), { categories: arrayUnion(...toAdd) });

  onProgress?.(0, writes.length);
  for (let i = 0; i < writes.length; i += BATCH) {
    const batch = writeBatch(db);
    writes.slice(i, i + BATCH).forEach(w => (w.del ? batch.delete(w.ref) : w.update ? batch.update(w.ref, w.data) : batch.set(w.ref, w.data)));
    await batch.commit();
    onProgress?.(Math.min(i + BATCH, writes.length), writes.length);
  }
  return kept.size;
}
