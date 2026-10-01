// Haptics (Motion system M5a). iPhone Safari ignores navigator.vibrate, so these only
// fire on Android; iOS gets the visual feedback only — expected, nothing to fix.
const PATTERNS = {
  tap: 8,                 // any button, key, chip select
  choose: 12,             // choose payer, category, room, member, theme cord
  success: [10, 40, 10],  // Saved, ADMIT, SYNC ON, N IMPORTED, COPIED
  error: [30, 30, 30],    // NO ROOM, TAKEN, missing field, delete confirm
};

export function haptic(kind = 'tap') {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(PATTERNS[kind] ?? PATTERNS.tap);
  } catch {
    // vibration is best-effort
  }
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
