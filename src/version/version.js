// App version + what changed (Version-Final / Version-WhatsNew-Final boards).
// Every release: bump package.json "version" AND "splitEaseBuild" (= last live build + the number of lines in RELEASE),
// and rewrite RELEASE. Ask Shatakshi for the numbers first.

export const VERSION = __APP_VERSION__;                  // e.g. 2.1.0
export const SHORT = VERSION.replace(/\.0$/, '');        // 2.1 (2.1.1 stays 2.1.1)
export const BUILD = __APP_BUILD__;
export const DATE = __APP_DATE__;                        // build day, e.g. 02 OCT 2026
export const BUILD_ID = __APP_BUILD_ID__;                // unique per build (also stamped into sw.js)

/** This release's notes — the What's new sheet (layout A: NEW / IMPROVED / FIXED). One line per change: the build number counts them. */
export const RELEASE = {
  date: '9 OCT 2026',
  new: [
    'Aryan AI: a chat that logs an expense or a whole bill from plain words',
    'Read a bill from screenshots — shop, date, items and taxes',
    'Bill card: tick each item’s split, then Save bill',
    '“Taxes & charges” is now its own category',
    'Past chats drawer; a chat locks a minute after you close it',
    'Who opened the app — a heatmap in an empty chat',
    'The looping A|AI loader while Aryan AI wakes up (tap to skip)',
    'The A|AI mark in the chat header stretches to “Aryan AI” and back',
    'Guessed or missing date, name, total and category now pulse until you check them',
    'Most used and Recent description strips under the field',
    'Your phone’s own keyboard for text; the in-app keypad stays for amounts',
    'Dashboard “Not logged” names the person silent the longest',
    'The auto-picked category leads the category row',
    'Quick: PAID BY · SPLIT lights up once there is an amount',
  ],
  improved: [
    'Categories your room has learned now win over the bill reader’s guess',
    'Bill items are saved with short names — no sizes or pack text',
    'Who paid auto-picks “You” after 4 seconds',
    'Bill card shows each item’s people icons and its own category icon',
    'Size and quantity text is gone from bill items',
    'Your profile is a small tile beside the sync pill in Settings',
    'The What’s new row in Settings is properly aligned',
    'The sync pill no longer has an arrow before the personal room name',
    'History receipts fit the phone, long names end in “…”',
  ],
  fixed: [
    'The chats drawer no longer goes blank',
    'The Dashboard no longer shows or scrolls behind Aryan AI with the keyboard open',
    'Description strips can be scrolled and tapped without closing the keyboard',
    'The bill card says “items”, not “lines”',
    'The ticked split mark disappears once it is ticked',
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
