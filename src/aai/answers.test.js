import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceAnswer, settleAnswer, spendAnswer, findDuplicate, duplicatePairs, leftAfter } from './answers.js';
import { exp, USERS, CATEGORIES, NOW } from './fixtures.js';

const ME = 'u-me', RAVI = 'u-ravi', MEERA = 'u-meera';

test('balance: I paid 300 for 3 → Ravi and Meera each owe me 100', () => {
  const r = balanceAnswer([exp({ amount: 300 })], USERS, ME);
  assert.equal(r.totalOwedToMe, 200); assert.equal(r.totalIOwe, 0); assert.equal(r.net, 200);
  assert.deepEqual(r.owedToMe.map(x => [x.name, x.amount]).sort(), [['Meera', 100], ['Ravi', 100]]);
  assert.equal(r.settled, false);
});
test('balance: Ravi paid 600 for 3 → I owe Ravi 200', () => {
  const r = balanceAnswer([exp({ amount: 600, paidBy: RAVI })], USERS, ME);
  assert.deepEqual(r.iOwe, [{ id: RAVI, name: 'Ravi', amount: 200 }]);
});
test('balance: even → settled', () => {
  const r = balanceAnswer([exp({ amount: 300 }), exp({ amount: 300, paidBy: RAVI }), exp({ amount: 300, paidBy: MEERA })], USERS, ME);
  assert.equal(r.settled, true); assert.equal(r.net, 0);
});
test('balance: no expenses', () => assert.equal(balanceAnswer([], USERS, ME).settled, true));
test('balance matches calculateBalances (sums to zero)', () => {
  const r = balanceAnswer([exp({ amount: 100 })], USERS, ME);
  assert.equal(r.totalOwedToMe, 67); // 100/3 each → rounded balances sum to 0
});
test('settle plan: minimum payments, from → to', () => {
  const r = settleAnswer([exp({ amount: 300 })], USERS);
  assert.equal(r.plan.length, 2); assert.equal(r.total, 200);
  assert.ok(r.plan.every(p => p.toId === ME));
});
test('settle plan: all settled', () => assert.equal(settleAnswer([], USERS).settled, true));

const SEP = (over) => exp({ date: '2026-09-10', createdAt: '2026-09-10T10:00:00Z', ...over });
const OCT = (over) => exp({ date: '2026-10-01', ...over });

test('spend: food this month vs last month', () => {
  const expenses = [OCT({ amount: 600 }), OCT({ amount: 400 }), SEP({ amount: 500 }), OCT({ amount: 999, categoryId: 'cat-5' })];
  const r = spendAnswer({ expenses, categories: CATEGORIES, categoryId: 'cat-4', period: 'this', now: NOW, meId: ME });
  assert.equal(r.total, 1000); assert.equal(r.prevTotal, 500); assert.equal(r.pctVsPrev, 100);
  assert.equal(r.month, 'Oct'); assert.equal(r.prevMonth, 'Sep'); assert.equal(r.count, 2); assert.equal(r.categoryName, 'Food & Dining');
  assert.equal(r.myShare, 333.33);
});
test('spend: no category → everything', () => {
  const r = spendAnswer({ expenses: [OCT({ amount: 100 }), OCT({ amount: 50, categoryId: 'cat-5' })], categories: CATEGORIES, categoryId: null, period: 'this', now: NOW });
  assert.equal(r.total, 150);
});
test('spend: last month', () => {
  const r = spendAnswer({ expenses: [SEP({ amount: 500 }), OCT({ amount: 100 })], categories: CATEGORIES, period: 'last', now: NOW });
  assert.equal(r.total, 500); assert.equal(r.month, 'Sep'); assert.equal(r.prevMonth, 'Aug'); assert.equal(r.pctVsPrev, null);
});
test('spend: no previous month → no percentage', () => {
  assert.equal(spendAnswer({ expenses: [OCT({ amount: 100 })], categories: CATEGORIES, period: 'this', now: NOW }).pctVsPrev, null);
});
test('spend: biggest', () => {
  const big = OCT({ amount: 5000, description: 'Rent' });
  const r = spendAnswer({ expenses: [OCT({ amount: 100 }), big], categories: CATEGORIES, period: 'biggest', now: NOW });
  assert.equal(r.biggest.amount, 5000); assert.equal(r.biggest.description, 'Rent');
});
test('spend: percent can go down', () => {
  const r = spendAnswer({ expenses: [OCT({ amount: 250 }), SEP({ amount: 500 })], categories: CATEGORIES, period: 'this', now: NOW });
  assert.equal(r.pctVsPrev, -50);
});
test('spend: January looks back to December', () => {
  const jan = new Date(2027, 0, 15);
  const r = spendAnswer({ expenses: [exp({ date: '2026-12-20', amount: 200 }), exp({ date: '2027-01-02', amount: 300 })], categories: CATEGORIES, period: 'this', now: jan });
  assert.equal(r.prevTotal, 200); assert.equal(r.prevMonth, 'Dec'); assert.equal(r.pctVsPrev, 50);
});

test('leftAfter: needs a budget', () => {
  assert.equal(leftAfter({ budget: 0, expenses: [], now: NOW, amount: 100 }), null);
  assert.equal(leftAfter({ budget: 10000, expenses: [OCT({ amount: 1000 })], now: NOW, amount: 450 }), 8550);
});

test('duplicate: same amount + description within 24h', () => {
  const recent = exp({ description: 'Dinner', amount: 450, createdAt: '2026-10-03T08:00:00.000Z' });
  assert.equal(findDuplicate([recent], { amount: 450, description: 'dinner' }, NOW)?.id, recent.id);
  assert.equal(findDuplicate([recent], { amount: 451, description: 'dinner' }, NOW), null);
  assert.equal(findDuplicate([recent], { amount: 450, description: 'lunch' }, NOW), null);
  assert.equal(findDuplicate([exp({ amount: 450, createdAt: '2026-09-20T08:00:00.000Z' })], { amount: 450, description: 'dinner' }, NOW), null);
});
test('duplicate pairs inside the room', () => {
  const a = exp({ description: 'Chai', amount: 40, createdAt: '2026-10-03T08:00:00.000Z' });
  const b = exp({ description: 'chai', amount: 40, createdAt: '2026-10-03T08:05:00.000Z' });
  const c = exp({ description: 'Auto', amount: 40, createdAt: '2026-10-03T08:06:00.000Z' });
  const pairs = duplicatePairs([a, b, c], NOW);
  assert.equal(pairs.length, 1); assert.equal(pairs[0].newer.id, b.id);
});
