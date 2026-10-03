import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChips, hiddenIds, hideChip, MAX_CHIPS } from './chips.js';
import { exp, USERS, NOW } from './fixtures.js';

const ME = 'u-me', RAVI = 'u-ravi';
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const base = (over = {}) => ({ now: NOW, expenses: [], users: USERS, me: ME, categories: [], ...over });
const ids = chips => chips.map(c => c.id);
const AGO = ms => new Date(NOW.getTime() - ms).toISOString();

test('empty room: only question chips (+ Not logged after 8pm)', () => {
  assert.deepEqual(ids(buildChips(base())), ['not-logged', 'q-owe', 'q-month', 'q-vs']);
});
test('"Biggest spend" only after the 10th', () => {
  assert.ok(ids(buildChips(base({ now: at(2026, 10, 5) }))).every(i => i !== 'q-biggest'));
  assert.ok(ids(buildChips(base({ now: at(2026, 10, 11) }))).includes('q-biggest'));
});
test('personal room: no Kitna dena hai, no budget chip', () => {
  const c = ids(buildChips(base({ isPersonal: true })));
  assert.ok(!c.includes('q-budget')); assert.ok(!c.includes('q-owe'));
});
test('Bill waiting when the queue has bills', () => {
  const c = buildChips(base({ queueCount: 2 }));
  assert.ok(ids(c).includes('bill-waiting')); assert.equal(c.find(x => x.id === 'bill-waiting').detail, '2 to read');
});
test('Undo last: only within 10 minutes and if the expense still exists', () => {
  const e = exp({ id: 'a1', createdAt: AGO(60e3) });
  assert.ok(ids(buildChips(base({ expenses: [e], lastAai: { ids: ['a1'], at: NOW.getTime() - 5 * 60e3 } }))).includes('undo-last'));
  assert.ok(!ids(buildChips(base({ expenses: [e], lastAai: { ids: ['a1'], at: NOW.getTime() - 11 * 60e3 } }))).includes('undo-last'));
  assert.ok(!ids(buildChips(base({ expenses: [], lastAai: { ids: ['a1'], at: NOW.getTime() - 60e3 } }))).includes('undo-last'));
});
test('Possible duplicate', () => {
  const a = exp({ description: 'Chai', amount: 40, createdAt: AGO(3600e3) });
  const b = exp({ description: 'Chai', amount: 40, createdAt: AGO(1800e3) });
  const c = buildChips(base({ expenses: [a, b] })).find(x => x.id === 'duplicate');
  assert.equal(c.action.remove, b.id); assert.equal(c.action.keep, a.id);
});
test('Remind X: owes me for 7+ days', () => {
  const old = exp({ amount: 300, date: '2026-09-20', createdAt: '2026-09-20T10:00:00Z' });
  const c = buildChips(base({ expenses: [old] })).filter(x => x.id.startsWith('remind-'));
  assert.ok(c.length >= 1); assert.equal(c[0].group, 'owed'); assert.match(c[0].detail, /owes ₹100/);
});
test('Remind X: not when the debt is fresh (< 7 days)', () => {
  const fresh = exp({ amount: 300, date: '2026-10-01', createdAt: '2026-10-01T10:00:00Z' });
  assert.ok(!ids(buildChips(base({ expenses: [fresh] }))).some(i => i.startsWith('remind-')));
});
test('Who owes whom: 2+ open settlements', () => {
  assert.ok(ids(buildChips(base({ expenses: [exp({ amount: 300 })] }))).includes('settle-plan'));
  assert.ok(!ids(buildChips(base({ expenses: [exp({ amount: 300, splitAmong: [ME, RAVI] })] }))).includes('settle-plan'));
});
test('Month-end remind: last 3 days, someone owes me', () => {
  const e = exp({ amount: 300, date: '2026-10-29', createdAt: '2026-10-29T10:00:00Z' });
  const c = buildChips(base({ now: at(2026, 10, 30), expenses: [e] }));
  assert.ok(c.some(x => x.id === 'month-end-remind'));
});
test('Same as yesterday: not repeated today', () => {
  const y = exp({ description: 'Chai', amount: 40, date: '2026-10-02', createdAt: '2026-10-02T09:00:00Z' });
  assert.ok(ids(buildChips(base({ expenses: [y] }))).includes('same-as-yesterday'));
  const t = exp({ description: 'Chai', amount: 40, date: '2026-10-03', createdAt: '2026-10-03T09:00:00Z' });
  assert.ok(!ids(buildChips(base({ expenses: [y, t] }))).includes('same-as-yesterday'));
});
test('Not logged today: after 8pm with nothing today', () => {
  assert.ok(ids(buildChips(base({ now: at(2026, 10, 3, 21) }))).includes('not-logged'));
  assert.ok(!ids(buildChips(base({ now: at(2026, 10, 3, 19) }))).includes('not-logged'));
  assert.ok(!ids(buildChips(base({ now: at(2026, 10, 3, 21), expenses: [exp({ date: '2026-10-03' })] }))).includes('not-logged'));
});
test('Rent due: monthly expense due within 3 days', () => {
  const rent = d => exp({ description: 'Rent', amount: 15000, categoryId: 'cat-2', date: d, createdAt: d + 'T10:00:00Z' });
  const c = buildChips(base({ now: at(2026, 10, 3), expenses: [rent('2026-08-05'), rent('2026-09-05')] })).find(x => x.id === 'rent-due');
  assert.ok(c); assert.equal(c.detail, 'in 2d'); assert.equal(c.action.draft.amount, 15000);
  assert.ok(!ids(buildChips(base({ now: at(2026, 10, 3), expenses: [rent('2026-08-20'), rent('2026-09-20')] }))).includes('rent-due'));
  assert.ok(!ids(buildChips(base({ now: at(2026, 10, 3), expenses: [rent('2026-09-05'), rent('2026-10-02')] }))).includes('rent-due'));
});
test('Usual now: recurring around this hour, not logged today', () => {
  const mk = d => exp({ description: 'Chai', amount: 20, categoryId: 'cat-12', date: d, createdAt: new Date(2026, +d.slice(5, 7) - 1, +d.slice(8), 21, 5).toISOString() });
  const c = buildChips(base({ now: at(2026, 10, 3, 21), expenses: [mk('2026-08-20'), mk('2026-09-21'), mk('2026-09-22')] }));
  assert.ok(ids(c).includes('usual-now'));
  assert.ok(!ids(buildChips(base({ now: at(2026, 10, 3, 14), expenses: [mk('2026-08-20'), mk('2026-09-21'), mk('2026-09-22')] }))).includes('usual-now'));
});
test('Repeat last bill: within 14 days only', () => {
  const l = d => exp({ groupId: 'g1', groupName: 'Dmart', isItemised: true, date: d, createdAt: d + 'T10:00:00Z' });
  assert.ok(ids(buildChips(base({ expenses: [l('2026-09-25')] }))).includes('repeat-bill'));
  assert.ok(!ids(buildChips(base({ expenses: [l('2026-09-10')] }))).includes('repeat-bill'));
});
test('Install chip only when installable', () => {
  assert.ok(ids(buildChips(base({ installable: true }))).includes('install'));
  assert.ok(!ids(buildChips(base())).includes('install'));
});
test('order: urgent → owed → habits → questions', () => {
  const rank = { urgent: 0, owed: 1, habits: 2, questions: 3 };
  const old = exp({ amount: 300, date: '2026-09-20', createdAt: '2026-09-20T10:00:00Z' });
  const c = buildChips(base({ expenses: [old], queueCount: 1, installable: true }));
  const r = c.map(x => rank[x.group]);
  assert.deepEqual(r, [...r].sort((a, b) => a - b));
});
test(`never more than ${MAX_CHIPS}`, () => {
  const old = exp({ amount: 300, date: '2026-09-20', createdAt: '2026-09-20T10:00:00Z' });
  const c = buildChips(base({ expenses: [old], queueCount: 1, installable: true, now: at(2026, 10, 15, 21) }));
  assert.ok(c.length <= MAX_CHIPS);
});
test('hidden chips stay hidden; slots refill from the questions', () => {
  const c = buildChips(base({ hidden: ['q-month'] }));
  assert.ok(!ids(c).includes('q-month'));
});
test('hide until midnight', () => {
  let s = hideChip(null, 'q-month', NOW);
  assert.deepEqual(hiddenIds(s, NOW), ['q-month']);
  s = hideChip(s, 'q-vs', NOW);
  assert.deepEqual(hiddenIds(s, NOW), ['q-month', 'q-vs']);
  assert.deepEqual(hiddenIds(s, at(2026, 10, 4, 0)), []);
  assert.deepEqual(hiddenIds(undefined, NOW), []);
  assert.deepEqual(hiddenIds({ date: 'x', ids: 5 }, NOW), []);
});
