/**
 * SplitEase — Settlement Engine
 * Optimized algorithm to minimize the number of transactions.
 * Works for any number of users (n).
 */

/**
 * Calculate minimum transactions to settle all debts.
 * Uses greedy algorithm: match largest debtor with largest creditor.
 *
 * @param {Object} balances - Balance object from splitCalculator
 * @returns {Array} List of settlement objects { from, to, amount }
 */
export function calculateSettlements(balances) {
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = []; // People who are owed money
  const debtors = [];   // People who owe money

  Object.values(balances).forEach(b => {
    if (b.balance > 0.01) {
      creditors.push({ ...b, remaining: b.balance });
    } else if (b.balance < -0.01) {
      debtors.push({ ...b, remaining: Math.abs(b.balance) });
    }
  });

  // Sort: largest amounts first for optimal matching
  creditors.sort((a, b) => b.remaining - a.remaining);
  debtors.sort((a, b) => b.remaining - a.remaining);

  const settlements = [];

  let i = 0; // creditor index
  let j = 0; // debtor index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount = Math.min(creditor.remaining, debtor.remaining);

    if (amount > 0.01) {
      settlements.push({
        from: {
          id: debtor.userId,
          name: debtor.name,
          color: debtor.color,
        },
        to: {
          id: creditor.userId,
          name: creditor.name,
          color: creditor.color,
        },
        amount: Math.round(amount),
      });
    }

    creditor.remaining -= amount;
    debtor.remaining -= amount;

    // Move to next if current is settled
    if (creditor.remaining < 0.01) i++;
    if (debtor.remaining < 0.01) j++;
  }

  return settlements;
}

/**
 * Format a settlement for display
 */
export function formatSettlement(settlement) {
  return `${settlement.from.name} pays ${settlement.to.name} ₹${settlement.amount.toLocaleString('en-IN')}`;
}

/**
 * Check if all balances are settled
 */
export function isAllSettled(balances) {
  return Object.values(balances).every(b => Math.abs(b.balance) < 0.01);
}
