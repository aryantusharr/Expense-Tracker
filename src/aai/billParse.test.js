import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseRead, readSums, billFromRead, billMismatch, chargesDetail, classifyReadError, splitLabel, readingSteps } from './billParse.js';

const now = new Date(2026, 9, 4);
const users = [{ id: 'a', name: 'Test Asha' }, { id: 'b', name: 'Test Ben' }, { id: 'c', name: 'Test Cy' }];
const categories = [{ id: 'g', name: 'Groceries' }, { id: 's', name: 'Snacks' }, { id: 'o', name: 'Other' }];
let n = 0;
const ctx = { users, me: 'a', isPersonal: false, categories, learned: null, today: '2026-10-04', uid: () => `u${n++}` };

const raw = {
  isBill: true, shop: 'Test Mart', shopConfidence: 0.95, date: '2026-10-02', dateConfidence: 0.9,
  items: [
    { name: 'Test Potato', qty: '1 kg', amount: 40, category: 'Groceries', confidence: 0.95 },
    { name: 'Test Chips', qty: '×2', amount: '40', category: 'Snacks', confidence: 0.9 },
    { name: 'Test Blur', qty: '', amount: null, category: 'Groceries', confidence: 0.2 },
  ],
  charges: [
    { label: 'GST', kind: 'tax', amount: 18 }, { label: 'Delivery', kind: 'delivery', amount: 25 },
    { label: 'Coupon', kind: 'discount', amount: 10 }, { label: 'Item total', kind: 'other', amount: 80 },
  ],
  total: 153, totalConfidence: 0.9,
};

test('normaliseRead: numbers, discounts negative, subtotal dropped, unclear lines found', () => {
  const r = normaliseRead(JSON.stringify(raw), { now });
  assert.equal(r.items[1].amount, 40);
  assert.deepEqual(r.charges.map(c => c.amount), [18, 25, -10]);
  assert.deepEqual(r.unclear, [2]);
  assert.equal(r.date, '2026-10-02');
  const s = readSums(r);
  assert.equal(s.items, 80); assert.equal(s.charges, 33); assert.equal(s.left, 40);
});

test('normaliseRead: future date dropped, not JSON throws PARSE, empty → not a bill', () => {
  assert.equal(normaliseRead({ ...raw, date: '2027-01-01' }, { now }).date, null);
  assert.throws(() => normaliseRead('nope'), e => e.code === 'PARSE');
  assert.equal(normaliseRead({ isBill: true, items: [], charges: [], total: null }, { now }).isBill, false);
  const blank = normaliseRead({ ...raw, items: [...raw.items, { name: '', qty: '', amount: null, category: '', confidence: 0.1 }, { name: '', qty: '', amount: null, category: '', confidence: 0.9 }] }, { now });
  assert.equal(blank.items.length, 4);
  assert.deepEqual(blank.unclear, [2, 3]);
});

test('billFromRead: failed row, one Taxes & charges row, splits, mismatch blocks', () => {
  const r = normaliseRead(raw, { now });
  const { bill, dots } = billFromRead(r, ctx, { paidBy: 'a', splits: { 1: ['a', 'b'] } });
  assert.equal(bill.items.length, 4);
  assert.equal(bill.items[2].failed, true);
  const tc = bill.items.find(i => i.charges);
  assert.equal(tc.amount, 33);
  assert.equal(tc.detail, 'GST ₹18 · DELIVERY ₹25 · DISCOUNT −₹10');
  assert.deepEqual(bill.items[1].splitAmong, ['a', 'b']);
  assert.deepEqual(bill.items[0].splitAmong, ['a', 'b', 'c']);
  assert.deepEqual(dots, []);
  const mm = billMismatch(bill);
  assert.equal(mm.diff, 40); assert.deepEqual(mm.failed, [3]); assert.ok(mm.off);
  bill.items[2].amount = 40;
  assert.equal(billMismatch(bill).off, false);
});

test('billFromRead: a net discount is spread over the items; personal room has no questions', () => {
  const r = normaliseRead({ ...raw, items: raw.items.slice(0, 2), charges: [{ label: 'Coupon', kind: 'discount', amount: 20 }], total: 60 }, { now });
  const { bill } = billFromRead(r, { ...ctx, isPersonal: true }, {});
  assert.equal(bill.items.length, 2);
  assert.equal(bill.items.reduce((s, i) => s + i.amount, 0), 60);
  assert.equal(bill.paidBy, 'a');
  assert.deepEqual(bill.items[0].splitAmong, ['a']);
  assert.equal(billMismatch(bill).off, false);
});

test('chargesDetail merges CGST + SGST into one GST', () => {
  assert.equal(chargesDetail([{ kind: 'tax', label: 'CGST', amount: 9 }, { kind: 'tax', label: 'SGST', amount: 9 }]), 'GST ₹18');
});

test('classifyReadError → reply type', () => {
  assert.equal(classifyReadError({ customErrorData: { status: 429 }, message: 'Quota exceeded for GenerateRequestsPerDayPerProject' }).type, 'limit');
  const w = classifyReadError({ customErrorData: { status: 429 }, message: 'Please retry in 7.2s' });
  assert.equal(w.type, 'wait'); assert.equal(w.retryIn, 8);
  assert.equal(classifyReadError({ customErrorData: { status: 503 } }).type, 'down');
  assert.equal(classifyReadError({ customErrorData: { status: 403 }, message: 'App Check token is invalid' }).type, 'down');
  assert.equal(classifyReadError({ code: 'NET' }).type, 'offline');
  assert.equal(classifyReadError(new Error('x'), false).type, 'offline');
  assert.equal(classifyReadError({ code: 'PARSE' }).type, 'notbill');
  assert.equal(classifyReadError({ code: 'SLOW_ABORT' }).type, 'down');
});

test('splitLabel + reading steps', () => {
  assert.equal(splitLabel(['a', 'b', 'c'], users, 'a'), 'All 3');
  assert.equal(splitLabel(['a', 'b'], users, 'a'), 'You + Ben');
  const steps = readingSteps(normaliseRead(raw, { now }), 1);
  assert.ok(steps.some(s => s.text.includes('GST')));
  assert.ok(steps.length <= 4);
});
