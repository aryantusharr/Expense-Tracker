import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeCategories } from './dedupeCategories.js';

const c = (id, name) => ({ id, name, icon: 'line:x' });

test('dedupeCategories: keeps the first of repeated ids, order unchanged', () => {
  const list = [c('a', 'Food'), c('cat-taxes', 'Taxes & charges'), c('b', 'Rent'), c('cat-taxes', 'Taxes & charges'), c('cat-taxes', 'Taxes & charges')];
  assert.deepEqual(dedupeCategories(list).map(x => x.id), ['a', 'cat-taxes', 'b']);
});

test('dedupeCategories: returns the same array when nothing repeats (stable reference)', () => {
  const list = [c('a', 'Food'), c('b', 'Rent')];
  assert.equal(dedupeCategories(list), list);
});

test('dedupeCategories: tolerates missing or bad input', () => {
  assert.deepEqual(dedupeCategories(undefined), []);
  assert.deepEqual(dedupeCategories([null, c('a', 'Food')]), [c('a', 'Food')]);
});

test('dedupeCategories: same name with different ids is NOT merged (expenses point at ids)', () => {
  const list = [c('a', 'Taxes & charges'), c('b', 'Taxes & charges')];
  assert.equal(dedupeCategories(list).length, 2);
});
