import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './parse.js';
import { ctx, USERS, NOW } from './fixtures.js';

const ME = 'u-me', RAVI = 'u-ravi', MEERA = 'u-meera';
const ALL = [ME, RAVI, MEERA];
const FOUR = [...USERS, { id: 'u-sam', name: 'Sam' }];

/** Check only the fields listed in `want` (arrays/objects compared deeply). */
function check(input, want, over) {
  const got = parse(input, ctx(over));
  for (const [k, v] of Object.entries(want)) {
    assert.deepEqual(got[k], v, `"${input}" → ${k}: got ${JSON.stringify(got[k])}, want ${JSON.stringify(v)}\nfull: ${JSON.stringify(got)}`);
  }
}

// [input, expected fields, ctx override?]
const EXPENSES = [
  // ── plan examples ──
  ['paid 450 dinner with ravi', { type: 'expense', amount: 450, description: 'Dinner', categoryId: 'cat-4', paidBy: ME, splitAmong: [ME, RAVI] }],
  ['ravi paid 1,200 groceries all', { amount: 1200, paidBy: RAVI, splitAmong: ALL, categoryId: 'cat-1' }],
  ['chai 40 kal', { amount: 40, description: 'Chai', date: '2026-10-02', splitAmong: ALL }],
  ['4.5k rent paid by meera', { amount: 4500, paidBy: MEERA, description: 'Rent', categoryId: 'cat-2' }],
  ['auto 120+80 me+ravi', { amount: 200, description: 'Auto', categoryId: 'cat-5', splitAmong: [ME, RAVI] }],
  ['swiggy 640 not meera', { amount: 640, splitAmong: [ME, RAVI] }],
  ['petrol 2000 50-50 with ravi', { amount: 2000, splitAmong: [ME, RAVI], splitNote: 'named', questions: [] }],
  ['maine diya 300 sabzi 2 oct', { amount: 300, paidBy: ME, description: 'Sabzi', date: '2026-10-02' }],
  ['3 samosa 60', { amount: 60, description: '3 samosa', amountFlagged: true }],
  // ── amounts ──
  ['₹450 dinner', { amount: 450, description: 'Dinner' }],
  ['dinner 450rs', { amount: 450, description: 'Dinner' }],
  ['dinner rs 450', { amount: 450 }],
  ['dinner Rs.450', { amount: 450 }],
  ['dinner 450/-', { amount: 450 }],
  ['dinner 1,200', { amount: 1200 }],
  ['rent 1,20,000', { amount: 120000 }],
  ['coffee 99.50', { amount: 99.5 }],
  ['trip 2k', { amount: 2000 }],
  ['trip 1.5k', { amount: 1500 }],
  ['lunch 120+80+50', { amount: 250 }],
  ['lunch 120 + 80', { amount: 200 }],
  ['snacks 25*4', { amount: 100 }],
  ['dinner ₹450 for 3', { amount: 450, amountFlagged: true }],
  ['2 coffee 180', { amount: 180, description: '2 coffee', amountFlagged: true }],
  ['dinner 450', { amountFlagged: false }],
  ['4 pizza rs 800', { amount: 800, amountFlagged: true }],
  // ── dates ──
  ['chai 20 today', { date: '2026-10-03', dateGiven: true }],
  ['chai 20 aaj', { date: '2026-10-03' }],
  ['chai 20 yesterday', { date: '2026-10-02' }],
  ['chai 20 parso', { date: '2026-10-01' }],
  ['kal chai 20', { date: '2026-10-02', description: 'Chai' }],
  ['chai 20 2 oct', { date: '2026-10-02' }],
  ['oct 2 chai 20', { date: '2026-10-02', amount: 20 }],
  ['chai 20 2nd october', { date: '2026-10-02' }],
  ['chai 20 15 sep', { date: '2026-09-15' }],
  ['chai 20 1 dec', { date: '2025-12-01' }],
  ['chai 20 2/10', { date: '2026-10-02', amount: 20 }], // day/month
  ['chai 20 5/9', { date: '2026-09-05' }],
  ['chai 20 last friday', { date: '2026-10-02' }],
  ['chai 20 friday', { date: '2026-10-02' }],
  ['chai 20 saturday', { date: '2026-10-03' }],
  ['chai 20 last saturday', { date: '2026-09-26' }],
  ['chai 20 monday', { date: '2026-09-28' }],
  ['dinner 450 no date', { dateGiven: false, date: '2026-10-03' }],
  // ── payer ──
  ['dinner 450 i paid', { paidBy: ME }],
  ['dinner 450 paid by ravi', { paidBy: RAVI }],
  ['dinner 450 ravi ne diya', { paidBy: RAVI, description: 'Dinner' }],
  ['meera paid 300 cab', { paidBy: MEERA, amount: 300, description: 'Cab' }],
  ['dinner 450 paid by Ravi', { paidBy: RAVI }],
  ['dinner 450 paid by raavi', { paidBy: RAVI }],
  ['dinner 450 paid by mee', { paidBy: MEERA }],
  ['dinner 450 paid by me', { paidBy: ME }],
  ['dinner 450', { paidBy: ME, needsIdentity: false }],
  ['dinner 450', { paidBy: null, needsIdentity: true, splitAmong: ALL }, { me: null }],
  // ── people ──
  ['dinner 450 all', { splitAmong: ALL, splitNote: 'all' }],
  ['dinner 450 sab', { splitAmong: ALL }],
  ['dinner 450 everyone', { splitAmong: ALL }],
  ['dinner 450 with ravi meera', { splitAmong: ALL }],
  ['dinner 450 with ravi and meera', { splitAmong: ALL, description: 'Dinner' }],
  ['dinner 450 with meera', { splitAmong: [ME, MEERA] }],
  ['dinner 450 saath ravi', { splitAmong: [ME, RAVI] }],
  ['dinner 450 me+meera', { splitAmong: [ME, MEERA] }],
  ['dinner 450 ravi+meera', { splitAmong: [RAVI, MEERA] }],
  ['dinner 450 me + ravi', { splitAmong: [ME, RAVI] }],
  ['dinner 450 only meera', { splitAmong: [MEERA] }],
  ['dinner 450 only ravi meera', { splitAmong: [RAVI, MEERA] }],
  ['dinner 450 except ravi', { splitAmong: [ME, MEERA] }],
  ['dinner 450 bina meera', { splitAmong: [ME, RAVI] }],
  ['dinner 450 without ravi', { splitAmong: [ME, MEERA] }],
  ['dinner 450 not me', { splitAmong: [RAVI, MEERA] }],
  ['dinner 900 not ravi not meera', { splitAmong: [ME], splitNote: 'just you', questions: [] }],
  ['ravi paid 600 dinner not meera', { paidBy: RAVI, splitAmong: [ME, RAVI] }],
  ['ravi paid 600 dinner with meera', { paidBy: RAVI, splitAmong: [RAVI, MEERA] }],
  ['dinner 450 with ravi 2 oct', { splitAmong: [ME, RAVI], date: '2026-10-02', amount: 450 }],
  ['dinner 450 with RAVI', { splitAmong: [ME, RAVI] }],
  ['dinner 450 with Test Ravi', { splitAmong: ALL }, { users: [{ id: ME, name: 'Test You' }, { id: RAVI, name: 'Test Ravi' }, { id: MEERA, name: 'Test Meera' }] }],
  ['dinner 450 with ravi', { splitAmong: [ME, RAVI] }, { users: [{ id: ME, name: 'Test You' }, { id: RAVI, name: 'Test Ravi' }, { id: MEERA, name: 'Test Meera' }] }],
  // ── hinglish ──
  ['maine diya 500 pyaz', { paidBy: ME, amount: 500, categoryId: 'cat-1' }],
  ['sabzi 150 kal', { amount: 150, date: '2026-10-02', categoryId: 'cat-1' }],
  ['chai 20 ka ravi paid', { paidBy: RAVI, amount: 20 }],
  ['500 ka petrol', { amount: 500, description: 'Petrol' }],
  ['doodh 60 rupaye', { amount: 60, description: 'Doodh' }],
  // ── personal room ──
  ['dinner 450 with ravi', { personal: true, splitAmong: [ME], splitNote: 'personal', questions: [] }, { isPersonal: true, users: [USERS[0]] }],
  ['dinner 450 50-50', { splitNote: 'personal', questions: [] }, { isPersonal: true, users: [USERS[0]] }],
  ['coffee 120', { personal: true, paidBy: ME, needsIdentity: false }, { isPersonal: true, users: [USERS[0]] }],
  // ── description / category ──
  ['uber 250', { description: 'Uber' }],
  ['netflix 649', { amount: 649, description: 'Netflix' }],
  ['450 dinner', { amount: 450, description: 'Dinner' }],
  ['paid 450 for dinner', { description: 'Dinner' }],
  ['dinner at the cafe 450', { amount: 450 }],
  ['450', { amount: 450, description: '', categoryId: null }],
];

