import { db } from '../services/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, getDoc, getDocs, where
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
 * Sync a single shared expense to all personal rooms of its split members.
 * Fire-and-forget — errors don't block the main operation.
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
      };

      if (existingDoc) {
        await updateDoc(existingDoc.ref, syncedData);
      } else {
        await addDoc(personalExpensesRef, { ...syncedData, createdAt: new Date().toISOString() });
      }
    });

  await Promise.allSettled(syncPromises);
}
