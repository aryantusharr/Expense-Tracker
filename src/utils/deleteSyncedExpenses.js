import { db } from '../services/firebase';
import { collection, deleteDoc, query, getDocs, where } from 'firebase/firestore';

/**
 * Delete synced expenses from personal rooms when a shared expense is deleted.
 */
export async function deleteSyncedExpensesFromPersonalRooms(roomData, expenseId) {
  if (!roomData || roomData.isPersonal) return;

  const users = roomData.users || [];
  const deletePromises = users
    .filter(user => user.personalRoomCode)
    .map(async (user) => {
      const personalExpensesRef = collection(db, 'rooms', user.personalRoomCode, 'expenses');
      const q = query(personalExpensesRef, where('parentExpenseId', '==', expenseId));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    });

  await Promise.allSettled(deletePromises);
}
