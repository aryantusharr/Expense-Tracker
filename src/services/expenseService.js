import { db } from './firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, getDoc, getDocs, where, writeBatch
} from 'firebase/firestore';
import { syncExpenseToPersonalRooms } from '../utils/syncExpenseToPersonal';
import { deleteSyncedExpensesFromPersonalRooms } from '../utils/deleteSyncedExpenses';
import { getUsageFieldsForNewExpense, getUsageFieldsForUpdatedExpense } from '../utils/expenseFormHelpers';

// Re-export for backward compatibility
export { syncExistingSharedExpenses } from '../utils/syncExistingExpenses';

// DEPRECATED: learnPatternFromExpense removed. No code should reference
// 'learned' or 'regex' pattern storage. Category auto-select uses
// Hinglish keyword mapping only (see utils/categoryRegex.js BASE_CATEGORY_REGEX).

/**
 * Resolves a safe categoryId for a given expense.
 * If the provided categoryId doesn't exist in roomData.categories, falls back
 * to the first 'Others'/'Other' category to prevent silent mis-mapping.
 *
 * @param {string} categoryId - The categoryId to validate.
 * @param {Object|null} roomData - The room document (may be null).
 * @returns {string} A valid categoryId, or the original if room data unavailable.
 */
function resolveSafeCategoryId(categoryId, roomData) {
  const cats = roomData?.categories;
  if (!cats || cats.length === 0) return categoryId; // can't validate — pass through
  const exists = cats.some(c => c.id === categoryId);
  if (exists) return categoryId;
  // Soft fallback: find 'Others' or 'Other'
  const fallback = cats.find(c => c.name === 'Others' || c.name === 'Other');
  if (fallback) {
    console.warn(
      `[ExpenseService] categoryId "${categoryId}" not found in room. ` +
      `Falling back to "${fallback.name}" (${fallback.id}).`
    );
    return fallback.id;
  }
  // No 'Others' either — use first category as last resort
  return cats[0].id;
}

/**
 * Calculate a user's exact share of a shared expense (equal split, last person receives remainder).
 */
export function getMemberShare(amount, splitAmong, userId) {
  if (!splitAmong || !splitAmong.includes(userId) || amount === 0) return 0;
  const perPersonShare = amount / splitAmong.length;
  const roundedShare = Math.floor(perPersonShare * 100) / 100;
  const remainder = amount - (roundedShare * splitAmong.length);
  const index = splitAmong.indexOf(userId);
  return index === splitAmong.length - 1 ? roundedShare + remainder : roundedShare;
}

/**
 * Fetch room data, falling back to Firestore if not provided from context.
 */
async function getRoomData(roomCode, roomData) {
  if (roomData) return roomData;
  try {
    const roomSnap = await getDoc(doc(db, 'rooms', roomCode));
    return roomSnap.exists() ? roomSnap.data() : null;
  } catch {
    return null;
  }
}

/**
 * Add an expense. Sync to personal rooms happens in the background.
 */
export async function addExpense(roomCode, expense, roomData = null) {
  const rData = await getRoomData(roomCode, roomData).catch(() => null);

  // Soft-validate categoryId — fall back to 'Others' if ID doesn't exist in room
  const safeCategoryId = resolveSafeCategoryId(expense.categoryId, rData);

  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const snap = await getDocs(expensesRef).catch(() => null);
  const existingExpenses = snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];

  const expenseData = {
    ...expense,
    categoryId: safeCategoryId,
    createdAt: new Date().toISOString(),
  };

  const { usageCount, lastUsedAt } = getUsageFieldsForNewExpense(expenseData, existingExpenses);
  expenseData.usageCount = usageCount;
  expenseData.lastUsedAt = lastUsedAt;

  const docRef = await addDoc(expensesRef, expenseData);
  const newExpense = { id: docRef.id, ...expenseData };

  // Fire-and-forget sync
  if (rData && !rData.isPersonal) {
    syncExpenseToPersonalRooms(roomCode, rData, docRef.id, newExpense).catch(() => {});
  }

  return newExpense;
}

/**
 * Update an existing expense.
 */
export async function updateExpense(roomCode, expenseId, updates, roomData = null) {
  const rData = await getRoomData(roomCode, roomData).catch(() => null);

  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const snap = await getDocs(expensesRef).catch(() => null);
  const existingExpenses = snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  const oldExpense = existingExpenses.find(e => e.id === expenseId);

  // Soft-validate categoryId if it's being updated
  const safeUpdates = { ...updates };
  if (safeUpdates.categoryId !== undefined) {
    safeUpdates.categoryId = resolveSafeCategoryId(safeUpdates.categoryId, rData);
  }

  if (oldExpense) {
    const updatedExpense = { ...oldExpense, ...safeUpdates };
    const { usageCount, lastUsedAt } = getUsageFieldsForUpdatedExpense(updatedExpense, existingExpenses, expenseId);
    safeUpdates.usageCount = usageCount;
    safeUpdates.lastUsedAt = lastUsedAt;
  }

  const expenseRef = doc(db, 'rooms', roomCode, 'expenses', expenseId);
  await updateDoc(expenseRef, { ...safeUpdates, updatedAt: new Date().toISOString() });

  // Fire-and-forget sync
  if (rData && !rData.isPersonal) {
    const updatedSnap = await getDoc(expenseRef).catch(() => null);
    if (updatedSnap?.exists()) {
      syncExpenseToPersonalRooms(roomCode, rData, expenseId, updatedSnap.data()).catch(() => {});
    }
  }
}

