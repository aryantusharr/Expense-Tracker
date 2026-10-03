import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePayment, paymentIntent } from './upi.js';
import { ctx, NOW } from './fixtures.js';

// NOTE: these are typical shapes written by hand, NOT her real copied samples (still to come).
const GPAY = `Paid ₹450 to Ravi Kumar
UPI transaction ID: 612345678901
3 Oct 2026, 7:45 PM`;
const GPAY2 = 'You paid ₹1,250.00 to ZOMATO\nUPI transaction ID: 987654321012\nOct 2, 2026 at 8:10 PM';
const PHONEPE = `Payment successful
₹320
Paid to: Blinkit
Transaction ID: T2610031945123456789
UTR No: 612345678902
03 Oct 2026, 07:45 pm`;
const PAYTM = 'Paid Rs. 89.50 to Chai Point on 03 Oct 2026 07:45 PM. Order ID 20261003111212800110. UPI Ref No: 612345678903';
const BHIM = 'Rs 200.00 sent to meera@okaxis. UPI Ref 612345678904 on 02-10-2026';
const RECEIVED = 'Received ₹500 from Ravi Kumar\nUPI transaction ID: 612345678905';

test('gpay', () => {
  const p = parsePayment(GPAY, NOW);
  assert.equal(p.app, 'gpay'); assert.equal(p.amount, 450); assert.equal(p.payee, 'Ravi Kumar');
  assert.equal(p.upiRef, '612345678901'); assert.equal(p.date, '2026-10-03'); assert.equal(p.time, '19:45');
  assert.equal(p.direction, 'paid');
});
test('gpay with thousands + decimals', () => {
  const p = parsePayment(GPAY2, NOW);
  assert.equal(p.amount, 1250); assert.equal(p.payee, 'ZOMATO'); assert.equal(p.date, '2026-10-02'); assert.equal(p.time, '20:10');
});
test('phonepe', () => {
  const p = parsePayment(PHONEPE, NOW);
  assert.equal(p.app, 'phonepe'); assert.equal(p.amount, 320); assert.equal(p.payee, 'Blinkit');
  assert.equal(p.upiRef, '612345678902'); assert.equal(p.date, '2026-10-03');
});
test('paytm', () => {
  const p = parsePayment(PAYTM, NOW);
  assert.equal(p.app, 'paytm'); assert.equal(p.amount, 89.5); assert.equal(p.payee, 'Chai Point'); assert.equal(p.upiRef, '612345678903');
});
test('bhim / generic UPI with dd-mm-yyyy', () => {
  const p = parsePayment(BHIM, NOW);
  assert.equal(p.amount, 200); assert.equal(p.payee, 'meera@okaxis'); assert.equal(p.date, '2026-10-02'); assert.equal(p.upiRef, '612345678904');
});
test('received money is not an expense', () => {
  assert.equal(parsePayment(RECEIVED, NOW).direction, 'received');
  assert.equal(paymentIntent(RECEIVED, ctx()), null);
});
test('not a payment → null', () => {
  assert.equal(parsePayment('see you at 7:30 tomorrow', NOW), null);
  assert.equal(parsePayment('', NOW), null);
  assert.equal(parsePayment('dinner ₹450', NOW), null);
});
test('payment to a roommate → payback note (not recorded)', () => {
  const r = paymentIntent(GPAY, ctx());
  assert.equal(r.type, 'payback'); assert.equal(r.person, 'u-ravi'); assert.equal(r.personName, 'Ravi'); assert.equal(r.amount, 450);
});
test('payment to a shop → expense draft', () => {
  const r = paymentIntent(GPAY2, ctx());
  assert.equal(r.type, 'payment'); assert.equal(r.amount, 1250); assert.equal(r.description, 'ZOMATO'); assert.equal(r.date, '2026-10-02');
  assert.equal(r.categoryId, 'cat-4');
});
test('payment to yourself is not a payback', () => {
  const r = paymentIntent('Paid ₹100 to You\nUPI transaction ID: 612345678999', ctx());
  assert.equal(r.type, 'payment');
});
test('personal room: roommates do not exist', () => {
  assert.equal(paymentIntent(GPAY, ctx({ isPersonal: true })).type, 'payment');
});
test('no date in text → today', () => {
  const r = paymentIntent('Paid ₹60 to Chai Wala\nUPI transaction ID: 612345678998', ctx());
  assert.equal(r.date, '2026-10-03');
});
