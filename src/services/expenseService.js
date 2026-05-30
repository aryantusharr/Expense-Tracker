import { db } from './firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, getDoc, getDocs, where
} from 'firebase/firestore';
import { syncExpenseToPersonalRooms } from '../utils/syncExpenseToPersonal';
import { deleteSyncedExpensesFromPersonalRooms } from '../utils/deleteSyncedExpenses';

// Re-export for backward compatibility
export { syncExistingSharedExpenses } from '../utils/syncExistingExpenses';

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