const SPLITS = [
  // 2-member room
  ['petrol 2000 50-50', { amount: 2000, splitAmong: [ME, RAVI], splitNote: 'equal', questions: [] }, { users: USERS.slice(0, 2) }],
  ['petrol 2000 half-half', { splitAmong: [ME, RAVI], questions: [] }, { users: USERS.slice(0, 2) }],
  ['petrol 2000 aadha aadha', { splitAmong: [ME, RAVI], questions: [] }, { users: USERS.slice(0, 2) }],
  // 3-member room
  ['petrol 2000 50-50', { splitNote: 'pick', splitAmong: [ME], ratio: '50-50' }],
  ['petrol 2000 50/50', { splitNote: 'pick' }],
  ['petrol 2000 half half', { splitNote: 'pick' }],
  ['petrol 2000 50-50 with ravi meera', { splitAmong: ALL, questions: [] }],
  ['petrol 2000 33/33/33', { splitAmong: ALL, splitNote: 'equal', questions: [] }],
  ['petrol 2000 33-33-34', { splitAmong: ALL, questions: [] }],
  ['petrol 2000 60/40', { splitNote: 'pick', splitAmong: ALL }],
  ['petrol 2000 70-30', { splitNote: 'pick' }],
  ['petrol 2000 50/30/20', { splitNote: 'pick' }],
  ['petrol 2000 60/40 with ravi', { splitAmong: [ME, RAVI], questions: [] }],
  ['petrol 2000 60/40 all', { splitAmong: ALL, questions: [] }],
  // 4-member room
  ['petrol 2000 33/33/33', { splitNote: 'pick', splitAmong: [ME, RAVI, MEERA, 'u-sam'] }, { users: FOUR }],
  ['petrol 2000 25/25/25/25', { splitAmong: [ME, RAVI, MEERA, 'u-sam'], questions: [] }, { users: FOUR }],
  ['petrol 2000 50-50', { splitNote: 'pick', splitAmong: [ME] }, { users: FOUR }],
];

