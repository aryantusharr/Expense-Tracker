import { db } from './firebase';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, arrayUnion, onSnapshot,
  collection, query, where, getDocs
} from 'firebase/firestore';

// Generate a 6-character room code
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Check if a room with the given name already exists
 */
export async function checkRoomNameExists(roomName) {
  const roomsRef = collection(db, 'rooms');
  const q = query(roomsRef, where('name', '==', roomName.trim()));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

// Default categories preloaded for every room
const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Groceries', icon: '🛒' },
  { id: 'cat-2', name: 'Rent', icon: '🏡' },
  { id: 'cat-3', name: 'Utilities', icon: '⚡' },
  { id: 'cat-4', name: 'Food & Dining', icon: '🍽️' },
  { id: 'cat-5', name: 'Transport', icon: '🚕' },
  { id: 'cat-6', name: 'Entertainment', icon: '🎭' },
  { id: 'cat-7', name: 'Shopping', icon: '🛍️' },
  { id: 'cat-8', name: 'Health', icon: '💊' },
  { id: 'cat-9', name: 'Drinks & Alcohol', icon: '🍻' },
  { id: 'cat-10', name: 'Smoking', icon: '🚬' },
  { id: 'cat-11', name: 'Subscriptions', icon: '📱' },
  { id: 'cat-12', name: 'Coffee & Tea', icon: '☕' },
  { id: 'cat-13', name: 'Party & Nightlife', icon: '🪩' },
  { id: 'cat-14', name: 'Other', icon: '📦' },
];

// User colors palette
const USER_COLORS = [
  '#6c5ce7', '#00cec9', '#ff6b6b', '#feca57', '#54a0ff',
  '#ff9ff3', '#5f27cd', '#01a3a4', '#f368e0', '#ff9f43'
];

/**
 * Create a new room in Firestore
 */
export async function createRoom(roomName, userNames) {
  let roomCode = generateRoomCode();

  // Check if code already exists, regenerate if so
  const existing = await getDoc(doc(db, 'rooms', roomCode));
  if (existing.exists()) {
    roomCode = generateRoomCode();
  }

  const users = userNames.map((name, i) => ({
    id: `user-${Date.now()}-${i}`,
    name: name.trim(),
    color: USER_COLORS[i % USER_COLORS.length],
    avatar: name.trim().charAt(0).toUpperCase(),
  }));

  const roomData = {
    name: roomName,
    code: roomCode,
    users,
    categories: DEFAULT_CATEGORIES,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'rooms', roomCode), roomData);
  return { roomCode, roomData };
}

/**
 * Create a personal expense tracker (single user, no splitting)
 */
export async function createPersonalTracker(userName, monthlyBudget = 0) {
  let roomCode = generateRoomCode();
  const existing = await getDoc(doc(db, 'rooms', roomCode));
  if (existing.exists()) roomCode = generateRoomCode();

  const users = [{
    id: `user-${Date.now()}-0`,
    name: userName.trim(),
    color: USER_COLORS[0],
    avatar: userName.trim().charAt(0).toUpperCase(),
  }];

  const roomData = {
    name: `${userName}'s Expenses`,
    code: roomCode,
    users,
    categories: DEFAULT_CATEGORIES,
    isPersonal: true,
    budget: monthlyBudget,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'rooms', roomCode), roomData);
  return { roomCode, roomData };
}

/**
 * Join an existing room by code
 */
export async function joinRoom(roomCode) {
  const code = roomCode.toUpperCase().trim();
  const roomRef = doc(db, 'rooms', code);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error('Room not found. Check the code and try again.');
  }

  return { roomCode: code, roomData: roomSnap.data() };
}

/**
 * Listen to room changes in real-time
 */
export function subscribeToRoom(roomCode, callback, onNotFound) {
  const roomRef = doc(db, 'rooms', roomCode);
  return onSnapshot(roomRef, (snap) => {
    if (snap.exists()) {
      callback({ roomCode, ...snap.data() });
    } else if (onNotFound) {
      onNotFound();
    }
  });
}

/**
 * Add a new user to an existing room
 */
export async function addUserToRoom(roomCode, userName) {
  const roomRef = doc(db, 'rooms', roomCode);
  const roomSnap = await getDoc(roomRef);
  const data = roomSnap.data();
  const index = data.users.length;

  const newUser = {
    id: `user-${Date.now()}`,
    name: userName.trim(),
    color: USER_COLORS[index % USER_COLORS.length],
    avatar: userName.trim().charAt(0).toUpperCase(),
  };

  await updateDoc(roomRef, {
    users: arrayUnion(newUser)
  });

  return newUser;
}

/**
 * Update categories in a room
 */
export async function updateCategories(roomCode, categories) {
  const roomRef = doc(db, 'rooms', roomCode);
  await updateDoc(roomRef, { categories });
}

/**
 * Update room metadata (like budget)
 */
export async function updateRoomData(roomCode, updates) {
  const roomRef = doc(db, 'rooms', roomCode);
  await updateDoc(roomRef, updates);
}

/**
 * Permanently delete a room and all its expenses from Firestore
 */
export async function deleteRoom(roomCode) {
  // Delete all expenses in the subcollection first
  const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
  const snapshot = await getDocs(expensesRef);
  const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);

  // Delete the room document
  await deleteDoc(doc(db, 'rooms', roomCode));
}
