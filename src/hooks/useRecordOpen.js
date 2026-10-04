import { useEffect } from 'react';
import { useRoomContext } from '../context/RoomContext';
import { recordOpen } from '../services/opensService';

const GAP_MS = 30 * 60 * 1000;      // back in the app after this long = a new open
const DEBOUNCE_MS = 60 * 1000;      // reloads / double mounts inside a minute count once

/**
 * Counts an "app open" for this phone's member in the room that is open (feeds the AAI heatmap).
 * Once when the app loads, and again when it comes back to the front after 30+ minutes away.
 * The member is the one chosen on this phone (a personal room is always its owner). Never blocks or throws.
 */
export default function useRecordOpen() {
  const { roomCode, room, userIdentity } = useRoomContext();
  const users = room?.users;
  const memberId = !users ? null
    : room.isPersonal ? (users.some(u => u.id === userIdentity) ? userIdentity : users[0]?.id ?? null)
      : (users.some(u => u.id === userIdentity) ? userIdentity : null);

  useEffect(() => {
    if (!roomCode || !memberId || room?.code !== roomCode) return undefined;
    const key = `splitease_open_last_${roomCode}_${memberId}`;
    const fire = () => {
      try {
        const t = Date.now();
        if (t - Number(localStorage.getItem(key) || 0) < DEBOUNCE_MS) return;
        localStorage.setItem(key, String(t));
      } catch { /* private mode: still count it */ }
      try { recordOpen(roomCode, memberId).catch(() => {}); } catch { /* ignore */ }
    };
    fire();
    let away = null;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { away = Date.now(); return; }
      if (away && Date.now() - away >= GAP_MS) fire();
      away = null;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [roomCode, memberId, room?.code]);
}
