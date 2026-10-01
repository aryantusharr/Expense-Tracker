// Pure view-model helpers for the redesigned Dashboard. Reads the same data as before
// (expenses, users, categories) — nothing here writes anything.
import { calculateBalances } from '../../utils/splitCalculator';
import { calculateSettlements } from '../../utils/settlementEngine';
import { resolveCategoryIcon } from '../../design/categoryIcons';

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_FULL = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

// Member colours: the redesign palette by position in the room (stored colours are untouched).
const PALETTE = ['#8B7CFF', '#5FD4C4', '#FF8FB5', '#F5C26B', '#6EC1FF', '#A8E06B', '#FF9A76', '#C9A7FF'];
const CARD_GRADIENTS = {
  '#8B7CFF': 'linear-gradient(140deg, #6D5DF5, #3A2CA8)',
  '#5FD4C4': 'linear-gradient(140deg, #1A8A7E, #0E534C)',
  '#FF8FB5': 'linear-gradient(140deg, #C24F7E, #7E2A4E)',
};

export function memberStyle(index) {
  const c = PALETTE[index % PALETTE.length];
  return {
    color: c,
    cardBg: CARD_GRADIENTS[c] || `linear-gradient(140deg, color-mix(in srgb, ${c} 72%, #000), color-mix(in srgb, ${c} 38%, #000))`,
  };
}

/** Monogram letter; skips a leading "Test " so test members stay distinguishable. */
export const initialOf = name => ((name || '?').trim().replace(/^test[\s_-]+/i, '') || name || '?').charAt(0).toUpperCase();

export const fmt = n => Math.round(Math.abs(n || 0)).toLocaleString('en-IN');
export const amountOf = e => parseFloat(e.amount) || 0;
const monthKeyOf = e => (e.date || '').slice(0, 7); // 'YYYY-MM'

export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const keyOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;

/** '27 SEP' / 'TODAY' / 'YESTERDAY' for a 'YYYY-MM-DD' string. */
export function shortDay(dateStr, { upper = true } = {}) {
  if (!dateStr) return '';
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (dateStr === localDateStr(today)) return upper ? 'TODAY' : 'Today';
  if (dateStr === localDateStr(yest)) return upper ? 'YESTERDAY' : 'Yesterday';
  const [, m, d] = dateStr.split('-').map(Number);
  const s = `${d} ${MONTHS_SHORT[m - 1]}`;
  return upper ? s.toUpperCase() : s;
}

/**
 * Month window for the month card + bars: from the first month with data (at most 6 back)
 * up to the current month. Each: { key, short, full, total, days }.
 */
export function monthWindow(expenses, now = new Date()) {
  const totals = {};
  let first = null;
  for (const e of expenses) {
    const k = monthKeyOf(e);
    if (!k) continue;
    totals[k] = (totals[k] || 0) + amountOf(e);
    if (!first || k < first) first = k;
  }
  const out = [];
  for (let back = 5; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const k = keyOf(d.getFullYear(), d.getMonth());
    if (first && k < first && back > 0) continue;
    out.push({
      key: k, year: d.getFullYear(), month: d.getMonth(),
      short: MONTHS_SHORT[d.getMonth()], full: MONTHS_FULL[d.getMonth()],
      total: Math.round(totals[k] || 0),
    });
  }
  return { months: out, firstKey: first };
}

export function lifetime(expenses) {
  const total = expenses.reduce((s, e) => s + amountOf(e), 0);
  const keys = [...new Set(expenses.map(monthKeyOf).filter(Boolean))].sort();
  let months = 0;
  if (keys.length) {
    const [y1, m1] = keys[0].split('-').map(Number);
    const now = new Date();
    months = (now.getFullYear() - y1) * 12 + (now.getMonth() + 1 - m1) + 1;
  }
  const since = keys.length ? (() => { const [y, m] = keys[0].split('-').map(Number); return { label: `${MONTHS_SHORT[m - 1].toUpperCase()} ${y}`, short: MONTHS_SHORT[m - 1].toUpperCase() }; })() : null;
  return { total: Math.round(total), months, since };
}

/** Latest payment (itemised groups collapse into one), optionally for one payer. */
export function lastTransaction(expenses, paidBy) {
  const list = paidBy ? expenses.filter(e => e.paidBy === paidBy) : expenses;
  const groups = {};
  const singles = [];
  for (const e of list) {
    const base = {
      amount: amountOf(e), date: e.date, createdAt: e.createdAt || e.date,
      syncedFrom: e.syncedFromRoom || e.syncedFromRoomName || null, categoryId: e.categoryId,
    };
    if (e.isItemised && e.groupId) {
      const g = groups[e.groupId] || (groups[e.groupId] = { ...base, amount: 0, name: e.groupName || 'Itemised expense' });
      g.amount += base.amount;
      if (e.date > g.date || (e.date === g.date && (base.createdAt || '') > (g.createdAt || ''))) {
        Object.assign(g, { date: e.date, createdAt: base.createdAt, syncedFrom: base.syncedFrom });
      }
    } else {
      singles.push({ ...base, name: e.description || 'Other' });
    }
  }
  return [...Object.values(groups), ...singles]
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;
}

