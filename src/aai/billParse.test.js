import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanQty, normaliseRead, readSums, billFromRead, billMismatch, chargesDetail, classifyReadError, splitLabel, readingSteps, shortName, TAXES_CATEGORY, categoryFor } from './billParse.js';

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

test('cleanQty + paise rounding is absorbed, ₹0 lines dropped', () => {
  assert.deepEqual(['1 x', '1.0', '75 g x 1', '1 pack (125 ml)', '2.0', '×2', '1 kg', '500 ml'].map(cleanQty), ['', '', '75 g', '125 ml', '×2', '×2', '1 kg', '500 ml']);
  const r = normaliseRead({ ...raw, items: [{ name: 'Test Pizza', qty: '1', amount: 93.45, category: 'Snacks', confidence: 0.9 }, { name: 'Test Free', qty: '', amount: 0, category: '', confidence: 0.9 }], charges: [], total: 93.46 }, { now });
  assert.equal(r.items.length, 1);
  const { bill } = billFromRead(r, ctx, { paidBy: 'a' });
  assert.equal(bill.items[0].amount, 93.46);
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

test('shortName: no size/pack, 4 words max, tidy caps', () => {
  assert.equal(shortName('THUMS UP | COLA SPARKLING SOFT DRINK PET BOTTLE 750 ML'), 'Thums Up Cola Sparkling');
  assert.equal(shortName('MINI PIZZA 100 G'), 'Mini Pizza');
  assert.equal(shortName('Test Potato'), 'Test Potato');
  assert.equal(shortName('500 g'), '500 g');
});

test('billFromRead: taxes row uses the Taxes category (existing one, else the one to create); no date → dateUnsure', () => {
  const r = normaliseRead({ ...raw, date: '' }, { now });
  const a = billFromRead(r, ctx, { paidBy: 'a' }).bill;
  assert.equal(a.items.find(i => i.charges).categoryId, TAXES_CATEGORY.id);
  assert.equal(a.dateUnsure, true);
  const b = billFromRead(r, { ...ctx, categories: [...categories, { id: 'tx', name: 'Taxes' }] }, { paidBy: 'a' }).bill;
  assert.equal(b.items.find(i => i.charges).categoryId, 'tx');
});

test('categoryFor: what the room learned wins over the model, then the model, then keywords', () => {
  const learned = new Map([['test chips', 'g']]);
  assert.equal(categoryFor({ name: 'Test Chips', category: 'Snacks' }, { categories, learned }).id, 'g');   // learned beats Gemini's "Snacks"
  assert.equal(categoryFor({ name: 'Test Potato', category: 'Snacks' }, { categories, learned }).id, 's');  // nothing learned → the model's pick
});
