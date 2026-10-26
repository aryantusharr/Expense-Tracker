// App version + what changed (Version-Final / Version-WhatsNew-Final boards).
// Every release: bump package.json "version" AND "splitEaseBuild" (= last live build + the number of lines in RELEASE),
// and rewrite RELEASE. Ask the owner for the numbers first.

export const VERSION = __APP_VERSION__;                  // e.g. 2.1.0
export const SHORT = VERSION.replace(/\.0$/, '');        // 2.1 (2.1.1 stays 2.1.1)
export const BUILD = __APP_BUILD__;
export const DATE = __APP_DATE__;                        // build day, e.g. 02 OCT 2026
export const BUILD_ID = __APP_BUILD_ID__;                // unique per build (also stamped into sw.js)

/** This release's notes — the What's new sheet (layout A: NEW / IMPROVED / FIXED). One line per change: the build number counts them. */
export const RELEASE = {
  date: '26 OCT 2026',
  new: [],
  improved: [
    'Your last payment is now a pill with a rolling date on the top card — today, the date and the day glide past',
    'Everyone sees it now, whether you owe, are owed or are all square',
    'Category icons come alive with a small motion of their own',
  ],
  fixed: [],
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
