import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ctx, USERS, NOW, exp } from './fixtures.js';
import { GREETINGS, greetingContext, pickGreeting } from './greetings.js';
import { weekGrid, stripDays, tier, memberStats, heatLine } from './heatmap.js';
import { quickUsuals, repeatBills, lastLabel } from './usuals.js';
import { respond, billTotals, syncRest, dayLabel, billFromPast } from './chatModel.js';

const ME = 'u-me', RAVI = 'u-ravi', MEERA = 'u-meera';
const sess = (over = {}) => ({ ...ctx(), firstCard: true, date: null, ...over });

// ── greetings ──
test('every greeting context has at least 5 lines', () => {
  for (const [k, bank] of Object.entries(GREETINGS)) assert.ok(bank.length >= 5, `${k}: ${bank.length}`);
});

test('greeting context: late night, no-log, month-end, morning, day', () => {
  const at = (h, d = 15) => new Date(2026, 9, d, h, 0, 0);
  const e = [exp({ date: '2026-10-14' })];
  assert.equal(greetingContext({ now: at(1), expenses: e }).key, 'lateNight');
  assert.equal(greetingContext({ now: at(9), expenses: e }).key, 'morning');
  assert.equal(greetingContext({ now: at(15), expenses: e }).key, 'day');
  assert.deepEqual(greetingContext({ now: at(15), expenses: [exp({ date: '2026-10-11' })] }), { key: 'noLog', n: 4 });
  assert.equal(greetingContext({ now: at(15, 30), expenses: [exp({ date: '2026-10-30' })] }).key, 'monthEnd');
  assert.equal(greetingContext({ now: at(15), expenses: e, lastSeen: at(15).getTime() - 5 * 86400000 }).key, 'comingBack');
});

test('pickGreeting fills tokens and never repeats the last line', () => {
  const now = new Date(2026, 9, 4, 13, 0, 0);
  const g = pickGreeting({ key: 'lateNight' }, { now, name: 'Asha', rand: () => 0 });
  assert.equal(g.line1, 'Raat ke 1 baje?');
  assert.equal(g.line2, 'Kya mangaya, Asha?');
  const again = pickGreeting({ key: 'lateNight' }, { now, name: 'Asha', rand: () => 0, lastIdx: g.idx });
  assert.notEqual(again.idx, g.idx);
  const noName = pickGreeting({ key: 'lateNight' }, { now, name: '', rand: () => 0 });
  assert.equal(noName.line2, 'Kya mangaya?');
  assert.match(pickGreeting({ key: 'noLog', n: 3 }, { now, name: 'Asha', rand: () => 0 }).line1, /^3 din/);
});

// ── heatmap ──
test('weekGrid: 5 week columns of 7, Sun→Sat, nothing after today', () => {
  const sunday = new Date(2026, 9, 4, 12);                       // Sun 4 Oct 2026
  const g = weekGrid(sunday);
  assert.equal(g.length, 5);
  assert.ok(g.every(c => c.length === 7));
  assert.equal(g[4][0], '2026-10-04');
  assert.equal(g[4][1], null);
  assert.equal(g[3][6], '2026-10-03');
  const sat = weekGrid(new Date(2026, 9, 3, 12));                // Sat 3 Oct — today closes the last column, like the board
  assert.equal(sat[4][6], '2026-10-03');
  assert.equal(sat[4][0], '2026-09-27');
  const wed = weekGrid(new Date(2026, 9, 7, 12));                // Wed 7 Oct
  assert.equal(wed[4][3], '2026-10-07');
  assert.equal(wed[4][4], null);
  assert.equal(stripDays(sunday, 14).length, 14);
  assert.equal(stripDays(sunday, 14)[13], '2026-10-04');
});

