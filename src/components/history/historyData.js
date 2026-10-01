// View-model for the redesigned History. Read-only: groups the same expenses the old list used
// into months → days → rows / itemised bills, and works out "you get / your share / your net".
import { getMemberShare } from '../../services/expenseService';
import { localDateStr, fmt, MONTHS_FULL, MONTHS_SHORT } from '../dashboard/dashboardData';

export const TINTS = ['#8B7CFF', '#FF8FB5', '#5FD4C4', '#F5C26B'];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const isSyncedExp = e => Boolean(e.isSynced || e.parentExpenseId || e.syncedFromRoomCode);
export const syncedFrom = e => e.syncedFromRoomName || e.syncedFromRoom || e.syncedFromRoomCode || 'shared room';
const amt = e => parseFloat(e.amount) || 0;
const stamp = e => new Date(e.createdAt || e.date).getTime() || 0;

/** 'TODAY · 30 SEP' / 'MON · 29 SEP' for 'YYYY-MM-DD'. */
export function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const mon = `${d} ${MONTHS_SHORT[m - 1].toUpperCase()}`;
  return dateStr === localDateStr() ? `TODAY · ${mon}` : `${WEEKDAYS[dt.getDay()]} · ${mon}`;
}

/** What one expense means for `meId`: how much they paid, their share, and the difference. */
export function myPart(e, meId) {
  if (!meId) return { paid: 0, share: 0, delta: 0, involved: false };
  const a = amt(e);
  const paid = e.paidBy === meId ? a : 0;
  const share = getMemberShare(a, e.splitAmong, meId);
  return { paid, share, delta: paid - share, involved: paid > 0 || share > 0 };
}

function spark(dayTotals, daysInMonth, upTo) {
  const pts = 11;
  const cum = [];
  let run = 0;
  for (let d = 1; d <= daysInMonth; d++) { if (d <= upTo) run += dayTotals[d] || 0; cum.push(run); }
  const max = Math.max(run, 1);
  return Array.from({ length: pts }, (_, i) => {
    const v = cum[Math.min(daysInMonth - 1, Math.round((i / (pts - 1)) * (daysInMonth - 1)))] / max;
    return `${i === 0 ? 'M' : 'L'}${Math.round((i / (pts - 1)) * 300)} ${(40 - v * 32).toFixed(1)}`;
  }).join(' ');
}

/**
 * Months (newest first, current month always present) → days → entries.
 * entry = { kind: 'row', id, e, createdAt } | { kind: 'bill', id, name, items, total, e (first item), createdAt }
 */
export function buildHistory(expenses, { meId, isPersonal, budget }) {
  const buckets = {};
  for (const e of expenses) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(e.date || '')) continue;
    (buckets[e.date.slice(0, 7)] ||= []).push(e);
  }
  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  buckets[nowKey] ||= [];

  const months = Object.keys(buckets).sort().reverse().map((key, idx) => {
    const list = buckets[key];
    const [y, m] = key.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDay = {};
    const dayTotals = {};
    let total = 0, net = 0;
    for (const e of list) {
      total += amt(e);
      net += myPart(e, meId).delta;
      (byDay[e.date] ||= []).push(e);
      const dn = Number(e.date.slice(8, 10));
      dayTotals[dn] = (dayTotals[dn] || 0) + amt(e);
    }
    let count = 0;
    const days = Object.keys(byDay).sort().reverse().map(dk => {
      const bills = {};
      const entries = [];
      for (const e of byDay[dk]) {
        if (e.isItemised && e.groupId) {
          if (!bills[e.groupId]) {
            bills[e.groupId] = { kind: 'bill', id: e.groupId, name: e.groupName || 'Itemised bill', items: [], total: 0, e, createdAt: stamp(e) };
            entries.push(bills[e.groupId]);
          }
          bills[e.groupId].items.push(e);
          bills[e.groupId].total += amt(e);
          bills[e.groupId].createdAt = Math.max(bills[e.groupId].createdAt, stamp(e));
        } else entries.push({ kind: 'row', id: e.id, e, createdAt: stamp(e) });
      }
      entries.sort((a, b) => b.createdAt - a.createdAt);
      count += entries.length;
      return { key: dk, label: dayLabel(dk), total: entries.reduce((s, x) => s + (x.kind === 'bill' ? x.total : amt(x.e)), 0), entries };
    });
    const isNow = key === nowKey;
    return {
      key, idx, tint: TINTS[idx % TINTS.length],
      name: `${MONTHS_FULL[m - 1]} ${y}`, short: `${MONTHS_SHORT[m - 1].toUpperCase()} ${y}`,
      count, total, net, left: isPersonal && budget > 0 ? budget - total : null,
      spark: spark(dayTotals, daysInMonth, isNow ? now.getDate() : daysInMonth), days,
    };
  });

  const entryCount = months.reduce((s, mo) => s + mo.count, 0);
  return { months, entryCount };
}

/** Net / budget block on the right of a month card (shared: YOUR NET, personal: LEFT OF ₹budget). */
export function monthSide(mo, { isPersonal, budget }) {
  if (isPersonal) {
    if (mo.left == null) return null;
    const over = mo.left < 0;
    return { label: over ? `OVER ₹${fmt(budget)}` : `LEFT OF ₹${fmt(budget)}`, value: `₹${fmt(mo.left)}`, color: over ? 'var(--se-pink-2)' : 'var(--se-teal-2)' };
  }
  if (mo.net == null) return null;
  const pos = mo.net >= 0;
  return { label: 'YOUR NET', value: `${pos ? '+' : '−'}₹${fmt(mo.net)}`, color: pos ? 'var(--se-teal-2)' : 'var(--se-pink-2)' };
}

