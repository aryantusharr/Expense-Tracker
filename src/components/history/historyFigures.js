// Pure figures for the month card (kept apart from historyData.js so Node's test runner can import them).
import { fmt } from '../dashboard/dashboardData.js';

/**
 * The two figures on the right of a month card (board "Bug 4 · month card B").
 * Shared: PAID (coloured like the net would be — teal if you're ahead, pink if behind) and SHARE.
 * Personal: BUDGET and LEFT (OVER when past it). Null when there is nothing to show.
 */
export function monthPair(mo, { isPersonal, budget }) {
  if (isPersonal) {
    if (mo.left == null) return null;
    const over = mo.left < 0;
    return [
      { label: 'BUDGET', value: `₹${fmt(budget)}` },
      { label: over ? 'OVER' : 'LEFT', value: `₹${fmt(Math.abs(mo.left))}`, color: over ? 'var(--se-pink-2)' : 'var(--se-teal-2)' },
    ];
  }
  if (mo.paid == null || mo.share == null) return null;
  return [
    { label: 'PAID', value: `₹${fmt(mo.paid)}`, color: mo.paid - mo.share >= 0 ? 'var(--se-teal-2)' : 'var(--se-pink-2)' },
    { label: 'SHARE', value: `₹${fmt(mo.share)}` },
  ];
}
