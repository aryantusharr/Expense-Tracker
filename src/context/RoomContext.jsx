// RoomContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToRoom, updateRoomData } from '../services/roomService';
import { subscribeToExpenses } from '../services/expenseService';


const RoomContext = createContext(null);

/**
 * Helper: get saved rooms from localStorage
 */
function loadSavedRooms() {
  try {
    return JSON.parse(localStorage.getItem('splitease_saved') || '[]');
  } catch { return []; }
}

/**
 * Persist & hydrate room data and expenses from localStorage cache
 * so the app works offline after the first online session.
 */
function cacheRoomData(code, data) {
  try {
    localStorage.setItem(`splitease_room_cache_${code}`, JSON.stringify(data));
  } catch { /* storage full — ignore */ }
}

function getCachedRoomData(code) {
  try {
    const raw = localStorage.getItem(`splitease_room_cache_${code}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cacheExpenses(code, list) {
  try {
    localStorage.setItem(`splitease_expenses_cache_${code}`, JSON.stringify(list));
  } catch { /* storage full — ignore */ }
}

function getCachedExpenses(code) {
  try {
    const raw = localStorage.getItem(`splitease_expenses_cache_${code}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function RoomProvider({ children }) {
  const [room, setRoom] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(() => {
    return !!localStorage.getItem('splitease_room');
  });
  const [savedRooms, setSavedRooms] = useState(loadSavedRooms);
  const [roomCode, setRoomCode] = useState(() => {
    return localStorage.getItem('splitease_room') || null;
  });
  const [userIdentity, setUserIdentity] = useState(() => {
    const code = localStorage.getItem('splitease_room');
    if (!code) return null;
    return localStorage.getItem(`splitease_identity_${code}`) || null;
  });

  // Keep a ref of room categories to avoid stale closures in the live snapshot listener
  const categoriesRef = useRef([]);
  useEffect(() => {
    categoriesRef.current = room?.categories || [];
  }, [room?.categories]);

  // Hydrate from cache on cold load when offline
  useEffect(() => {
    if (!roomCode) return;
    const cachedRoom = getCachedRoomData(roomCode);
    const cachedExpenses = getCachedExpenses(roomCode);
    Promise.resolve().then(() => {
      if (cachedRoom && !room) {
        setRoom(cachedRoom);
      }
      if (cachedExpenses && expenses.length === 0) {
        setExpenses(cachedExpenses);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Persist savedRooms to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('splitease_saved', JSON.stringify(savedRooms));
  }, [savedRooms]);

  // Update identity when room changes
  useEffect(() => {
    if (!roomCode) {
// eslint-disable-next-line react-hooks/set-state-in-effect
      setUserIdentity(null);
      return;
    }
    if (room?.isPersonal) {
      setUserIdentity(room.users[0]?.id || null);
    } else {
      const savedIdentity = localStorage.getItem(`splitease_identity_${roomCode}`);
      setUserIdentity(savedIdentity || null);
    }
  }, [roomCode, room?.isPersonal, room?.users]);

  // Track unsubscribe functions for re-subscription on 'online'
  const unsubRoomRef = useRef(null);
  const unsubExpensesRef = useRef(null);

  const subscribeAndListen = useCallback((code) => {
    if (!code) return;

    setLoading(true);

    // Safety timeout — never stay loading for more than 10 seconds
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    const unsubRoom = subscribeToRoom(
      code,
      (roomData) => {
        setRoom(roomData);
        cacheRoomData(code, roomData); // persist for offline
        // Auto-save to room list
        setSavedRooms(prev => {
          const exists = prev.find(r => r.code === code);
          const memberCount = roomData.users?.length || 1;
          if (exists) {
            if (exists.name !== roomData.name || exists.memberCount !== memberCount) {
              return prev.map(r => r.code === code ? { ...r, name: roomData.name, memberCount } : r);
            }
            return prev;
          }
          return [...prev, { code, name: roomData.name, isPersonal: !!roomData.isPersonal, memberCount }];
        });
        clearTimeout(safetyTimeout);
        setLoading(false);
      },
      () => {
        // Room was deleted from Firestore — only clear if we are online
        // If offline, keep the cached session alive
        if (!navigator.onLine) {
          clearTimeout(safetyTimeout);
          setLoading(false);
          return;
        }
        localStorage.removeItem('splitease_room');
        setSavedRooms(prev => prev.filter(r => r.code !== code));
        setRoomCode(null);
        setRoom(null);
        setExpenses([]);
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    );

    const unsubExpenses = subscribeToExpenses(code, (expenseList) => {
      setExpenses(expenseList);
      cacheExpenses(code, expenseList); // persist for offline
    });

    unsubRoomRef.current = unsubRoom;
    unsubExpensesRef.current = unsubExpenses;

    return () => {
      clearTimeout(safetyTimeout);
      unsubRoom();
      unsubExpenses();
    };
  }, []);

  // Subscribe to room data
  useEffect(() => {
    if (!roomCode) {
// eslint-disable-next-line react-hooks/set-state-in-effect
      setRoom(null);
      setExpenses([]);
      setLoading(false);
      return;
    }

    const cleanup = subscribeAndListen(roomCode);

    return cleanup;
  }, [roomCode, subscribeAndListen]);

  // Re-subscribe when connectivity is restored
  useEffect(() => {
    const handleOnline = () => {
      if (roomCode) {
        // Unsubscribe stale listeners then re-subscribe
        if (unsubRoomRef.current) unsubRoomRef.current();
        if (unsubExpensesRef.current) unsubExpensesRef.current();
        subscribeAndListen(roomCode);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [roomCode, subscribeAndListen]);

  const joinRoomSession = useCallback((code) => {
    localStorage.setItem('splitease_room', code);
    setRoomCode(code);
  }, []);

  // Switch room = go back to picker (keep saved)
  const switchRoom = useCallback(() => {
    localStorage.removeItem('splitease_room');
    setRoomCode(null);
    setRoom(null);
    setExpenses([]);
    setLoading(false);
  }, []);

  // Forget room = remove from saved list too
  const forgetRoom = useCallback((code) => {
    setSavedRooms(prev => prev.filter(r => r.code !== code));
    if (code === roomCode) {
      localStorage.removeItem('splitease_room');
      setRoomCode(null);
      setRoom(null);
      setExpenses([]);
      setLoading(false);
    }
  }, [roomCode]);

  const setUserIdentityInRoom = useCallback((userId) => {
    if (roomCode) {
      localStorage.setItem(`splitease_identity_${roomCode}`, userId);
      setUserIdentity(userId);
    }
  }, [roomCode]);



  const value = {
    room,
    expenses,
    loading,
    roomCode,
    joinRoomSession,
    switchRoom,
    forgetRoom,
    updateRoom: updateRoomData,
    savedRooms,
    users: room?.users || [],
    categories: room?.categories || [],
    userIdentity,
    setUserIdentity: setUserIdentityInRoom,
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRoomContext() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used within RoomProvider');
  return ctx;
}

export default RoomContext;
