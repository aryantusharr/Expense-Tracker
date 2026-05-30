/* eslint-disable */
import { db } from './firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, getDoc, getDocs, where
} from 'firebase/firestore';

// Helper to calculate a user's exact share of a shared expense (equal split, last person receives remainder)
export function getMemberShare(amount, splitAmong, userId) {
  if (!splitAmong || !splitAmong.includes(userId) || amount === 0) return 0;
  const perPersonShare = amount / splitAmong.length;
  const roundedShare = Math.floor(perPersonShare * 100) / 100;
  const remainder = amount - (roundedShare * splitAmong.length);
  const index = splitAmong.indexOf(userId);
  return index === splitAmong.length - 1
    ? roundedShare + remainder
    : roundedShare;
}

// Fetch room data helper — strips extra fields like 'roomCode' that come from context
async function getRoomData(roomCode, roomData) {
  if (roomData) {
    // Room data from context has extra fields (roomCode, etc.) — just use it
    return roomData;
  }
  try {
    const roomSnap = await getDoc(doc(db, 'rooms', roomCode));
    return roomSnap.exists() ? roomSnap.data() : null;
  } catch (err) {
    console.error('getRoomData failed:', err);
    return null;
  }
}

/**
 * Helper to sync a single shared expense to all personal rooms of its split members.
 * This is fire-and-forget — errors don't block the main operation.
 */
async function syncExpenseToPersonalRooms(roomCode, roomData, expenseId, expense) {
  if (!roomData || roomData.isPersonal) return;

  const users = roomData.users || [];
  const amount = parseFloat(expense.amount) || 0;
  const splitAmong = expense.splitAmong || [];

  // Process all users in parallel for speed
  const syncPromises = users
    .filter(user => user.personalRoomCode)
    .map(async (user) => {
      try {
        const share = getMemberShare(amount, splitAmong, user.id);
        
        const personalExpensesRef = collection(db, 'rooms', user.personalRoomCode, 'expenses');
        const q = query(personalExpensesRef, where('parentExpenseId', '==', expenseId));
        const snap = await getDocs(q);
        const existingDoc = snap.docs[0];

        if (share > 0) {
          // Find the user ID in the personal room
          let personalUserId = 'user-personal';
          try {
            const personalRoomSnap = await getDoc(doc(db, 'rooms', user.personalRoomCode));
            if (personalRoomSnap.exists()) {
              const pData = personalRoomSnap.data();
              personalUserId = pData.users[0]?.id || 'user-personal';
            }
          } catch (e) {
            console.error("Failed to fetch personal room user:", e);
          }

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
            await addDoc(personalExpensesRef, {
              ...syncedData,
              createdAt: new Date().toISOString(),
            });
          }
        } else {
          // Share is 0 (removed from split), delete any existing synced document
          if (existingDoc) {
            await deleteDoc(existingDoc.ref);
          }
        }
      } catch (err) {
        console.error(`Failed to sync to personal room for user ${user.id}:`, err);
      }
    });

  await Promise.allSettled(syncPromises);
}

/**
 * Helper to delete synced expenses from personal rooms when a shared expense is deleted
 */
