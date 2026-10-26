import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthPair } from './historyFigures.js';

test('shared room: PAID takes the colour the net would have (teal when ahead, pink when behind)', () => {
  const behind = monthPair({ paid: 5940, share: 7120 }, { isPersonal: false, budget: 0 });
  assert.deepEqual(behind.map(p => p.label), ['PAID', 'SHARE']);
  assert.equal(behind[0].value, '₹5,940');
  assert.equal(behind[0].color, 'var(--se-pink-2)');
  assert.equal(behind[1].color, undefined);
  const ahead = monthPair({ paid: 9000, share: 7120 }, { isPersonal: false, budget: 0 });
  assert.equal(ahead[0].color, 'var(--se-teal-2)');
});

test('shared room: nothing to show until you pick who you are', () => {
  assert.equal(monthPair({ paid: null, share: null }, { isPersonal: false, budget: 0 }), null);
});

test('personal room: BUDGET and LEFT, or OVER when past the budget', () => {
  const left = monthPair({ left: 1580 }, { isPersonal: true, budget: 8000 });
  assert.deepEqual(left.map(p => [p.label, p.value]), [['BUDGET', '₹8,000'], ['LEFT', '₹1,580']]);
  const over = monthPair({ left: -300 }, { isPersonal: true, budget: 8000 });
  assert.equal(over[1].label, 'OVER');
  assert.equal(over[1].value, '₹300');
  assert.equal(over[1].color, 'var(--se-pink-2)');
  assert.equal(monthPair({ left: null }, { isPersonal: true, budget: 0 }), null);
});
