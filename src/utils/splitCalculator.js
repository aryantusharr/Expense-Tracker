/**
 * SplitEase — Expense Split Calculator
 * Handles balance calculation for n users with any subset splits.
 */

/**
 * Calculate per-user balances from expenses.
 * Returns an object keyed by userId with { paid, owed, balance }.
 *
 * @param {Array} expenses - List of expenses
 * @param {Array} users - List of user objects
 * @returns {Object} Balances keyed by userId
 */
export function calculateBalances(expenses, users) {
  const balances = {};

  // Initialize all users
  users.forEach(user => {
    balances[user.id] = {
      userId: user.id,
      name: user.name,
      color: user.color,
      paid: 0,
      owed: 0,
      balance: 0,
    };
  });

  expenses.forEach(expense => {
    const amount = parseFloat(expense.amount) || 0;
    const paidBy = expense.paidBy;
    const splitAmong = expense.splitAmong || [];

    if (splitAmong.length === 0 || amount === 0) return;

    // Credit the payer
    if (balances[paidBy]) {
      balances[paidBy].paid += amount;
    }

    // Calculate each person's share (equal split)
    const perPersonShare = amount / splitAmong.length;

    // Handle rounding: give remainder to the last person
    const roundedShare = Math.floor(perPersonShare * 100) / 100;
    const remainder = amount - (roundedShare * splitAmong.length);

    splitAmong.forEach((userId, index) => {
      if (balances[userId]) {
        const share = index === splitAmong.length - 1
          ? roundedShare + remainder
          : roundedShare;
        balances[userId].owed += share;
      }
    });
  });

  // Calculate net balance
  Object.keys(balances).forEach(userId => {
    const b = balances[userId];
    b.paid = Math.round(b.paid);
    b.owed = Math.round(b.owed);
    b.balance = Math.round(b.paid - b.owed);
  });

  return balances;
}

/**
 * Get total expenses
 */
export function getTotalExpenses(expenses) {
  return expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
}

/**
 * Get expenses grouped by category
 */
export function getExpensesByCategory(expenses, categories) {
  const grouped = {};
  categories.forEach(cat => {
    grouped[cat.id] = { ...cat, total: 0, count: 0 };
  });

  expenses.forEach(expense => {
    const catId = expense.categoryId || 'cat-9';
    if (!grouped[catId]) {
      grouped[catId] = { id: catId, name: 'Other', icon: '📦', total: 0, count: 0 };
    }
    grouped[catId].total += parseFloat(expense.amount) || 0;
    grouped[catId].count += 1;
  });

  return Object.values(grouped).filter(c => c.count > 0).sort((a, b) => b.total - a.total);
}

/**
 * Get monthly expense totals for charting
 */
export function getMonthlyTotals(expenses) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m < 0) { m += 12; y -= 1; }
    months.push({ month: m, year: y, total: 0, label: '' });
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  months.forEach(m => { m.label = monthNames[m.month]; });

  expenses.forEach(expense => {
    const date = new Date(expense.date);
    const expMonth = date.getMonth();
    const expYear = date.getFullYear();

    const match = months.find(m => m.month === expMonth && m.year === expYear);
    if (match) {
      match.total += parseFloat(expense.amount) || 0;
    }
  });

  return months;
}
