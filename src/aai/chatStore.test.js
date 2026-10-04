import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCK_MS, endedAt, isEditable, pickResume, chatTitle, chatMeta, groupChats, serialiseMessages } from './chatStore.js';
import { errorReply, unclearTyped, saveDown, ERROR_TYPES } from './errors.js';

const T0 = new Date(2026, 9, 4, 12, 0, 0).getTime();
const quick = (description, amount, status = 'saved') => ({ id: `m-${description}`, role: 'ai', steps: [{ text: 'x' }, { text: 'y' }], reply: null, done: true, card: { kind: 'quick', draft: { description, amount }, dots: [], status } });
const bill = (name, items, status = 'saved') => ({ id: `b-${name}`, role: 'ai', steps: [], reply: 'r', done: true, card: { kind: 'bill', dots: [], status, bill: { name, total: items.reduce((s, x) => s + x, 0), totalTyped: false, items: items.map((a, i) => ({ id: `i${i}`, name: `it${i}`, amount: a })) } } });
const me = text => ({ id: `u-${text}`, role: 'me', text });
const chat = (id, messages, over = {}) => ({ id, createdAt: T0, updatedAt: T0, closedAt: null, messages, ...over });

test('editable while open and for 1 minute after it is closed, read-only after', () => {
  const c = chat('a', [me('x')], { closedAt: T0 });
  assert.equal(isEditable(c, T0 + LOCK_MS - 1), true);
  assert.equal(isEditable(c, T0 + LOCK_MS), false);
  assert.equal(isEditable(c, T0 + 10 * LOCK_MS, 'a'), true);               // the chat that is open right now
  assert.equal(endedAt(chat('b', [], { updatedAt: T0 + 5 })), T0 + 5);     // never closed cleanly → last activity
});

test('reopening within a minute continues the newest chat; later starts fresh', () => {
  const a = chat('a', [me('x')], { closedAt: T0 - 90_000, updatedAt: T0 - 95_000 });
  const b = chat('b', [me('y')], { closedAt: T0 - 20_000, updatedAt: T0 - 25_000 });
  const empty = chat('c', [], { closedAt: T0 - 5_000 });
  assert.equal(pickResume([a, b, empty], T0).id, 'b');
  assert.equal(pickResume([a, empty], T0), null);
});

test('titles come from what the cards are about', () => {
  assert.equal(chatTitle([me('cig 20'), quick('Cig', 20), quick('Chai', 40), quick('Auto', 120)]), 'Cig, Chai, Auto');
  assert.equal(chatTitle([quick('Cig', 20), quick('cig', 20)]), 'Cig');
  assert.equal(chatTitle([bill('Blinkit bill', [100, 200])]), 'Blinkit bill');
  assert.equal(chatTitle([bill('Untitled bill', [100])]), 'Bill');
  assert.equal(chatTitle([me('hello there')]), 'Hello there');
  assert.equal(chatTitle([]), 'New chat');
});

test('meta line: added count + total, bill items, what is still open', () => {
  assert.equal(chatMeta([quick('Cig', 20), quick('Chai', 40), quick('Auto', 120)]), '3 ADDED · ₹180');
  assert.equal(chatMeta([bill('Dmart', [600, 640])]), '2 ITEMS · ₹1,240');
  assert.equal(chatMeta([quick('Cig', 20), quick('Chai', 40, 'open')]), '1 ADDED · ₹20 · 1 TO ADD');
  assert.equal(chatMeta([quick('Chai', 40, 'open')], { locked: true }), '1 NOT ADDED');
  assert.equal(chatMeta([me('hi')]), 'NOTHING ADDED');
});

test('sidebar groups: Active (open or closed < 1 min) · Earlier today · Yesterday · Older', () => {
  const now = T0 + 5 * 60_000;
  const active = chat('open', [me('a')], { updatedAt: now - 1000 });
  const justClosed = chat('just', [me('b')], { closedAt: now - 30_000, updatedAt: now - 40_000 });
  const today = chat('today', [me('c')], { closedAt: now - 3_600_000 / 2, updatedAt: now - 3_600_000 / 2 });
  const yest = chat('yest', [me('d')], { closedAt: now - 86400000, updatedAt: now - 86400000 });
  const old = chat('old', [me('e')], { closedAt: now - 5 * 86400000, updatedAt: now - 5 * 86400000 });
  const empty = chat('empty', []);
  const g = groupChats([old, yest, today, justClosed, active, empty], now, 'open');
  assert.deepEqual(g.map(x => x.key), ['active', 'today', 'yesterday', 'older']);
  assert.deepEqual(g[0].items.map(c => c.id), ['open', 'just']);
  assert.equal(g[1].label, 'EARLIER TODAY · READ ONLY');
});

test('stored messages: thinking finished, a card mid-save goes back to editable', () => {
  const m = { ...quick('Cig', 20, 'saving'), shown: 0, done: false };
  const [out] = serialiseMessages([m]);
  assert.equal(out.done, true);
  assert.equal(out.shown, 2);
  assert.equal(out.card.status, 'open');
  assert.equal(serialiseMessages([me('x')])[0].text, 'x');
});

test('error replies: every type has a stamp, 2 actions and a details line; typed + save variants', () => {
  for (const t of ERROR_TYPES) {
    const e = errorReply(t);
    assert.ok(e.stamp && e.title && e.body && e.details, t);
    assert.equal(e.actions.length, 2, t);
    assert.equal(e.actions.filter(a => a.primary).length, 1, t);
  }
  assert.deepEqual(['unclear', 'limit', 'offline', 'down', 'wait', 'slow', 'notbill'].map(t => errorReply(t).tone), ['violet', 'amber', 'grey', 'pink', 'amber', 'amber', 'pink']);
  assert.equal(unclearTyped('hello').text, 'hello');
  assert.equal(saveDown({ code: 'unavailable' }).details, 'SAVE · UNAVAILABLE');
  assert.equal(saveDown(new Error('boom')).type, 'down');
});