for (const [input, want, over] of [...EXPENSES, ...SPLITS]) {
  const tag = over ? ` [${Object.keys(over).join(',')}]` : '';
  test(`parse: ${input}${tag}`, () => check(input, want, over));
}

test('split questions: 3 members 50-50 asks "Pick 2" and allows "split 3 ways"', () => {
  const q = parse('petrol 2000 50-50', ctx()).questions[0];
  assert.equal(q.kind, 'pickSplit');
  assert.equal(q.need, 2);
  assert.equal(q.message, '50-50 between who? Pick 2');
  assert.deepEqual(q.selected, [ME]);
  assert.equal(q.allWays, 3);
  assert.equal(q.allWaysLabel, 'Split 3 ways instead');
});

test('split questions: 4 members 33/33/33 asks who is out', () => {
  const q = parse('petrol 2000 33/33/33', ctx({ users: FOUR })).questions[0];
  assert.equal(q.need, 3);
  assert.equal(q.message, "Split between 3 · who's out?");
  assert.equal(q.selected.length, 4);
});

test('split questions: unequal ratio → AAI splits equally', () => {
  const q = parse('petrol 2000 60/40', ctx()).questions[0];
  assert.equal(q.need, null);
  assert.equal(q.message, "AAI splits equally · pick who's in");
  assert.deepEqual(q.selected, ALL);
});

test('names win over ratio — no question', () => {
  assert.deepEqual(parse('petrol 2000 50-50 with ravi meera', ctx()).questions, []);
});

test('unknown person → "Priya isn\'t in this room · pick"', () => {
  for (const s of ['paid to priya 200', 'dinner 200 with priya', 'dinner 200 only priya', 'dinner 200 paid by priya']) {
    const q = parse(s, ctx()).questions.find(x => x.kind === 'unknownPerson');
    assert.ok(q, s);
    assert.equal(q.message, "Priya isn't in this room · pick");
    assert.equal(q.name, 'Priya');
  }
});

test('two members match → pickPerson', () => {
  const users = [USERS[0], { id: 'a', name: 'Rahul' }, { id: 'b', name: 'Rahim' }];
  const q = parse('dinner 450 with rah', ctx({ users })).questions[0];
  assert.equal(q.kind, 'pickPerson');
  assert.deepEqual(q.candidates.sort(), ['a', 'b']);
});

test('ambiguous payer → pickPerson', () => {
  const users = [USERS[0], { id: 'a', name: 'Rahul' }, { id: 'b', name: 'Rahim' }];
  const q = parse('rah paid 450 dinner', ctx({ users })).questions[0];
  assert.equal(q.kind, 'pickPerson');
});

