/**
 * AAI answers: the numbers behind balance / spend / settle cards.
 * Reuses calculateBalances + calculateSettlements, so AAI always agrees with the Balances screen.
 */
import { calculateBalances } from '../utils/splitCalculator.js';
import { calculateSettlements } from '../utils/settlementEngine.js';
import { normalize } from '../utils/categoryGuess.js';
import { cleanName, memberShare, fromDateStr, toDateStr, addDays, MONTH_NAMES } from './common.js';

const num = e => parseFloat(e?.amount) || 0;
const round2 = n => Math.round(n * 100) / 100;
const ym = d => d.getFullYear() * 12 + d.getMonth();
const expenseDate = e => fromDateStr(e?.date || e?.createdAt || '1970-01-01');

/** Open settlements (who pays whom) for the room. */
export function settlements(expenses, users) {
  return calculateSettlements(calculateBalances(expenses, users));
}

/**
 * "Kitna dena hai": what the phone owner owes / is owed, per person (pairwise from the minimal settlement plan).
 * @returns {{ iOwe: {id,name,amount}[], owedToMe: {id,name,amount}[], totalIOwe, totalOwedToMe, net, settled }}
 */
export function balanceAnswer(expenses, users, meId) {
  const balances = calculateBalances(expenses, users);
  const plan = calculateSettlements(balances);
  const iOwe = plan.filter(s => s.from.id === meId).map(s => ({ id: s.to.id, name: cleanName(s.to.name), amount: s.amount }));
  const owedToMe = plan.filter(s => s.to.id === meId).map(s => ({ id: s.from.id, name: cleanName(s.from.name), amount: s.amount }));
  const sum = l => l.reduce((a, b) => a + b.amount, 0);
  return {
    iOwe, owedToMe,
    totalIOwe: sum(iOwe), totalOwedToMe: sum(owedToMe),
    net: balances[meId]?.balance || 0,
    settled: plan.length === 0,
  };
}

/** "Settle all": who owes whom (minimum number of payments). Remind only — nothing is recorded. */
export function settleAnswer(expenses, users) {
  const plan = settlements(expenses, users).map(s => ({
    fromId: s.from.id, from: cleanName(s.from.name), toId: s.to.id, to: cleanName(s.to.name), amount: s.amount,
  }));
  return { plan, total: plan.reduce((a, b) => a + b.amount, 0), settled: plan.length === 0 };
}

function monthSpend(expenses, y, m, categoryId, meId) {
  let total = 0, mine = 0, count = 0;
  for (const e of expenses) {
    const d = expenseDate(e);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    if (categoryId && e.categoryId !== categoryId) continue;
    total += num(e); count++;
    mine += meId ? memberShare(num(e), e.splitAmong || [], meId) : 0;
  }
  return { total: round2(total), mine: round2(mine), count };
}

/**
 * "food this month", "last month", "biggest spend", "vs last month".
 * @param {{expenses, categories, categoryId, period:'this'|'last'|'biggest'|'compare', now:Date, meId?, isPersonal?}} p
 */
export function spendAnswer({ expenses, categories, categoryId, period, now, meId, isPersonal }) {
  const cat = (categories || []).find(c => c.id === categoryId) || null;
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const target = period === 'last' ? prev : cur;
  const before = period === 'last' ? new Date(now.getFullYear(), now.getMonth() - 2, 1) : prev;

  const t = monthSpend(expenses, target.getFullYear(), target.getMonth(), categoryId, meId);
  const p = monthSpend(expenses, before.getFullYear(), before.getMonth(), categoryId, meId);
  const base = isPersonal ? t.total : t.total;
  const pctVsPrev = p.total > 0 ? Math.round(((base - p.total) / p.total) * 100) : null;

  let biggest = null;
  for (const e of expenses) {
    const d = expenseDate(e);
    if (ym(d) !== ym(target)) continue;
    if (categoryId && e.categoryId !== categoryId) continue;
    if (!biggest || num(e) > num(biggest)) biggest = e;
  }

  return {
    period,
    categoryId: cat?.id || null,
    categoryName: cat?.name || null,
    month: MONTH_NAMES[target.getMonth()],
    prevMonth: MONTH_NAMES[before.getMonth()],
    total: t.total, myShare: t.mine, count: t.count,
    prevTotal: p.total, pctVsPrev,
    biggest: biggest
      ? { id: biggest.id, description: biggest.description, amount: num(biggest), date: biggest.date, categoryId: biggest.categoryId }
      : null,
  };
}

/**
 * Personal room card: "₹X LEFT AFTER". The app has no budget field yet, so this returns null
 * unless a budget is passed in — Chat B decides where the budget comes from.
 */
export function leftAfter({ budget, expenses, now, amount }) {
  if (!(budget > 0)) return null;
  const spent = monthSpend(expenses, now.getFullYear(), now.getMonth(), null, null).total;
  return Math.round(budget - spent - amount);
}

/**
 * Same amount + same description within 24h of an existing expense → possible duplicate.
 * @returns the older matching expense, or null
 */
export function findDuplicate(expenses, { amount, description }, now, excludeIds = []) {
  const key = normalize(description);
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  for (const e of expenses) {
    if (excludeIds.includes(e.id)) continue;
    if (Math.abs(num(e) - amount) > 0.001) continue;
    if (normalize(e.description) !== key) continue;
    const t = new Date(e.createdAt || e.date || 0).getTime();
    if (t >= dayAgo) return e;
  }
  return null;
}

/** Pairs (older, newer) of possible duplicates already in the room, newest pair first. */
export function duplicatePairs(expenses, now) {
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const recent = expenses
    .filter(e => new Date(e.createdAt || e.date || 0).getTime() >= dayAgo && !e.isItemised)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const pairs = [];
  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      if (Math.abs(num(recent[i]) - num(recent[j])) < 0.001 &&
          normalize(recent[i].description) === normalize(recent[j].description) &&
          normalize(recent[i].description)) {
        pairs.push({ newer: recent[i], older: recent[j] });
      }
    }
  }
  return pairs;
}

export { toDateStr, addDays };
