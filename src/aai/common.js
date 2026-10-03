/**
 * AAI shared helpers — pure functions, no React, no Firebase (so Node can test them).
 */

/** Member name without the "Test " prefix used in test rooms. */
export const cleanName = n => (n || '').replace(/^test[\s_-]+/i, '').trim() || (n || '');

export const lower = s => (s || '').toLowerCase();

/** ₹ 1,24,000 style (Indian grouping). */
export const fmtINR = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const pad = n => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD (expenses store their date this way). */
export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD → local midnight Date. */
export function fromDateStr(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One-typo-tolerant compare (Levenshtein ≤ 1), only for words of 4+ letters. */
function oneTypo(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length] <= 1;
}

const SELF_WORDS = new Set(['me', 'my', 'mine', 'main', 'mujhe', 'maine', 'i', 'myself', 'you']);
export const isSelfWord = w => SELF_WORDS.has(lower(w));

/**
 * Match a typed name to room members: start of name (3+ letters) or exact, ignoring case,
 * the "Test " prefix and one typo.
 * → { status: 'one', user } | { status: 'many', candidates } | { status: 'none' }
 */
export function matchMember(word, users) {
  const w = lower(word).replace(/[^\p{L}\p{N}]/gu, '');
  if (!w) return { status: 'none' };
  const list = users || [];
  const nameOf = u => lower(cleanName(u.name)).replace(/[^\p{L}\p{N}]/gu, '');
  let hits = list.filter(u => nameOf(u) === w);
  if (!hits.length && w.length >= 3) hits = list.filter(u => nameOf(u).startsWith(w));
  if (!hits.length) hits = list.filter(u => oneTypo(nameOf(u), w));
  if (hits.length === 1) return { status: 'one', user: hits[0] };
  if (hits.length > 1) return { status: 'many', candidates: hits };
  return { status: 'none' };
}

/** Equal-split share (same rounding as splitCalculator: last person takes the remainder). */
export function memberShare(amount, splitAmong, userId) {
  if (!splitAmong?.includes(userId) || !amount) return 0;
  const each = Math.floor((amount / splitAmong.length) * 100) / 100;
  const rem = amount - each * splitAmong.length;
  return splitAmong.indexOf(userId) === splitAmong.length - 1 ? each + rem : each;
}

/** Time an expense was created/dated, as ms (0 if unreadable). */
export function expenseTime(e) {
  const t = new Date(e?.createdAt || e?.date || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
}