test('"me" never matches Meera', () => {
  assert.deepEqual(parse('dinner 450 with me', ctx()).splitAmong, [ME]);
});

test('"all" is not read as a name', () => {
  assert.equal(parse('dinner 450 all', ctx({ users: [USERS[0], { id: 'x', name: 'Allen' }] })).splitAmong.length, 2);
});

test('a date like 2/10 is not read as a ratio, 60/40 is not read as a date', () => {
  const a = parse('lunch 200 2/10', ctx());
  assert.equal(a.ratio, null);
  assert.equal(a.date, '2026-10-02');
  const b = parse('petrol 2000 60/40', ctx());
  assert.equal(b.dateGiven, false);
});

test('future dates are pushed back (never in the future)', () => {
  assert.equal(parse('chai 20 25 dec', ctx()).date, '2025-12-25');
  assert.equal(parse('chai 20 sunday', ctx()).date, '2026-09-27');
  assert.equal(parse('chai 20 4 oct', ctx()).date, '2025-10-04');
});

// ── several expenses / bills ──
test('many: commas', () => {
  const r = parse('chai 20, auto 50, milk 68', ctx());
  assert.equal(r.type, 'many');
  assert.equal(r.count, 3);
  assert.equal(r.total, 138);
  assert.deepEqual(r.expenses.map(e => e.amount), [20, 50, 68]);
  assert.deepEqual(r.expenses.map(e => e.description), ['Chai', 'Auto', 'Milk']);
  assert.equal(r.billAlt.lines.length, 3);
});
test('many: newlines', () => assert.equal(parse('chai 20\nauto 50', ctx()).type, 'many'));
test('many: "and" with own amounts', () => assert.equal(parse('chai 20 and auto 50', ctx()).count, 2));
test('many: "aur"', () => assert.equal(parse('chai 20 aur auto 50', ctx()).count, 2));
test('many: each part keeps its own people/date', () => {
  const r = parse('chai 20 with ravi, auto 50 kal', ctx());
  assert.deepEqual(r.expenses[0].splitAmong, [ME, RAVI]);
  assert.equal(r.expenses[1].date, '2026-10-02');
});
test('1,200 is one number, not two expenses', () => {
  const r = parse('rent 1,200', ctx());
  assert.equal(r.type, 'expense');
  assert.equal(r.amount, 1200);
});
test('"with ravi and meera" is one expense, not two', () => {
  assert.equal(parse('dinner 450 with ravi and meera', ctx()).type, 'expense');
});
test('names list with a comma stays one expense', () => {
  const r = parse('dinner 450 with ravi, meera', ctx());
  assert.equal(r.type, 'expense');
  assert.deepEqual(r.splitAmong, ALL);
});

test('bill: dmart example', () => {
  const r = parse('dmart 1240: atta 320 all, chips 90 me+ravi, rest all', ctx());
  assert.equal(r.type, 'bill');
  assert.equal(r.merchant, 'Dmart');
  assert.equal(r.total, 1240);
  assert.equal(r.lines.length, 2);
  assert.deepEqual(r.lines[0], { description: 'Atta', amount: 320, categoryId: 'cat-1', splitAmong: ALL, splitNote: 'all' });
  assert.deepEqual(r.lines[1].splitAmong, [ME, RAVI]);
  assert.equal(r.rest.amount, 830);
  assert.deepEqual(r.rest.splitAmong, ALL);
  assert.equal(r.mismatch, false);
});
test('bill: payer and date in the head', () => {
  const r = parse('zepto 500 kal ravi paid: milk 60, bread 40, rest all', ctx());
  assert.equal(r.type, 'bill');
  assert.equal(r.paidBy, RAVI);
  assert.equal(r.date, '2026-10-02');
  assert.equal(r.rest.amount, 400);
});
test('bill: lines without people default to everyone', () => {
  const r = parse('dmart 300: atta 100, dal 100, rest all', ctx());
  assert.deepEqual(r.lines.map(l => l.splitAmong), [ALL, ALL]);
});
test('bill: items add up exactly → no rest, no mismatch', () => {
  const r = parse('dmart 200: atta 120, dal 80', ctx());
  assert.equal(r.mismatch, false);
  assert.equal(r.rest, null);
});
test('bill: items over the total → mismatch', () => {
  const r = parse('dmart 100: atta 120, rest all', ctx());
  assert.equal(r.mismatch, true);
  assert.equal(r.rest.amount, 0);
});
test('bill: items under the total and no "rest" → mismatch', () => {
  assert.equal(parse('dmart 500: atta 120', ctx()).mismatch, true);
});
test('bill: "baaki" works like rest', () => {
  assert.equal(parse('dmart 500: atta 120, baaki all', ctx()).rest.amount, 380);
});
test('bill: unknown person on a line asks', () => {
  const r = parse('dmart 500: atta 120 with priya, rest all', ctx());
  assert.ok(r.questions.some(q => q.kind === 'unknownPerson'));
});

