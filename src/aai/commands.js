/**
 * AAI commands: undo · change last to N · remove <name> from <desc> · remind <name> · settle all.
 * These only PLAN the change (pure functions). The UI runs the plan through the existing
 * updateExpense / deleteExpense functions after the user taps Confirm.
 *
 * lastAai = what AAI added most recently, from localStorage `splitease_aai_last`:
 *   { ids: string[], at: number (ms), room?: string }
 */
import { normalize } from '../utils/categoryGuess.js';
import { cleanName, expenseTime, fmtINR } from './common.js';
import { balanceAnswer, settleAnswer } from './answers.js';

const DAY = 24 * 60 * 60 * 1000;

/** The expense(s) "last" refers to: AAI's own last add in the past 24h, otherwise the room's newest. */
export function findLast(expenses, lastAai, now) {
  const nowMs = now.getTime();
  if (lastAai?.ids?.length && nowMs - lastAai.at < DAY) {
    const found = expenses.filter(e => lastAai.ids.includes(e.id));
    if (found.length) return { source: 'aai', expenses: found };
  }
  if (!expenses.length) return { source: 'none', expenses: [] };
  const newest = expenses.reduce((a, b) => (expenseTime(b) > expenseTime(a) ? b : a));
  // an itemised bill is one thing: take all of its lines
  const group = newest.groupId ? expenses.filter(e => e.groupId === newest.groupId) : [newest];
  return { source: 'room', expenses: group };
}

/** "undo" → delete what AAI just added. */
export function undoPlan(expenses, lastAai, now) {
  const last = findLast(expenses, lastAai, now);
  if (!last.expenses.length) return { ok: false, reason: 'nothing-to-undo' };
  const total = last.expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const first = last.expenses[0];
  return {
    ok: true,
    action: 'delete',
    source: last.source,
    ids: last.expenses.map(e => e.id),
    summary: last.expenses.length > 1
      ? `${first.groupName || first.description} · ${last.expenses.length} items · ${fmtINR(total)}`
      : `${first.description} · ${fmtINR(total)}`,
    expenses: last.expenses,
  };
}

/** "change last to 500" → update the amount of the last expense. A multi-line bill can't be changed this way. */
export function changeLastPlan(expenses, lastAai, now, amount) {
  if (!(amount > 0)) return { ok: false, reason: 'bad-amount' };
  const last = findLast(expenses, lastAai, now);
  if (!last.expenses.length) return { ok: false, reason: 'nothing-to-change' };
  if (last.expenses.length > 1) return { ok: false, reason: 'is-bill', expenses: last.expenses };
  const e = last.expenses[0];
  return {
    ok: true,
    action: 'update',
    source: last.source,
    id: e.id,
    updates: { amount },
    before: { description: e.description, amount: parseFloat(e.amount) || 0 },
    summary: `${e.description} ${fmtINR(e.amount)} → ${fmtINR(amount)}`,
  };
}

/** "remove ravi from dinner" → take Ravi out of the newest matching expense's split. */
export function removePersonPlan(expenses, personId, description, users) {
  const key = normalize(description);
  if (!key) return { ok: false, reason: 'no-description' };
  const match = expenses
    .filter(e => normalize(e.description).includes(key) || key.includes(normalize(e.description)))
    .sort((a, b) => expenseTime(b) - expenseTime(a))[0];
  if (!match) return { ok: false, reason: 'expense-not-found' };
  const split = match.splitAmong || [];
  if (!split.includes(personId)) return { ok: false, reason: 'not-in-split', expense: match };
  const next = split.filter(id => id !== personId);
  if (!next.length) return { ok: false, reason: 'would-be-empty', expense: match };
  const name = cleanName(users.find(u => u.id === personId)?.name);
  return {
    ok: true,
    action: 'update',
    id: match.id,
    updates: { splitAmong: next },
    summary: `${name} removed from ${match.description} · now split ${next.length} ways`,
    expense: match,
  };
}

/** WhatsApp-ready reminder text. Plain words, no guilt-tripping. */
export function remindText({ toName, amount, roomName, fromName }) {
  const who = cleanName(toName);
  const sign = fromName ? `\n— ${cleanName(fromName)}` : '';
  return `Hey ${who}! Quick reminder: ${fmtINR(amount)} is pending on SplitEase${roomName ? ` (${roomName})` : ''}. Settle whenever you can 🙏${sign}`;
}

/** "remind ravi" → how much Ravi owes the phone owner + the message. */
export function remindPlan(expenses, users, meId, personId, roomName) {
  const bal = balanceAnswer(expenses, users, meId);
  const row = bal.owedToMe.find(r => r.id === personId);
  const person = users.find(u => u.id === personId);
  if (!row) return { ok: false, reason: 'owes-nothing', name: cleanName(person?.name) };
  const me = users.find(u => u.id === meId);
  return {
    ok: true, personId, name: row.name, amount: row.amount,
    text: remindText({ toName: row.name, amount: row.amount, roomName, fromName: me?.name }),
  };
}

/** "settle all" → who owes whom, each with a reminder (no "mark settled" — AAI records nothing). */
export function settlePlan(expenses, users, meId, roomName) {
  const ans = settleAnswer(expenses, users);
  const me = users.find(u => u.id === meId);
  return {
    ...ans,
    plan: ans.plan.map(p => ({
      ...p,
      canRemind: p.toId === meId, // only the person who is owed reminds
      text: remindText({ toName: p.from, amount: p.amount, roomName, fromName: me?.name }),
    })),
  };
}
