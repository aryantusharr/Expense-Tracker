import { db } from '../services/firebase';
import {
  collection, addDoc, updateDoc, doc,
  getDoc, getDocs, query, where
} from 'firebase/firestore';
import { getMemberShare } from '../services/expenseService';

/**
 * Sync all existing shared expenses for a user to their personal room.
 * Called when sync is first enabled or re-enabled.
 */
export async function syncExistingSharedExpenses(sharedRoomCode, sharedRoomName, personalRoomCode, userId) {
  const sharedExpensesRef = collection(db, 'rooms', sharedRoomCode, 'expenses');
  const sharedExpensesSnap = await getDocs(sharedExpensesRef);

  // Resolve personal room user ID
  let personalUserId = 'user-personal';
  try {
    const personalRoomSnap = await getDoc(doc(db, 'rooms', personalRoomCode));
    if (personalRoomSnap.exists()) {
      personalUserId = personalRoomSnap.data().users?.[0]?.id || 'user-personal';
    }
  } catch {
    // Fall through with default
  }

  const personalExpensesRef = collection(db, 'rooms', personalRoomCode, 'expenses');

  for (const sharedDoc of sharedExpensesSnap.docs) {
    const sharedExp = sharedDoc.data();
    const amount = parseFloat(sharedExp.amount) || 0;
    const splitAmong = sharedExp.splitAmong || [];

    const share = getMemberShare(amount, splitAmong, userId);
    if (share <= 0) continue;

    const q = query(personalExpensesRef, where('parentExpenseId', '==', sharedDoc.id));
    const personalSnap = await getDocs(q);

    const syncedData = {
      description: sharedExp.description,
      amount: share,
      categoryId: sharedExp.categoryId,
      date: sharedExp.date,
      paidBy: personalUserId,
      splitAmong: [personalUserId],
      isSynced: true,
      syncedFromRoomCode: sharedRoomCode,
      syncedFromRoomName: sharedRoomName,
      parentExpenseId: sharedDoc.id,
      updatedAt: new Date().toISOString(),
    };

    if (personalSnap.empty) {
      await addDoc(personalExpensesRef, { ...syncedData, createdAt: new Date().toISOString() });
    } else {
      await updateDoc(personalSnap.docs[0].ref, syncedData);
    }
  }
}
