import { db } from '../services/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, getDoc, getDocs, where, arrayUnion
} from 'firebase/firestore';
import { getMemberShare } from '../services/expenseService';

/**
 * Resolves the first user ID in a personal room.
 */
async function getPersonalUserId(personalRoomCode) {
  try {
    const snap = await getDoc(doc(db, 'rooms', personalRoomCode));
    if (!snap.exists()) return 'user-personal';
    return snap.data().users?.[0]?.id || 'user-personal';
  } catch {
    return 'user-personal';
  }
}

/**
 * Pick the personal-room category a synced copy should use.
 * Category ids are only unique per room (both rooms can have a "cat-4" meaning different things),
 * so match by name first, then by id only if the names agree; otherwise copy the shared category
 * in (keeping its id when that id is free in the personal room).
 * Returns { id, add } — `add` is a category object to append to the personal room, or null.
 */
export function resolvePersonalCategory(personalCategories, sharedCategory, sharedRoomCode) {
  if (!sharedCategory) return { id: null, add: null };
  const name = (sharedCategory.name || '').trim().toLowerCase();
  const byName = personalCategories.find(c => (c.name || '').trim().toLowerCase() === name);
  if (byName) return { id: byName.id, add: null };
  const idTaken = personalCategories.some(c => c.id === sharedCategory.id);
  const id = idTaken ? `${sharedCategory.id}-${sharedRoomCode}` : sharedCategory.id;
  return { id, add: { id, name: sharedCategory.name, icon: sharedCategory.icon || '📦' } };
}

/**
 * Make sure the shared expense's category exists in the personal room (matched by name) and
 * return the personal room's id for it. Runs on every add AND edit of a shared expense.
 */
async function ensureCategoryInPersonalRoom(personalRoomCode, sharedRoomCode, categoryId, sharedCategories) {
  if (!categoryId || !personalRoomCode) return categoryId;
  const sharedCategory = sharedCategories?.find(c => c.id === categoryId);
  if (!sharedCategory) return categoryId;
  try {
    const roomSnap = await getDoc(doc(db, 'rooms', personalRoomCode));
    if (!roomSnap.exists()) return categoryId;
    const { id, add } = resolvePersonalCategory(roomSnap.data().categories || [], sharedCategory, sharedRoomCode);
    if (add) await updateDoc(doc(db, 'rooms', personalRoomCode), { categories: arrayUnion(add) });
    return id || categoryId;
  } catch (err) {
    // Non-critical — never block the sync path
    console.warn('[SyncCategory] Failed to copy category to personal room:', err?.message);
    return categoryId;
  }
}

/**
 * Sync a single shared expense to all personal rooms of its split members.
 * Fire-and-forget — errors don't block the main operation.
 *
 * Also called when an expense is *updated* (e.g. category changed in shared room),
 * so the ensureCategoryInPersonalRoom guard runs on every add AND edit.
 */
export async function syncExpenseToPersonalRooms(roomCode, roomData, expenseId, expense) {
  if (!roomData || roomData.isPersonal) return;

  const users = roomData.users || [];
  const amount = parseFloat(expense.amount) || 0;
  const splitAmong = expense.splitAmong || [];

  const syncPromises = users
    .filter(user => user.personalRoomCode)
    .map(async (user) => {
      const share = getMemberShare(amount, splitAmong, user.id);
      const personalExpensesRef = collection(db, 'rooms', user.personalRoomCode, 'expenses');
      const q = query(personalExpensesRef, where('parentExpenseId', '==', expenseId));
      const snap = await getDocs(q);
      const existingDoc = snap.docs[0];

      if (share <= 0) {
        if (existingDoc) await deleteDoc(existingDoc.ref);
        return;
      }

      // Ensure the category exists in the personal room before writing the expense.
      // Handles both new syncs and category edits in the shared room.
      const personalCategoryId = await ensureCategoryInPersonalRoom(
        user.personalRoomCode,
        roomCode,
        expense.categoryId,
        roomData.categories,
      );

      const personalUserId = await getPersonalUserId(user.personalRoomCode);
      const syncedData = {
        description: expense.description,
        amount: share,
        categoryId: personalCategoryId,
        date: expense.date,
        paidBy: personalUserId,
        splitAmong: [personalUserId],
        isSynced: true,
        syncedFromRoomCode: roomCode,
        syncedFromRoomName: roomData.name,
        parentExpenseId: expenseId,
        updatedAt: new Date().toISOString(),
        ...(expense.isItemised ? {
          isItemised: true,
          groupId: expense.groupId,
          groupName: expense.groupName,
        } : {}),
      };

      if (existingDoc) {
        await updateDoc(existingDoc.ref, syncedData);
      } else {
        await addDoc(personalExpensesRef, { ...syncedData, createdAt: new Date().toISOString() });
      }
    });

  await Promise.allSettled(syncPromises);
}

/**
 * A category was added in a shared room: create it (matched by name) in every synced member's
 * personal room right away, so later copies find it. Fire-and-forget.
 */
export async function addCategoryToSyncedRooms(sharedRoomCode, roomData, category) {
  const codes = [...new Set((roomData?.users || []).map(u => u.personalRoomCode).filter(Boolean))];
  await Promise.allSettled(codes.map(async code => {
    const snap = await getDoc(doc(db, 'rooms', code));
    if (!snap.exists()) return;
    const { add } = resolvePersonalCategory(snap.data().categories || [], category, sharedRoomCode);
    if (add) await updateDoc(doc(db, 'rooms', code), { categories: arrayUnion(add) });
  }));
}
