import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateWords, makeMatcher, collectMatches, displayBill, resolvePick, visibleDays, stripText } from './searchData.js';

const cats = [{ id: 'c1', name: 'Groceries' }];
const users = [{ id: 'u1', name: 'Ravi' }];
const mk = (id, date, description, extra = {}) => ({ id, date, description, amount: 100, categoryId: 'c1', paidBy: 'u1', ...extra });
const row = e => ({ kind: 'row', id: e.id, e });
const month = (key, short, days) => ({ key, name: short, short, days: days.map(([k, label, es]) => ({ key: k, label, entries: es })) });

test('dates can be searched the way people type them, without "9 oct" catching "19 oct"', () => {
  const m = makeMatcher({ filter: null, ql: '9 oct', categories: cats, users, today: '2026-10-26' });
  assert.equal(m(mk('a', '2026-10-09', 'x', { amount: 5 })), true);
  assert.equal(m(mk('b', '2026-10-19', 'x', { amount: 5 })), false);
  const t = makeMatcher({ filter: null, ql: 'yesterday', categories: cats, users, today: '2026-10-26' });
  assert.equal(t(mk('c', '2026-10-25', 'x')), true);
  assert.equal(t(mk('d', '2026-10-24', 'x')), false);
  assert.ok(dateWords('2026-10-09').includes('09 october 2026'));
});

test('name, category, payer and amount still match; chips narrow by payer or category', () => {
  const base = { categories: cats, users, today: '2026-10-26' };
  const e = mk('a', '2026-10-02', 'Atta 10kg', { amount: 520 });
  assert.equal(makeMatcher({ ...base, filter: null, ql: 'atta' })(e), true);
  assert.equal(makeMatcher({ ...base, filter: null, ql: 'grocer' })(e), true);
  assert.equal(makeMatcher({ ...base, filter: null, ql: 'ravi' })(e), true);
  assert.equal(makeMatcher({ ...base, filter: null, ql: '₹520' })(e), true);
  assert.equal(makeMatcher({ ...base, filter: { kind: 'cat', id: 'c1' }, ql: '' })(e), true);
  assert.equal(makeMatcher({ ...base, filter: { kind: 'payer', id: 'u9' }, ql: '' })(e), false);
});

const oct = month('2026-10', 'OCT 2026', [['2026-10-22', 'THU · 22 OCT', [row(mk('1', '2026-10-22', 'Atta & dal'))]], ['2026-10-09', 'FRI · 9 OCT', [row(mk('2', '2026-10-09', 'Milk'))]]]);
const sep = month('2026-09', 'SEP 2026', [['2026-09-28', 'MON · 28 SEP', [row(mk('3', '2026-09-28', 'Atta 5kg'))]]]);
const matches = makeMatcher({ filter: null, ql: 'atta', categories: cats, users, today: '2026-10-26' });

test('matches are collected across every month, newest first, with counts and no money totals', () => {
  const { groups, total } = collectMatches([oct, sep], matches);
  assert.equal(total, 2);
  assert.deepEqual(groups.map(g => [g.key, g.label, g.year, g.count]), [['2026-10', 'OCT', '2026', 1], ['2026-09', 'SEP', '2026', 1]]);
  assert.equal(groups[0].days.length, 1);
});

test('default pick is the newest month with matches; dates and "all" narrow or widen it', () => {
  const { groups, total } = collectMatches([oct, sep], matches);
  assert.deepEqual(resolvePick(groups, null), { month: '2026-10', dateKey: null });
  assert.deepEqual(resolvePick(groups, { month: '2026-09', date: '2026-09-28' }), { month: '2026-09', dateKey: '2026-09-28' });
  assert.deepEqual(resolvePick(groups, { month: '2026-09', date: 'nope' }), { month: '2026-09', dateKey: null });
  assert.deepEqual(resolvePick(groups, { month: 'gone' }), { month: '2026-10', dateKey: null });
  assert.equal(visibleDays(groups, { month: 'all', dateKey: null }).length, 2);
  assert.equal(visibleDays(groups, { month: 'all', dateKey: null })[1].title, 'MON · 28 SEP 2026');
  assert.equal(stripText(groups, total, { month: '2026-10', dateKey: null }).primary, '1 MATCH IN OCT');
  assert.equal(stripText(groups, total, { month: '2026-10', dateKey: null }).secondary, '2 IN ALL MONTHS');
  assert.equal(stripText(groups, total, { month: 'all', dateKey: null }).primary, '2 MATCHES · 2 MONTHS');
  assert.equal(stripText([], 0, { month: null, dateKey: null }).primary, 'NO MATCHES');
});

test('a bill where only some items match shows just those, without touching the original', () => {
  const bill = { kind: 'bill', id: 'g', name: 'D-Mart run', total: 460, items: [mk('i1', '2026-10-09', 'Atta 5kg', { amount: 320 }), mk('i2', '2026-10-09', 'Soap', { amount: 140 })], e: null };
  const shown = displayBill(bill, matches);
  assert.equal(shown.items.length, 1);
  assert.equal(shown.total, 320);
  assert.equal(shown.partial, '1 of 2 items match');
  assert.equal(bill.items.length, 2);
  assert.equal(displayBill(bill, () => true), bill);
});
