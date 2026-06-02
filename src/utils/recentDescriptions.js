/**
 * Handles recent descriptions cache per room (max 10, deduplicated, most recent first).
 */

export function getRecentDescriptions(roomCode) {
  if (!roomCode) return [];
  try {
    return JSON.parse(localStorage.getItem(`splitease_recent_desc_${roomCode}`) || '[]');
  } catch {
    return [];
  }
}

export function addRecentDescription(roomCode, description) {
  if (!roomCode || !description || !description.trim()) return;
  const desc = description.trim();
  try {
    let list = getRecentDescriptions(roomCode);
    // Remove case-insensitive duplicate
    list = list.filter(item => item.toLowerCase() !== desc.toLowerCase());
    // Insert at front
    list.unshift(desc);
    // Keep max 10
    list = list.slice(0, 10);
    localStorage.setItem(`splitease_recent_desc_${roomCode}`, JSON.stringify(list));
  } catch (e) {
    // Fail silently
  }
}
