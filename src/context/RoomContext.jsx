import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { subscribeToRoom } from '../services/roomService';
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

export function RoomProvider({ children }) {
  const [room, setRoom] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedRooms, setSavedRooms] = useState(loadSavedRooms);
  const [roomCode, setRoomCode] = useState(() => {
    return localStorage.getItem('splitease_room') || null;
  });

  // Persist savedRooms to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('splitease_saved', JSON.stringify(savedRooms));
  }, [savedRooms]);

  // Subscribe to room data
  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubRoom = subscribeToRoom(
      roomCode,
      (roomData) => {
        setRoom(roomData);
        // Auto-save to room list
        setSavedRooms(prev => {
          const exists = prev.find(r => r.code === roomCode);
          if (exists) return prev;
          return [...prev, { code: roomCode, name: roomData.name, isPersonal: !!roomData.isPersonal }];
        });
        setLoading(false);
      },
      () => {
        // Room was deleted from Firestore — clear stale session
        localStorage.removeItem('splitease_room');
        setSavedRooms(prev => prev.filter(r => r.code !== roomCode));
        setRoomCode(null);
        setRoom(null);
        setExpenses([]);
        setLoading(false);
      }
    );

    const unsubExpenses = subscribeToExpenses(roomCode, (expenseList) => {
      setExpenses(expenseList);
    });

    return () => {
      unsubRoom();
      unsubExpenses();
    };
  }, [roomCode]);

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
  }, []);

  // Forget room = remove from saved list too
  const forgetRoom = useCallback((code) => {
    setSavedRooms(prev => prev.filter(r => r.code !== code));
    if (code === roomCode) {
      localStorage.removeItem('splitease_room');
      setRoomCode(null);
      setRoom(null);
      setExpenses([]);
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
    savedRooms,
    users: room?.users || [],
    categories: room?.categories || [],
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoomContext() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used within RoomProvider');
  return ctx;
}

export default RoomContext;
