import { db } from './firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, getDoc, getDocs, where, writeBatch,
  setDoc, serverTimestamp, increment
} from 'firebase/firestore';
import { syncExpenseToPersonalRooms } from '../utils/syncExpenseToPersonal';
import { deleteSyncedExpensesFromPersonalRooms } from '../utils/deleteSyncedExpenses';

// Re-export for backward compatibility
export { syncExistingSharedExpenses } from '../utils/syncExistingExpenses';

/**
 * Learns a description–category association by incrementing a global Firestore counter.
 * Uses a deterministic document ID to prevent duplicates without requiring composite indexes.
 * MUST be called fire-and-forget (non-blocking) — never await this in the UI path.
 *
 * @param {string} description - Raw description text entered by the user.
 * @param {string} categoryId  - The selected category ID.
 * @param {string} [categoryName] - Optional resolved category name (e.g. 'Groceries').
 */
export async function learnPatternFromExpense(description, categoryId, categoryName = '') {
  if (!description || !categoryId) return;

  const normalized = description.trim().toLowerCase();
  if (!normalized || normalized.length < 2) return;

  // Deterministic ID: prevents duplicate documents without composite indexes
  const docId = `${normalized}_${categoryId}`.replace(/[/]/g, '_').slice(0, 500);
  const ref = doc(db, 'learned_patterns', docId);

  const now = serverTimestamp();

  try {
    // Atomic create-or-update: merge ensures we don't overwrite existing fields
    // createdAt is only written on first create (field won't exist yet)
    await setDoc(ref, {
      description,
      normalizedDescription: normalized,
      categoryId,
      categoryName: categoryName || categoryId,
      count: increment(1),
      lastUsedAt: now,
      window30days: true,
    }, { merge: true });

    // Read back the updated count to check if we've crossed the learned threshold
    const updatedSnap = await getDoc(ref);
    if (updatedSnap.exists()) {
      const data = updatedSnap.data();

      const updates = {};

      // Promote to learned once count reaches 5
      if ((data.count || 0) >= 5 && !data.learned) {
        updates.learned = true;
      }

      // Stamp createdAt on first save (won't exist yet on new docs)
      if (!data.createdAt) {
        updates.createdAt = now;
      }

      if (Object.keys(updates).length > 0) {
        await setDoc(ref, updates, { merge: true });
      }
    }
  } catch (err) {
    // Silently swallow — never let pattern learning affect the save pipeline
    console.warn('[LearnPattern] Non-critical write failed:', err?.message);
  }
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
  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const expenseData = { ...expense, createdAt: new Date().toISOString() };
  const docRef = await addDoc(expensesRef, expenseData);
  const newExpense = { id: docRef.id, ...expenseData };

  // Fire-and-forget sync
  const rData = await getRoomData(roomCode, roomData).catch(() => null);
  if (rData && !rData.isPersonal) {
    syncExpenseToPersonalRooms(roomCode, rData, docRef.id, newExpense).catch(() => {});
  }

  // Fire-and-forget pattern learning (non-blocking)
  learnPatternFromExpense(
    expense.description,
    expense.categoryId,
  ).catch(() => {});

  return newExpense;
}

/**
 * Update an existing expense.
 */
export async function updateExpense(roomCode, expenseId, updates, roomData = null) {
  const expenseRef = doc(db, 'rooms', roomCode, 'expenses', expenseId);
  await updateDoc(expenseRef, { ...updates, updatedAt: new Date().toISOString() });

  // Fire-and-forget sync
  const rData = await getRoomData(roomCode, roomData).catch(() => null);
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
    const docRef = await addDoc(expensesRef, expenseData);
    savedItems.push({ id: docRef.id, ...expenseData });
  }

  // Fire-and-forget sync (sync each item individually)
  const rData = await getRoomData(roomCode, roomData).catch(() => null);
  if (rData && !rData.isPersonal) {
    savedItems.forEach(item => {
      syncExpenseToPersonalRooms(roomCode, rData, item.id, item).catch(() => {});
    });
  }

  // Fire-and-forget pattern learning for each itemised row
  savedItems.forEach(item => {
    learnPatternFromExpense(
      item.description || groupName,
      item.categoryId,
    ).catch(() => {});
  });

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
