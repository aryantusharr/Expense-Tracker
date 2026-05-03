import { db } from './firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy
} from 'firebase/firestore';

/**
 * Add an expense to a room
 */
export async function addExpense(roomCode, expense) {
  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const expenseData = {
    ...expense,
    createdAt: new Date().toISOString(),
  };
  const docRef = await addDoc(expensesRef, expenseData);
  return { id: docRef.id, ...expenseData };
}

/**
 * Update an existing expense
 */
export async function updateExpense(roomCode, expenseId, updates) {
  const expenseRef = doc(db, 'rooms', roomCode, 'expenses', expenseId);
  await updateDoc(expenseRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete an expense
 */
export async function deleteExpense(roomCode, expenseId) {
  const expenseRef = doc(db, 'rooms', roomCode, 'expenses', expenseId);
  await deleteDoc(expenseRef);
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
  });
}
