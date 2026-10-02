// Landing room rows: balance / budget line read from the offline caches the app already
// keeps (RoomContext writes them), so the list costs no Firestore reads.
import { sharedModel, monthWindow, fmt } from '../dashboard/dashboardData';
import { joinRoom } from '../../services/roomService';

const readJson = key => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};

export const ROOM_DOTS = ['#8B7CFF', '#5FD4C4', '#FF8FB5'];

export function summariseRoom(saved) {
  const room = readJson(`splitease_room_cache_${saved.code}`);
  const expenses = readJson(`splitease_expenses_cache_${saved.code}`);
  const count = Array.isArray(expenses) ? expenses.length : null;
  let value = '';
  let tone = 'neutral';
  if (room && Array.isArray(expenses)) {
    if (saved.isPersonal || room.isPersonal) {
      const months = monthWindow(expenses).months;
      const spent = months[months.length - 1]?.total || 0;
      const budget = Number(room.budget) || 0;
      value = budget > 0 ? `₹${fmt(spent)} / ₹${fmt(budget)}` : `₹${fmt(spent)}`;
    } else {
      const me = localStorage.getItem(`splitease_identity_${saved.code}`);
      const net = me && room.users ? sharedModel(expenses, room.users).byId[me]?.all.net : null;
      if (net != null && Math.round(net) !== 0) {
        value = `${net > 0 ? '+' : '−'}₹${fmt(net)}`;
        tone = net > 0 ? 'pos' : 'neg';
      } else if (net != null) value = 'SETTLED';
    }
  }
  return { value, tone, count };
}

/**
 * The room cache only refreshes for the room that's open, so a budget / name changed on another
 * phone stayed stale here. One get per saved room (read-only, same shape RoomContext caches).
 * Offline or missing rooms are skipped quietly.
 */
export async function refreshRoomCaches(saved) {
  await Promise.all(saved.map(async r => {
    try {
      const { roomCode, roomData } = await joinRoom(r.code);
      localStorage.setItem(`splitease_room_cache_${roomCode}`, JSON.stringify({ roomCode, ...roomData }));
    } catch { /* offline / gone — keep the old copy */ }
  }));
}

// Line-icon paths used across onboarding screens (24px grid, 1.9 stroke).
export const ICONS = {
  back: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  key: 'M15 7a4 4 0 1 1-3.9 4.9L3 20v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  open: 'M9 18l6-6-6-6',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};