// ── commands ──
const CMD = [
  ['undo', { type: 'command', cmd: 'undo' }],
  ['Undo', { cmd: 'undo' }],
  ['undo last', { cmd: 'undo' }],
  ['change last to 500', { cmd: 'change', amount: 500 }],
  ['change last to ₹500', { cmd: 'change', amount: 500 }],
  ['change last 500', { cmd: 'change', amount: 500 }],
  ['edit last to 1,250', { cmd: 'change', amount: 1250 }],
  ['change last to 4.5k', { cmd: 'change', amount: 4500 }],
  ['remove ravi from dinner', { cmd: 'remove', person: { id: RAVI }, description: 'dinner' }],
  ['remove meera from petrol trip', { cmd: 'remove', person: { id: MEERA }, description: 'petrol trip' }],
  ['remove priya from dinner', { cmd: 'remove', person: { unknown: true, name: 'priya' } }],
  ['remind ravi', { cmd: 'remind', person: { id: RAVI } }],
  ['remind', { cmd: 'remind', person: null }],
  ['settle all', { cmd: 'settle' }],
  ['settle karo', { cmd: 'settle' }],
  ['settle up', { cmd: 'settle' }],
  ['kitna dena hai', { cmd: 'balance' }],
  ['kitna dena hai?', { cmd: 'balance' }],
  ['how much do i owe', { cmd: 'balance' }],
  ['balance', { cmd: 'balance' }],
  ['food this month', { cmd: 'spend', period: 'this', categoryId: 'cat-4' }],
  ['groceries last month', { cmd: 'spend', period: 'last', categoryId: 'cat-1' }],
  ['this month', { cmd: 'spend', period: 'this', categoryId: null }],
  ['biggest spend', { cmd: 'spend', period: 'biggest', categoryId: null }],
  ['biggest food spend', { cmd: 'spend', period: 'biggest', categoryId: 'cat-4' }],
  ['vs last month', { cmd: 'spend', period: 'compare' }],
  ['transport this month', { cmd: 'spend', period: 'this', categoryId: 'cat-5' }],
];
for (const [input, want] of CMD) test(`command: ${input}`, () => check(input, { type: 'command', ...want }));

test('"remind" with an ambiguous name asks', () => {
  const users = [USERS[0], { id: 'a', name: 'Rahul' }, { id: 'b', name: 'Rahim' }];
  const r = parse('remind rah', ctx({ users }));
  assert.deepEqual(r.person.candidates.sort(), ['a', 'b']);
});
test('a sentence with an amount is never a spend question', () => assert.equal(parse('dinner 450 this month', ctx()).type, 'expense'));

// ── empty / unknown ──
test('empty', () => { assert.equal(parse('', ctx()).type, 'empty'); assert.equal(parse('   ', ctx()).type, 'empty'); assert.equal(parse(undefined, ctx()).type, 'empty'); });
test('hello → unknown', () => { const r = parse('hello', ctx()); assert.equal(r.type, 'unknown'); assert.equal(r.text, 'hello'); });
test('words without amount → unknown with description', () => assert.equal(parse('dinner with ravi', ctx()).type, 'unknown'));
test('zero amount is not an amount', () => assert.equal(parse('dinner 0', ctx()).type, 'unknown'));

// ── learned categories are used ──
test('learned category beats the word list', () => {
  const expenses = Array.from({ length: 6 }, (_, i) => ({
    id: `l${i}`, description: 'Samosa', categoryId: 'cat-7', date: '2026-09-25', createdAt: '2026-09-25T10:00:00Z',
  }));
  assert.equal(parse('samosa 60', ctx({ expenses })).categoryId, 'cat-7');
});

test('parse never throws on odd input', () => {
  for (const s of ['₹', '+++', '50/', '/50', ':', 'a:b', ',,,', '1/1/1', '000', 'with', 'not', 'paid by', 'remove from', '99999999999999999999', 'ravi paid', ' , and , ']) {
    assert.doesNotThrow(() => parse(s, ctx()), s);
  }
});

test('NOW is Saturday 3 Oct 2026 (the fixtures assume it)', () => assert.equal(NOW.getDay(), 6));
