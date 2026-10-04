/**
 * Rows shown above the AAI composer while it is focused (board 03). Pure (no React).
 *  - quickUsuals: things the room adds again and again ("Cig ₹20 · All 3"), only after 3 similar entries.
 *  - repeatBills: past itemised bills you can run again ("Blinkit weekly ₹612 · 9 ITEMS · LAST SAT").
 */
import { toDateStr, fromDateStr, cleanName, expenseTime } from './common.js';

const num = e => parseFloat(e.amount) || 0;
const norm = s => (s || '').toLowerCase().replace(/[^\p{L}\p{N}\p{M} ]/gu, '').replace(/\s+/g, ' ').trim();
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 'All 3' · 'You+Ravi' · 'Just you' */
export function splitLabel(splitAmong, users, meId) {
  const n = splitAmong?.length || 0;
  if (!n) return '';
  if (users.length > 1 && n === users.length) return `All ${n}`;
  if (n === 1 && splitAmong[0] === meId) return 'Just you';
  return splitAmong.map(id => (id === meId ? 'You' : cleanName(users.find(u => u.id === id)?.name || '?'))).join('+');
}

export function quickUsuals(expenses, { users = [], me = null, isPersonal = false, limit = 8 } = {}) {
  const groups = new Map();
  for (const e of expenses) {
    if (e.isItemised || e.groupId || !(num(e) > 0)) continue;
    const key = norm(e.description);
    if (!key) continue;
    const g = groups.get(key) || { key, count: 0, last: null };
    g.count++;
    if (!g.last || expenseTime(e) > expenseTime(g.last)) g.last = e;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter(g => g.count >= 3)
    .sort((a, b) => b.count - a.count || expenseTime(b.last) - expenseTime(a.last))
    .slice(0, limit)
    .map(g => ({
      key: g.key,
      description: g.last.description,
      amount: num(g.last),
      categoryId: g.last.categoryId || null,
      paidBy: isPersonal ? null : g.last.paidBy || me,
      splitAmong: g.last.splitAmong || [],
      split: isPersonal ? '' : splitLabel(g.last.splitAmong, users, me),
    }));
}

/** Weekday if this week · 'LAST SAT' if last week · '2 SEP' otherwise. */
export function lastLabel(dateStr, now) {
  const d = fromDateStr(dateStr);
  const gap = Math.round((fromDateStr(toDateStr(now)) - d) / 86400000);
  if (gap <= 0) return 'TODAY';
  if (gap === 1) return 'YESTERDAY';
  if (gap <= 6) return DAYS[d.getDay()];
  if (gap <= 13) return `LAST ${DAYS[d.getDay()]}`;
  return `${d.getDate()} ${MONS[d.getMonth()]}`;
}

export function repeatBills(expenses, { now = new Date(), limit = 4 } = {}) {
  const byGroup = new Map();
  for (const e of expenses) {
    if (!e.groupId) continue;
    const g = byGroup.get(e.groupId) || { groupId: e.groupId, name: e.groupName || '', items: [], at: 0, date: e.date };
    g.items.push(e);
    g.at = Math.max(g.at, expenseTime(e));
    byGroup.set(e.groupId, g);
  }
  const seen = new Set();
  const out = [];
  for (const g of [...byGroup.values()].sort((a, b) => b.at - a.at)) {
    const k = norm(g.name);
    if (!k || seen.has(k) || g.items.length < 2) continue;   // one entry per bill name; skip nameless / single-line
    seen.add(k);
    out.push({
      groupId: g.groupId, name: g.name, total: g.items.reduce((s, x) => s + num(x), 0),
      count: g.items.length, date: g.date, last: lastLabel(g.date, now), items: g.items,
    });
    if (out.length >= limit) break;
  }
  return out;
}
