/**
 * Handles getting/setting last used defaults for the Add Expense page per room.
 */

export function getLastUsedMode(roomCode) {
  if (!roomCode) return 'quick';
  return localStorage.getItem(`splitease_mode_${roomCode}`) || 'quick';
}

export function setLastUsedMode(roomCode, mode) {
  if (roomCode) {
    localStorage.setItem(`splitease_mode_${roomCode}`, mode);
  }
}

export function getLastUsedDefaults(roomCode) {
  if (!roomCode) return {};
  try {
    const categoryId = localStorage.getItem(`splitease_default_category_${roomCode}`) || null;
    const paidBy = localStorage.getItem(`splitease_default_paidby_${roomCode}`) || null;
    const splitAmongRaw = localStorage.getItem(`splitease_default_splitamong_${roomCode}`);
    const splitAmong = splitAmongRaw ? JSON.parse(splitAmongRaw) : null;
    return { categoryId, paidBy, splitAmong };
  } catch {
    return {};
  }
}

export function setLastUsedDefaults(roomCode, { categoryId, paidBy, splitAmong }) {
  if (!roomCode) return;
  if (categoryId) {
    localStorage.setItem(`splitease_default_category_${roomCode}`, categoryId);
  }
  if (paidBy) {
    localStorage.setItem(`splitease_default_paidby_${roomCode}`, paidBy);
  }
  if (splitAmong) {
    localStorage.setItem(`splitease_default_splitamong_${roomCode}`, JSON.stringify(splitAmong));
  }
}