/**
 * Delete an expense.
 */
export async function deleteExpense(roomCode, expenseId, roomData = null) {
  const expenseRef = doc(db, 'rooms', roomCode, 'expenses', expenseId);

  // Fire-and-forget sync delete
  const rData = await getRoomData(roomCode, roomData).catch(() => null);
  if (rData && !rData.isPersonal) {
    deleteSyncedExpensesFromPersonalRooms(rData, expenseId).catch(() => {});
  }

  await deleteDoc(expenseRef);
}

/**
 * Delete all synced expenses from personal rooms for a specific shared room.
 */
export async function removeSyncedExpensesFromPersonalRooms(sharedRoomCode, personalRoomCodes = []) {
  if (!personalRoomCodes?.length) return;

  const deletePromises = personalRoomCodes.map(async (pCode) => {
    const personalExpensesRef = collection(db, 'rooms', pCode, 'expenses');
    const q = query(
      personalExpensesRef,
      where('isSynced', '==', true),
      where('syncedFromRoomCode', '==', sharedRoomCode)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  });

  await Promise.allSettled(deletePromises);
}

/**
 * Subscribe to real-time expense updates.
 */
export function subscribeToExpenses(roomCode, callback) {
  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const q = query(expensesRef, orderBy('date', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const expenses = [];
    snapshot.forEach((d) => { expenses.push({ id: d.id, ...d.data() }); });
    callback(expenses);
  }, () => {
    callback([]);
  });
}

/**
 * Add a group of itemised expenses in a single batch under one groupId.
 * All items share the same groupId, groupName, and isItemised flag.
 */
export async function addItemisedExpenseGroup(roomCode, groupName, items, commonFields, roomData = null) {
  const groupId = `grp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const createdAt = new Date().toISOString();
  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const snap = await getDocs(expensesRef).catch(() => null);
  const existingExpenses = snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
  const savedItems = [];

  for (const item of items) {
    const expenseData = {
      ...commonFields,
      description: item.description.trim() || groupName,
      amount: parseFloat(item.amount),
      categoryId: item.categoryId,
      ...(item.splitAmong ? { splitAmong: item.splitAmong } : {}),
      groupId,
      groupName: groupName.trim(),
      isItemised: true,
      createdAt,
    };

    const { usageCount, lastUsedAt } = getUsageFieldsForNewExpense(expenseData, existingExpenses);
    expenseData.usageCount = usageCount;
    expenseData.lastUsedAt = lastUsedAt;

    const docRef = await addDoc(expensesRef, expenseData);
    const savedItem = { id: docRef.id, ...expenseData };
    savedItems.push(savedItem);
    existingExpenses.push(savedItem);
  }

  // Fire-and-forget sync (sync each item individually)
  const rData = await getRoomData(roomCode, roomData).catch(() => null);
  if (rData && !rData.isPersonal) {
    savedItems.forEach(item => {
      syncExpenseToPersonalRooms(roomCode, rData, item.id, item).catch(() => {});
    });
  }

  return { groupId, groupName, items: savedItems };
}

/**
 * Rename all expenses in an itemised group atomically (Firestore batch write).
 */
export async function updateGroupName(roomCode, groupId, newGroupName, roomData = null) {
  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const q = query(expensesRef, where('groupId', '==', groupId));
  const snap = await getDocs(q);

  if (snap.empty) return;

  const batch = writeBatch(db);
  const updatedAt = new Date().toISOString();
  snap.docs.forEach(d => {
    batch.update(d.ref, { groupName: newGroupName.trim(), updatedAt });
  });
  await batch.commit();

  // Also sync group name changes to personal rooms
  try {
    const rData = await getRoomData(roomCode, roomData);
    if (rData && !rData.isPersonal && rData.users) {
      const personalRoomCodes = rData.users
        .filter(u => u.personalRoomCode)
        .map(u => u.personalRoomCode);

      for (const pCode of personalRoomCodes) {
        const pExpensesRef = collection(db, 'rooms', pCode, 'expenses');
        const pq = query(pExpensesRef, where('groupId', '==', groupId));
        const psnap = await getDocs(pq);
        if (!psnap.empty) {
          const pBatch = writeBatch(db);
          psnap.docs.forEach(pd => {
            pBatch.update(pd.ref, { groupName: newGroupName.trim(), updatedAt });
          });
          await pBatch.commit();
        }
      }
    }
  } catch (err) {
    console.error('Failed to sync group name update to personal rooms:', err);
  }
}
