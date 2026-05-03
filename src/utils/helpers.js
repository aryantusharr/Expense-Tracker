/**
 * Format currency in INR
 */
export function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Format a date for display
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate a simple unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the share URL for a room
 */
export function getRoomShareUrl(roomCode) {
  return `${window.location.origin}/join/${roomCode}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
}

/**
 * Use Web Share API (for mobile share sheets)
 */
export async function shareRoom(roomCode, roomName) {
  const url = getRoomShareUrl(roomCode);
  const shareData = {
    title: `Join ${roomName} on SplitEase`,
    text: `Track our shared expenses on SplitEase! Join with code: ${roomCode}`,
    url,
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    await navigator.share(shareData);
    return true;
  }
  return false;
}

/**
 * Get user color by index (cyclic)
 */
export function getUserColor(index) {
  const colors = [
    '#6c5ce7', '#00cec9', '#ff6b6b', '#feca57', '#54a0ff',
    '#ff9ff3', '#5f27cd', '#01a3a4', '#f368e0', '#ff9f43'
  ];
  return colors[index % colors.length];
}
