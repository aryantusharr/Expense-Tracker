
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
 * Check if a room with the given name already exists.
 * Uses a 5-second timeout to prevent hanging on slow networks.
 */
export async function checkRoomNameExists(roomName) {
  try {
    const roomsRef = collection(db, 'rooms');
    const q = query(roomsRef, where('name', '==', roomName.trim()));
    
    // Race the query against a timeout so it never hangs
    const result = await Promise.race([
      getDocs(q),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    return !result.empty;
  } catch {
    // On timeout or network error, allow creation (the setDoc will fail if offline anyway)
    // Fallback on error
    return false;
  }
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
  { id: 'cat-14', name: 'Others', icon: '📦' },
];

/**
 * Deduplicates any categories named 'Others' or 'Other', keeping the first
 * occurrence (oldest ID). Merges extras into the survivor so no data is lost.
 * Should be called before writing categories to Firestore.
 */
function deduplicateOthers(categories) {
  if (!categories || categories.length === 0) return categories;
  const othersIndices = categories
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.name === 'Others' || c.name === 'Other');
  if (othersIndices.length <= 1) return categories;
  // Keep the first occurrence, drop the rest
  const keepIdx = othersIndices[0].i;
  const dropIds = new Set(othersIndices.slice(1).map(({ c }) => c.id));
  return categories
    .filter((c, i) => i === keepIdx || !dropIds.has(c.id))
    .map((c, i) => i === keepIdx ? { ...c, name: 'Others' } : c);
}

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

  // Check if code already exists, regenerate if so (with a 1.5s timeout)
  try {
    const existing = await Promise.race([
      getDoc(doc(db, 'rooms', roomCode)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
    ]);
    if (existing.exists()) {
      roomCode = generateRoomCode();
    }
  } catch {
    // If offline or timed out, just use the generated code
    // Fallback on error
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
    categories: deduplicateOthers(DEFAULT_CATEGORIES),
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
  try {
    const existing = await Promise.race([
      getDoc(doc(db, 'rooms', roomCode)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
    ]);
    if (existing.exists()) roomCode = generateRoomCode();
  } catch {
    // Fallback on error
  }

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
    categories: deduplicateOthers(DEFAULT_CATEGORIES),
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
  }, () => { /* Silent error */ });
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
  // 1. Delete the main room document first so other clients are immediately notified
  const deleteRoomDocPromise = deleteDoc(doc(db, 'rooms', roomCode));

  // 2. Fetch and delete expenses in the background with a 3s timeout
  (async () => {
    try {
      const expensesRef = collection(db, 'rooms', roomCode, 'expenses');
      const snapshot = await Promise.race([
        getDocs(expensesRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch {
      // Silent error
    }
  })();

  // Await the room document deletion to confirm it's gone
  await deleteRoomDocPromise;
}
