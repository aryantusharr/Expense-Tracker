import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLast, undoPlan, changeLastPlan, removePersonPlan, remindText, remindPlan, settlePlan } from './commands.js';
import { exp, USERS, NOW } from './fixtures.js';

const ME = 'u-me', RAVI = 'u-ravi', MEERA = 'u-meera';
const hrsAgo = h => new Date(NOW.getTime() - h * 3600e3).toISOString();

test('last = what AAI added (past 24h), even if the room has newer expenses', () => {
  const mine = exp({ id: 'a1', createdAt: hrsAgo(3) });
  const newer = exp({ id: 'b1', createdAt: hrsAgo(1) });
  const r = findLast([mine, newer], { ids: ['a1'], at: NOW.getTime() - 3 * 3600e3 }, NOW);
  assert.equal(r.source, 'aai'); assert.equal(r.expenses[0].id, 'a1');
});
test('last = room newest when AAI added nothing, or it was over 24h ago', () => {
  const old = exp({ id: 'a1', createdAt: hrsAgo(40) });
  const newest = exp({ id: 'b1', createdAt: hrsAgo(1) });
  assert.equal(findLast([old, newest], null, NOW).expenses[0].id, 'b1');
  assert.equal(findLast([old, newest], { ids: ['a1'], at: NOW.getTime() - 40 * 3600e3 }, NOW).source, 'room');
});
test('last = a whole bill when the newest is a bill line', () => {
  const l1 = exp({ id: 'g1', groupId: 'grp1', isItemised: true, createdAt: hrsAgo(1) });
  const l2 = exp({ id: 'g2', groupId: 'grp1', isItemised: true, createdAt: hrsAgo(1) });
  assert.equal(findLast([exp({ createdAt: hrsAgo(5) }), l1, l2], null, NOW).expenses.length, 2);
});
test('last: empty room', () => assert.equal(findLast([], null, NOW).source, 'none'));

test('undo plans a delete of AAI’s last add', () => {
  const e = exp({ id: 'a1', description: 'Dinner', amount: 450, createdAt: hrsAgo(0.1) });
  const p = undoPlan([e], { ids: ['a1'], at: NOW.getTime() - 6e4 }, NOW);
  assert.equal(p.ok, true); assert.equal(p.action, 'delete'); assert.deepEqual(p.ids, ['a1']); assert.equal(p.summary, 'Dinner · ₹450');
});
test('undo a bill removes every line', () => {
  const l1 = exp({ id: 'g1', amount: 100, groupId: 'grp1', groupName: 'Dmart', isItemised: true, createdAt: hrsAgo(0.1) });
  const l2 = exp({ id: 'g2', amount: 50, groupId: 'grp1', groupName: 'Dmart', isItemised: true, createdAt: hrsAgo(0.1) });
  const p = undoPlan([l1, l2], { ids: ['g1', 'g2'], at: NOW.getTime() - 6e4 }, NOW);
  assert.deepEqual(p.ids, ['g1', 'g2']); assert.equal(p.summary, 'Dmart · 2 items · ₹150');
});
test('undo: nothing to undo', () => assert.equal(undoPlan([], null, NOW).ok, false));

test('change last to 500', () => {
  const e = exp({ id: 'a1', description: 'Dinner', amount: 450, createdAt: hrsAgo(0.1) });
  const p = changeLastPlan([e], { ids: ['a1'], at: NOW.getTime() - 6e4 }, NOW, 500);
  assert.equal(p.ok, true); assert.deepEqual(p.updates, { amount: 500 }); assert.equal(p.summary, 'Dinner ₹450 → ₹500'); assert.equal(p.id, 'a1');
});
test('change last: bad amount, nothing, or a bill', () => {
  assert.equal(changeLastPlan([exp()], null, NOW, 0).reason, 'bad-amount');
  assert.equal(changeLastPlan([], null, NOW, 500).reason, 'nothing-to-change');
  const l1 = exp({ groupId: 'g', isItemised: true, createdAt: hrsAgo(1) });
  const l2 = exp({ groupId: 'g', isItemised: true, createdAt: hrsAgo(1) });
  assert.equal(changeLastPlan([l1, l2], null, NOW, 500).reason, 'is-bill');
});

test('remove ravi from dinner', () => {
  const e = exp({ id: 'd1', description: 'Dinner at Social', createdAt: hrsAgo(2) });
  const p = removePersonPlan([e, exp({ description: 'Chai' })], RAVI, 'dinner', USERS);
  assert.equal(p.ok, true); assert.deepEqual(p.updates, { splitAmong: [ME, MEERA] }); assert.equal(p.id, 'd1');
  assert.equal(p.summary, 'Ravi removed from Dinner at Social · now split 2 ways');
});
test('remove: picks the newest matching expense', () => {
  const old = exp({ id: 'o', description: 'Dinner', createdAt: hrsAgo(50) });
  const nw = exp({ id: 'n', description: 'Dinner', createdAt: hrsAgo(2) });
  assert.equal(removePersonPlan([old, nw], RAVI, 'dinner', USERS).id, 'n');
});
test('remove: not found / not in split / would be empty', () => {
  assert.equal(removePersonPlan([exp()], RAVI, 'pizza', USERS).reason, 'expense-not-found');
  assert.equal(removePersonPlan([exp({ splitAmong: [ME, MEERA] })], RAVI, 'dinner', USERS).reason, 'not-in-split');
  assert.equal(removePersonPlan([exp({ splitAmong: [RAVI] })], RAVI, 'dinner', USERS).reason, 'would-be-empty');
  assert.equal(removePersonPlan([exp()], RAVI, '', USERS).reason, 'no-description');
});

test('remind text', () => {
  const t = remindText({ toName: 'Test Ravi', amount: 1200, roomName: 'Flat', fromName: 'You' });
  assert.match(t, /Hey Ravi/); assert.match(t, /₹1,200/); assert.match(t, /Flat/);
});
test('remind plan: Ravi owes me', () => {
  const p = remindPlan([exp({ amount: 300 })], USERS, ME, RAVI, 'Flat');
  assert.equal(p.ok, true); assert.equal(p.amount, 100); assert.equal(p.name, 'Ravi'); assert.match(p.text, /₹100/);
});
test('remind plan: owes nothing', () => {
  assert.equal(remindPlan([exp({ amount: 600, paidBy: RAVI })], USERS, ME, RAVI, 'Flat').reason, 'owes-nothing');
});
test('settle plan: only the person owed gets Remind', () => {
  const p = settlePlan([exp({ amount: 300 })], USERS, ME, 'Flat');
  assert.equal(p.plan.length, 2); assert.ok(p.plan.every(x => x.canRemind));
  const q = settlePlan([exp({ amount: 300 })], USERS, RAVI, 'Flat');
  assert.ok(q.plan.every(x => !x.canRemind));
});
