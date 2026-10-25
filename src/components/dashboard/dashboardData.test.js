import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthWindow, yearWindow } from './dashboardData.js';

const e = (date, amount) => ({ date, amount });
const NOW = new Date(2026, 9, 26); // 26 Oct 2026

test('monthWindow: default keeps the last 6 months (PDF and other callers rely on this)', () => {
  const { months } = monthWindow([e('2025-01-10', 100), e('2026-10-02', 50)], NOW);
  assert.equal(months.length, 6);
  assert.equal(months[months.length - 1].key, '2026-10');
});

test('monthWindow { all }: every month from the first expense to now, empty months included', () => {
  const { months, firstKey } = monthWindow([e('2025-01-10', 100), e('2026-10-02', 50)], NOW, { all: true });
  assert.equal(firstKey, '2025-01');
  assert.equal(months.length, 22);               // Jan 2025 … Oct 2026
  assert.equal(months[0].key, '2025-01');
  assert.equal(months[0].total, 100);
  assert.equal(months[5].total, 0);
  assert.equal(months[21].total, 50);
});

test('monthWindow { all }: a young room still shows at most what it has, never fewer than the usual window logic', () => {
  const { months } = monthWindow([e('2026-09-03', 10)], NOW, { all: true });
  assert.deepEqual(months.map(m => m.key), ['2026-09', '2026-10']);
});

test('yearWindow: sums months into years, oldest first', () => {
  const { months } = monthWindow([e('2024-12-31', 5), e('2025-03-01', 100), e('2025-04-01', 20), e('2026-10-02', 50)], NOW, { all: true });
  const years = yearWindow(months);
  assert.deepEqual(years.map(y => [y.key, y.total]), [['2024', 5], ['2025', 120], ['2026', 50]]);
});