async function deleteSyncedExpensesFromPersonalRooms(roomData, expenseId) {
  if (!roomData || roomData.isPersonal) return;

  const users = roomData.users || [];
  const deletePromises = users
    .filter(user => user.personalRoomCode)
    .map(async (user) => {
      try {
        const personalExpensesRef = collection(db, 'rooms', user.personalRoomCode, 'expenses');
        const q = query(personalExpensesRef, where('parentExpenseId', '==', expenseId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      } catch (err) {
        console.error(`Failed to delete synced expense for user ${user.id}:`, err);
      }
    });

  await Promise.allSettled(deletePromises);
}

/**
 * Sync all existing shared expenses for a user to their personal room
 */
export async function syncExistingSharedExpenses(sharedRoomCode, sharedRoomName, personalRoomCode, userId) {
  try {
    const sharedExpensesRef = collection(db, 'rooms', sharedRoomCode, 'expenses');
    const sharedExpensesSnap = await getDocs(sharedExpensesRef);
    
    let personalUserId = 'user-personal';
    try {
      const personalRoomSnap = await getDoc(doc(db, 'rooms', personalRoomCode));
      if (personalRoomSnap.exists()) {
        const pData = personalRoomSnap.data();
        personalUserId = pData.users[0]?.id || 'user-personal';
      }
    } catch (e) {
      console.error("Failed to fetch personal room user:", e);
    }

    const personalExpensesRef = collection(db, 'rooms', personalRoomCode, 'expenses');

    for (const sharedDoc of sharedExpensesSnap.docs) {
      const sharedExp = sharedDoc.data();
      const amount = parseFloat(sharedExp.amount) || 0;
      const splitAmong = sharedExp.splitAmong || [];

      const share = getMemberShare(amount, splitAmong, userId);
      if (share > 0) {
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
          await addDoc(personalExpensesRef, {
            ...syncedData,
            createdAt: new Date().toISOString(),
          });
        } else {
          await updateDoc(personalSnap.docs[0].ref, syncedData);
        }
      }
    }
  } catch (err) {
    console.error("syncExistingSharedExpenses failed:", err);
  }
}

/**
 * Add an expense to a room.
 * The sync to personal rooms happens in the background and does NOT block the return.
 */
export async function addExpense(roomCode, expense, roomData = null) {
  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const expenseData = {
    ...expense,
    createdAt: new Date().toISOString(),
  };
  const docRef = await addDoc(expensesRef, expenseData);
  const newExpense = { id: docRef.id, ...expenseData };

  // Fire-and-forget sync — don't await, don't block the UI
  try {
    const rData = await getRoomData(roomCode, roomData);
    if (rData && !rData.isPersonal) {
      // Don't await — let it run in background
      syncExpenseToPersonalRooms(roomCode, rData, docRef.id, newExpense).catch(err => {
        console.error("Background sync failed:", err);
      });
    }
  } catch (err) {
    console.error("Failed to initiate sync:", err);
  }

  return newExpense;
}

/**
 * Update an existing expense
 */
export async function updateExpense(roomCode, expenseId, updates, roomData = null) {
  const expenseRef = doc(db, 'rooms', roomCode, 'expenses', expenseId);
  const updatedAt = new Date().toISOString();
  await updateDoc(expenseRef, {
    ...updates,
    updatedAt,
  });

  // Fire-and-forget sync
  try {
    const rData = await getRoomData(roomCode, roomData);
    if (rData && !rData.isPersonal) {
      const updatedSnap = await getDoc(expenseRef);
      if (updatedSnap.exists()) {
        syncExpenseToPersonalRooms(roomCode, rData, expenseId, updatedSnap.data()).catch(err => {
          console.error("Background sync update failed:", err);
        });
      }
    }
  } catch (err) {
    console.error("Failed to initiate sync update:", err);
  }
}

/**
 * Delete an expense
 */
export async function deleteExpense(roomCode, expenseId, roomData = null) {
  const expenseRef = doc(db, 'rooms', roomCode, 'expenses', expenseId);

  // Fire-and-forget sync delete
  try {
    const rData = await getRoomData(roomCode, roomData);
    if (rData && !rData.isPersonal) {
      deleteSyncedExpensesFromPersonalRooms(rData, expenseId).catch(err => {
        console.error("Background sync delete failed:", err);
      });
    }
  } catch (err) {
    console.error("Failed to initiate sync delete:", err);
  }

  await deleteDoc(expenseRef);
}

/**
 * Delete all synced expenses from a list of personal rooms that were synced from a specific shared room.
 */
export async function removeSyncedExpensesFromPersonalRooms(sharedRoomCode, personalRoomCodes = []) {
  if (!personalRoomCodes || personalRoomCodes.length === 0) return;
  
  const deletePromises = personalRoomCodes.map(async (pCode) => {
    try {
      const personalExpensesRef = collection(db, 'rooms', pCode, 'expenses');
      const q = query(
        personalExpensesRef,
        where('isSynced', '==', true),
        where('syncedFromRoomCode', '==', sharedRoomCode)
      );
      const snap = await getDocs(q);
      const subPromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(subPromises);
    } catch (err) {
      console.warn(`Failed to remove synced expenses from personal room ${pCode}:`, err);
    }
  });
  
  await Promise.allSettled(deletePromises);
}

/**
 * Subscribe to real-time expense updates
 */
export function subscribeToExpenses(roomCode, callback) {
  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const q = query(expensesRef, orderBy('date', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const expenses = [];
    snapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    callback(expenses);
  }, (error) => {
    console.error('subscribeToExpenses error:', error);
    // Still call callback with empty array to prevent infinite loading
    callback([]);
  });
}