/** Shared-room model: members with styles, all-time + this-month balances, settlements, nudge. */
export function sharedModel(expenses, users, now = new Date()) {
  const all = calculateBalances(expenses, users);
  const settlements = calculateSettlements(all);
  const curKey = keyOf(now.getFullYear(), now.getMonth());
  const today = localDateStr(now);

  const members = users.map((u, i) => {
    const st = memberStyle(i);
    let mPaid = 0, mShare = 0, lastDate = null, loggedToday = false;
    for (const e of expenses) {
      const amt = amountOf(e);
      if (e.paidBy === u.id) {
        if (!lastDate || e.date > lastDate) lastDate = e.date;
        if (e.date === today) loggedToday = true;
      }
      if (monthKeyOf(e) !== curKey) continue;
      if (e.paidBy === u.id) mPaid += amt;
      const split = e.splitAmong || [];
      if (split.includes(u.id)) mShare += amt / split.length;
    }
    const b = all[u.id] || { paid: 0, owed: 0, balance: 0 };
    return {
      id: u.id, name: u.name, initial: initialOf(u.name), ...st,
      all: { net: b.balance, paid: b.paid, share: b.owed },
      month: { net: Math.round(mPaid - mShare), paid: Math.round(mPaid), share: Math.round(mShare) },
      last: lastTransaction(expenses, u.id), lastDate, loggedToday,
    };
  });
  const byId = Object.fromEntries(members.map(m => [m.id, m]));
  return {
    members, byId,
    settlements: settlements.map(s => ({ from: byId[s.from.id], to: byId[s.to.id], amount: s.amount })).filter(s => s.from && s.to),
  };
}

/** Category × month matrix from the first month with data to now. */
export function spendingMatrix(expenses, categories, now = new Date()) {
  if (!expenses.length) return null;
  const catMap = Object.fromEntries((categories || []).map(c => [c.id, c]));
  const keys = expenses.map(monthKeyOf).filter(Boolean).sort();
  const [fy, fm] = keys[0].split('-').map(Number);
  const months = [];
  for (let d = new Date(fy, fm - 1, 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push({ key: keyOf(d.getFullYear(), d.getMonth()), short: MONTHS_SHORT[d.getMonth()].toUpperCase() });
  }
  const rows = {};
  const counts = {};
  const colTotals = Object.fromEntries(months.map(m => [m.key, 0]));
  for (const e of expenses) {
    const id = e.categoryId || 'unknown';
    const k = monthKeyOf(e);
    counts[id] = (counts[id] || 0) + 1;
    const cat = catMap[id] || { name: 'Other', icon: '📦' };
    const r = rows[id] || (rows[id] = { id, name: cat.name, icon: resolveCategoryIcon(cat), byMonth: {}, total: 0 });
    r.byMonth[k] = (r.byMonth[k] || 0) + amountOf(e);
    r.total += amountOf(e);
    if (k in colTotals) colTotals[k] += amountOf(e);
  }
  const delta = (cur, prev) => {
    if (!prev || !cur) return null;
    const pct = ((cur - prev) / prev) * 100;
    return Math.abs(pct) < 1 ? null : pct;
  };
  const list = Object.values(rows)
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name))
    .map(r => ({
      ...r,
      total: Math.round(r.total),
      cells: months.map((m, i) => {
        const v = Math.round(r.byMonth[m.key] || 0);
        return { key: m.key, v, d: i > 0 ? delta(v, Math.round(r.byMonth[months[i - 1].key] || 0)) : null };
      }),
    }));
  return {
    months, rows: list,
    totals: months.map(m => ({ key: m.key, v: Math.round(colTotals[m.key]) })),
    grand: Math.round(expenses.reduce((s, e) => s + amountOf(e), 0)),
  };
}

// Background orb tints per month slot (from the board), and the over-budget set.
const SKY = [
  ['91,124,255', '79,200,224', '176,140,255'], ['139,108,255', '79,212,160', '255,159,122'],
  ['79,139,255', '79,212,196', '156,124,255'], ['196,108,255', '255,111,160', '255,179,90'],
  ['124,108,255', '79,212,196', '255,111,160'], ['124,108,255', '79,212,196', '255,111,160'],
];
const SKY_OVER = ['255,111,160', '232,105,154', '255,160,120'];
export function skyFor(slotFromEnd, { over = false, light = false } = {}) {
  const set = over ? SKY_OVER : SKY[Math.max(0, 5 - slotFromEnd)];
  const a = light ? [0.34, 0.26, 0.2] : [0.55, 0.35, 0.25];
  return set.map((rgb, i) => `rgba(${rgb},${a[i]})`);
}
