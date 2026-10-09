import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descriptionLists } from './addHelpers.js';

const e = (description, createdAt, extra = {}) => ({ description, createdAt, ...extra });

test('descriptionLists: most used = all time by count, recent = latest, case-insensitive, synced copies skipped', () => {
  const list = [
    e('Chai', '2024-01-01'), e('chai', '2024-02-01'), e('Chai', '2024-03-01'),
    e('Rent', '2024-01-05'), e('Cab', '2026-10-01'), e('Cab', '2026-10-08', { isSynced: true }),
    e('Test snack', '2026-10-09'), e('', '2026-10-09'),
  ];
  const r = descriptionLists(list, { personal: true });
  assert.equal(r.used[0], 'Chai');
  assert.equal(r.recent[0], 'Test snack');
  assert.equal(r.recent[1], 'Cab');
  assert.equal(r.used.filter(x => x.toLowerCase() === 'chai').length, 1);
  const it = descriptionLists([e('Atta', '2026-10-01', { isItemised: true }), e('Dinner', '2026-10-02')], { itemised: true });
  assert.deepEqual(it.used, ['Atta']);
});
