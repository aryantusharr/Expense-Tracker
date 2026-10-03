/**
 * AAI suggestion chips (SG-A): max 8, computed on the phone, ordered by group:
 *   Urgent → Money owed → Habits → Questions.
 *
 * buildChips(state) → [{ id, group, label, detail, action }]
 *   action is something Chat B hands to the UI, e.g. { kind:'text', text:'kitna dena hai' },
 *   { kind:'undo' }, { kind:'paste' }, { kind:'remind', personId }, { kind:'expense', draft }, …
 *
 * state = { now, expenses, users, me, categories, isPersonal, platform:'android'|'ios'|'other',
 *           clipboardHasUpi (Android only), queueCount, lastAai, hidden (ids), installable }
 */
import { normalize } from '../utils/categoryGuess.js';
import { detectRecurringExpenses } from '../utils/recurringExpenses.js';
import { balanceAnswer, settlements, duplicatePairs } from './answers.js';
import { fmtINR, fromDateStr, toDateStr, addDays, expenseTime } from './common.js';

export const MAX_CHIPS = 8;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

const num = e => parseFloat(e?.amount) || 0;
const dayDiff = (a, b) => Math.round((a - b) / DAY);

/** Hidden chips live in `splitease_aai_chips` as { date: 'YYYY-MM-DD', ids: [] } and reset at midnight. */
export function hiddenIds(stored, now) {
  return stored && stored.date === toDateStr(now) && Array.isArray(stored.ids) ? stored.ids : [];
}
export function hideChip(stored, id, now) {
  const ids = hiddenIds(stored, now);
  return { date: toDateStr(now), ids: ids.includes(id) ? ids : [...ids, id] };
}

/** Oldest date on which `me` paid an expense that `personId` was part of (for "owed for 7+ days"). */
function oldestOwedDate(expenses, meId, personId) {
  let oldest = null;
  for (const e of expenses) {
    if (e.paidBy !== meId || !(e.splitAmong || []).includes(personId)) continue;
    const t = fromDateStr(e.date || e.createdAt).getTime();
    if (oldest === null || t < oldest) oldest = t;
  }
  return oldest;
}

/** Recurring expenses that repeat monthly around the same day → the next due date. */
function monthlyDue(expenses, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  for (const r of detectRecurringExpenses(expenses)) {
    const items = expenses.filter(e => normalize(e.description) === normalize(r.description) && e.categoryId === r.categoryId && e.date);
    const months = new Set(items.map(e => e.date.slice(0, 7)));
    if (months.size < 2) continue;
    const days = items.map(e => fromDateStr(e.date).getDate());
    if (Math.max(...days) - Math.min(...days) > 3) continue; // not the same day each month
    const usual = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    let due = new Date(now.getFullYear(), now.getMonth(), usual);
    const thisMonth = toDateStr(today).slice(0, 7);
    if (items.some(e => e.date.slice(0, 7) === thisMonth)) due = new Date(now.getFullYear(), now.getMonth() + 1, usual);
    const away = dayDiff(due, today);
    if (away >= 0 && away <= 3) out.push({ rec: r, away });
  }
  return out.sort((a, b) => a.away - b.away);
}

/** Recurring expenses usually added around this time of day (±1h) and not yet added today. */
function usualNow(expenses, now) {
  const todayStr = toDateStr(now);
  const hourNow = now.getHours() + now.getMinutes() / 60;
  const out = [];
  for (const r of detectRecurringExpenses(expenses)) {
    const items = expenses.filter(e => normalize(e.description) === normalize(r.description) && e.categoryId === r.categoryId);
    if (items.some(e => e.date === todayStr)) continue;
    const hours = items.map(e => e.createdAt && new Date(e.createdAt)).filter(d => d && !Number.isNaN(d.getTime()))
      .map(d => d.getHours() + d.getMinutes() / 60).sort((a, b) => a - b);
    if (hours.length < 2) continue;
    const median = hours[Math.floor(hours.length / 2)];
    if (Math.abs(median - hourNow) <= 1) out.push(r);
  }
  return out;
}

