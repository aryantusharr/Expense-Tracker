// App version + what changed (Version-Final / Version-WhatsNew-Final boards).
// Bump package.json "version" and add a RELEASE entry for every release.

export const VERSION = __APP_VERSION__;                  // e.g. 2.1.0
export const SHORT = VERSION.replace(/\.0$/, '');        // 2.1 (2.1.1 stays 2.1.1)
export const BUILD = __APP_BUILD__;
export const DATE = __APP_DATE__;                        // build day, e.g. 02 OCT 2026
export const BUILD_ID = __APP_BUILD_ID__;                // unique per build (also stamped into sw.js)

/** This release's notes — the What's new sheet (layout A: NEW / IMPROVED / FIXED). */
export const RELEASE = {
  date: '2 OCT 2026',
  new: [
    'Your own keypad everywhere — no phone keyboard',
    'Shift and caps lock; \' and ? on the 123 keys',
    'Suggestions and Paste on top of the keypad',
    'Budget nudge at 80% and 100% in personal rooms',
  ],
  improved: [
    'Sync pill now shows which room your copies go to',
    'Switch room is the ⇄ at the top of Settings',
    'Items: date row, recent items and a Next key',
    'Categories fold into one row',
    'Reinstalled the app? Add your personal room back from the sync pill',
  ],
  fixed: [
    'Names typed mid-sentence keep their capitals',
    'Recurring expenses jump straight to the description',
    'The room list shows the latest budget',
    'Printed bill items are easier to read',
    'A deleted personal room no longer shows “In sync”',
    'After a reinstall, the sync pill asks who you are instead of “Sync off”',
  ],
};
export const CHANGE_COUNT = RELEASE.new.length + RELEASE.improved.length + RELEASE.fixed.length;

const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// Run once at app start (before this session saves a room). Existing users updating from the
// version-less app (they have a room) count as "just updated"; brand-new users don't.
const LAST = 'splitease_version_last';
const SEEN = 'splitease_whatsnew_seen';
const prev = get(LAST);
const existing = !!prev || !!get('splitease_room');
export const JUST_UPDATED = existing && prev !== VERSION;
if (!existing) set(SEEN, VERSION);   // new users have nothing to catch up on
set(LAST, VERSION);

/** What's new not opened yet for this version → badge on the Settings row. */
export const whatsNewUnseen = () => get(SEEN) !== VERSION;
export const markWhatsNewSeen = () => set(SEEN, VERSION);

/**
 * One-off update moments (room-card stamp, footer typing in): true the first time each is
 * asked for after an update, then never again for that version.
 */
const moments = new Map();   // same answer for the whole session (safe with React's double render)
export function takeUpdateMoment(name) {
  if (moments.has(name)) return moments.get(name);
  const k = `splitease_version_moment_${name}`;
  const show = JUST_UPDATED && get(k) !== VERSION;
  if (show) set(k, VERSION);
  moments.set(name, show);
  return show;
}