test('tier + memberStats + heatLine', () => {
  assert.deepEqual([0, 1, 2, 4, 7].map(tier), [0, 1, 2, 3, 4]);
  const now = new Date(2026, 9, 4, 12);
  const days = {};
  for (let i = 0; i < 9; i++) days[`2026-09-${String(26 + i > 30 ? 26 + i - 30 : 26 + i).padStart(2, '0')}`] = 1;
  const opens = { [RAVI]: { '2026-09-26': 1, '2026-09-27': 1, '2026-09-28': 1, '2026-09-29': 1, '2026-09-30': 1, '2026-10-01': 1, '2026-10-02': 1, '2026-10-03': 1, '2026-10-04': 1 } };
  const stats = memberStats(opens, now);
  assert.equal(stats[RAVI].streak, 9);
  assert.equal(stats[RAVI].opened, 9);
  const members = USERS;
  assert.equal(heatLine({ stats: {}, members, meId: ME, now }), 'Fresh room. Zero streaks. Very peaceful. Won\'t last.');
  assert.match(heatLine({ stats, opens, members, meId: ME, now }), /Ravi's opened the app 9 days straight/);
  const gone = memberStats({ [MEERA]: { '2026-09-29': 1 }, [ME]: { '2026-10-04': 3 } }, now);
  assert.match(heatLine({ stats: gone, opens: {}, members, meId: ME, now }), /Meera's been gone 5 days/);
});

// ── usuals ──
test('quickUsuals needs 3 similar entries; repeatBills keeps one per name', () => {
  const three = [exp({ description: 'Cig', amount: 20 }), exp({ description: 'cig', amount: 20 }), exp({ description: 'Cig', amount: 20 }), exp({ description: 'Pizza', amount: 500 })];
  const u = quickUsuals(three, { users: USERS, me: ME });
  assert.equal(u.length, 1);
  assert.equal(u[0].amount, 20);
  assert.equal(u[0].split, 'All 3');
  assert.deepEqual(quickUsuals(three.slice(0, 2), { users: USERS, me: ME }), []);

  const line = (g, name, date, amt = 100) => exp({ groupId: g, groupName: name, isItemised: true, date, amount: amt, createdAt: `${date}T10:00:00.000Z` });
  const bills = repeatBills([line('g1', 'Dmart', '2026-09-02'), line('g1', 'Dmart', '2026-09-02'), line('g2', 'Dmart', '2026-09-20'), line('g2', 'Dmart', '2026-09-20'), line('g3', 'Solo', '2026-10-01')], { now: NOW });
  assert.equal(bills.length, 1);
  assert.equal(bills[0].groupId, 'g2');
  assert.equal(bills[0].total, 200);
  assert.equal(lastLabel('2026-10-01', NOW), 'THU');
  assert.equal(lastLabel('2026-09-26', NOW), 'LAST SAT');
  assert.equal(lastLabel('2026-09-02', NOW), '2 SEP');
});

// ── chat model ──
test('"cig 20" → one quick card, whole room, no reply', () => {
  const r = respond('cig 20', sess());
  assert.equal(r.card.kind, 'quick');
  assert.equal(r.card.draft.amount, 20);
  assert.equal(r.card.draft.paidBy, ME);
  assert.equal(r.card.draft.splitAmong.length, 3);
  assert.deepEqual(r.card.dots, ['all']);          // first card: every value is dotted
  assert.equal(r.reply, null);
  assert.ok(r.steps[0].text.startsWith('parsing "cig 20"'));
  const second = respond('cig 20', sess({ firstCard: false }));
  assert.ok(!second.card.dots.includes('all'));    // later cards: only what AAI is unsure about
});

test('dots after the first card = unsure values only', () => {
  const r = respond('xyzzy 55', sess({ firstCard: false }));
  assert.ok(r.card.dots.includes('category'));
  assert.ok(!r.card.dots.includes('amount'));
});

test('"chai 40, samosa 30, auto 120" → ONE untitled bill, rows split all, dots on name', () => {
  const r = respond('chai 40, samosa 30, auto 120', sess({ firstCard: false }));
  assert.equal(r.card.kind, 'bill');
  const b = r.card.bill;
  assert.equal(b.name, 'Untitled bill');
  assert.equal(b.items.length, 3);
  assert.equal(b.total, 190);
  assert.equal(billTotals(b).total, 190);
  assert.match(r.reply, /Three things, ₹190/);
  assert.ok(r.card.dots.includes('name'));
});

test('typed bill with a rest line: "dmart 1240: atta 320, chips 90 me+ravi, maggi 56, rest all"', () => {
  const r = respond('dmart 1240: atta 320, chips 90 me+ravi, maggi 56, rest all', sess());
  const b = r.card.bill;
  assert.equal(b.name, 'Dmart');
  assert.equal(b.items.length, 4);
  const rest = b.items.find(i => i.rest);
  assert.equal(rest.amount, 774);
  assert.deepEqual(b.items[1].splitAmong, [ME, RAVI]);
  assert.match(r.reply, /₹774 left over — split 3 ways/);
  assert.ok(r.steps.some(s => /Meera is out of this one/.test(s.text)));
  assert.ok(r.steps.some(s => /rest all/.test(s.text)));
});

test('a typed total with fewer items makes "Rest of the bill" even without "rest"', () => {
  const r = respond('dmart 500: atta 100, chips 50', sess());
  const rest = r.card.bill.items.find(i => i.rest);
  assert.equal(rest.amount, 350);
  assert.equal(rest.splitAmong.length, 3);
});

test('rest follows edits; items over the total flag a mismatch', () => {
  let b = respond('dmart 500: atta 100, chips 50', sess()).card.bill;
  b = syncRest({ ...b, items: b.items.map(i => (i.name === 'Atta' ? { ...i, amount: 200 } : i)) });
  assert.equal(b.items.find(i => i.rest).amount, 250);
  const over = syncRest({ ...b, items: b.items.map(i => (i.name === 'Atta' ? { ...i, amount: 900 } : i)) });
  assert.ok(billTotals(over).over > 0);
});

test('commands get a plain reply and no card; no-amount text gets an amount question', () => {
  const c = respond('undo', sess());
  assert.equal(c.card, null);
  assert.match(c.reply, /only add expenses/);
  const u = respond('something odd', sess());
  assert.equal(u.card.kind, 'quick');
  assert.equal(u.card.draft.amount, 0);
  assert.ok(u.card.dots.includes('amount') || u.card.dots.includes('all'));
});

test('personal rooms: no payer or split rows needed', () => {
  const r = respond('lunch 250', sess({ isPersonal: true, users: [USERS[0]] }));
  assert.equal(r.card.kind, 'quick');
  assert.equal(r.card.draft.splitAmong.length, 1);
});

test('dayLabel', () => {
  assert.equal(dayLabel('2026-10-03', NOW), 'Today');
  assert.equal(dayLabel('2026-10-02', NOW), 'Yesterday · 2 Oct');
  assert.equal(dayLabel('2026-09-20', NOW), '20 Sep');
});

test('same-bill-again copies a past bill as a fresh card dated today', () => {
  const line = (n, amt, cat) => exp({ groupId: 'g9', groupName: 'Blinkit weekly', isItemised: true, description: n, amount: amt, categoryId: cat, date: '2026-09-26', splitAmong: [ME, RAVI] });
  const [g] = repeatBills([line('Milk', 68, 'cat-1'), line('Eggs', 96, 'cat-1')], { now: NOW });
  const r = billFromPast(g, sess({ now: NOW }));
  assert.equal(r.card.kind, 'bill');
  assert.equal(r.card.bill.name, 'Blinkit weekly');
  assert.equal(r.card.bill.date, '2026-10-03');
  assert.equal(r.card.bill.total, 164);
  assert.deepEqual(r.card.bill.items[0].splitAmong, [ME, RAVI]);
  assert.match(r.reply, /Same \*\*Blinkit weekly\*\* bill — 2 items, ₹164/);
});