export function buildChips(state) {
  const {
    now, expenses = [], users = [], me = null, isPersonal = false, platform = 'other',
    clipboardHasUpi = false, queueCount = 0, lastAai = null, hidden = [], installable = false,
  } = state;
  const todayStr = toDateStr(now);
  const nowMs = now.getTime();
  const chips = [];
  const add = (id, group, label, detail, action) => chips.push({ id, group, label, detail, action });

  // ── Urgent ──
  if (platform === 'android' && clipboardHasUpi) add('copied-payment', 'urgent', 'Copied payment', 'tap to add', { kind: 'paste', fromClipboard: true });
  else if (platform !== 'android') add('paste-payment', 'urgent', 'Paste copied text', 'payment or bill text', { kind: 'paste', fromClipboard: false });

  if (queueCount > 0) add('bill-waiting', 'urgent', 'Bill waiting', `${queueCount} to read`, { kind: 'bill-queue' });

  if (lastAai?.ids?.length && nowMs - lastAai.at < 10 * MIN && expenses.some(e => lastAai.ids.includes(e.id))) {
    const e = expenses.find(x => lastAai.ids.includes(x.id));
    add('undo-last', 'urgent', 'Undo last', `${e.description} ${fmtINR(num(e))}`, { kind: 'undo' });
  }

  const dup = duplicatePairs(expenses, now)[0];
  if (dup) add('duplicate', 'urgent', 'Possible duplicate', `${dup.newer.description} ${fmtINR(num(dup.newer))}`, { kind: 'duplicate', keep: dup.older.id, remove: dup.newer.id });

  // ── Money owed ──
  if (!isPersonal && me) {
    const bal = balanceAnswer(expenses, users, me);
    const stale = bal.owedToMe
      .map(r => ({ ...r, since: oldestOwedDate(expenses, me, r.id) }))
      .filter(r => r.since !== null && dayDiff(nowMs, r.since) >= 7)
      .sort((a, b) => b.amount - a.amount)[0];
    if (stale) add(`remind-${stale.id}`, 'owed', `Remind ${stale.name}`, `owes ${fmtINR(stale.amount)}`, { kind: 'remind', personId: stale.id });

    if (settlements(expenses, users).length >= 2) add('settle-plan', 'owed', 'Who owes whom', 'see the plan', { kind: 'settle' });

    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() > lastDay - 3 && bal.owedToMe.length && !stale) {
      const top = [...bal.owedToMe].sort((a, b) => b.amount - a.amount)[0];
      add('month-end-remind', 'owed', `Remind ${top.name}`, 'month-end', { kind: 'remind', personId: top.id });
    }
  }

  // ── Habits ──
  const yesterdayStr = toDateStr(addDays(now, -1));
  const mine = e => !me || e.paidBy === me;
  const yesterdays = expenses.filter(e => e.date === yesterdayStr && !e.isItemised && mine(e))
    .sort((a, b) => expenseTime(b) - expenseTime(a));
  const repeated = e => expenses.some(x => x.date === todayStr && normalize(x.description) === normalize(e.description) && num(x) === num(e));
  const ytd = yesterdays.find(e => !repeated(e));
  if (ytd) add('same-as-yesterday', 'habits', 'Same as yesterday', `${ytd.description} ${fmtINR(num(ytd))}`, { kind: 'repeat', expenseId: ytd.id });

  const usual = usualNow(expenses, now)[0];
  if (usual) add('usual-now', 'habits', 'Usual now', `${usual.description} ${fmtINR(num(usual.lastAmount))}`, { kind: 'expense', draft: { description: usual.description, amount: num({ amount: usual.lastAmount }), categoryId: usual.categoryId, paidBy: usual.lastPaidBy, splitAmong: usual.lastSplitAmong } });

  const due = monthlyDue(expenses, now)[0];
  if (due) add('rent-due', 'habits', `${due.rec.description} due`, due.away === 0 ? 'today' : `in ${due.away}d`, { kind: 'expense', draft: { description: due.rec.description, amount: num({ amount: due.rec.lastAmount }), categoryId: due.rec.categoryId, paidBy: due.rec.lastPaidBy, splitAmong: due.rec.lastSplitAmong } });

  if (now.getHours() >= 20 && !expenses.some(e => e.date === todayStr)) add('not-logged', 'habits', 'Not logged today', 'anything to add?', { kind: 'focus' });

  const lastBill = expenses.filter(e => e.isItemised && e.groupId).sort((a, b) => expenseTime(b) - expenseTime(a))[0];
  if (lastBill && nowMs - expenseTime(lastBill) < 14 * DAY) add('repeat-bill', 'habits', 'Repeat last bill', lastBill.groupName || 'last bill', { kind: 'repeat-bill', groupId: lastBill.groupId });

  if (installable) add('install', 'habits', 'Install SplitEase', 'one tap', { kind: 'install' });

  // ── Questions: fill the empty slots ──
  const q = (id, label, text) => add(id, 'questions', label, '', { kind: 'text', text });
  if (!isPersonal) q('q-owe', 'Kitna dena hai', 'kitna dena hai');
  q('q-month', 'This month', 'this month');
  if (now.getDate() > 10) q('q-biggest', 'Biggest spend', 'biggest spend');
  q('q-vs', 'vs last month', 'vs last month');
  if (isPersonal) add('q-budget', 'questions', 'Budget left', '', { kind: 'budget' });

  return chips.filter(c => !hidden.includes(c.id)).slice(0, MAX_CHIPS);
}
