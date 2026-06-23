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
 * Ensures the expense's categoryId exists in the personal room.
 * If missing, silently copies the category object from the shared room into
 * the personal room's categories array.
 *
 * This runs for both new expenses (addExpense) and updates (updateExpense)
 * since both paths call syncExpenseToPersonalRooms.
 *
 * @param {string} personalRoomCode
 * @param {string} categoryId - The categoryId carried by the shared expense.
 * @param {Array}  sharedCategories - The shared room's categories array.
 */
async function ensureCategoryInPersonalRoom(personalRoomCode, categoryId, sharedCategories) {
  if (!categoryId || !personalRoomCode) return;

  try {
    const roomSnap = await getDoc(doc(db, 'rooms', personalRoomCode));
    if (!roomSnap.exists()) return;

    const personalCategories = roomSnap.data().categories || [];
    const alreadyExists = personalCategories.some(c => c.id === categoryId);
    if (alreadyExists) return;

    // Find the category in the shared room
    const categoryToSync = sharedCategories?.find(c => c.id === categoryId);
    if (!categoryToSync) return; // category not found in shared room either — skip

    // Copy category (name, icon, id preserved) into personal room via arrayUnion
    await updateDoc(doc(db, 'rooms', personalRoomCode), {
      categories: arrayUnion({
        id: categoryToSync.id,
        name: categoryToSync.name,
        icon: categoryToSync.icon || '📦',
      }),
    });
  } catch (err) {
    // Non-critical — never block the sync path
    console.warn('[SyncCategory] Failed to copy category to personal room:', err?.message);
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
      await ensureCategoryInPersonalRoom(
        user.personalRoomCode,
        expense.categoryId,
        roomData.categories,
      );

      const personalUserId = await getPersonalUserId(user.personalRoomCode);
      const syncedData = {
        description: expense.description,
        amount: share,
        categoryId: expense.categoryId,
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
