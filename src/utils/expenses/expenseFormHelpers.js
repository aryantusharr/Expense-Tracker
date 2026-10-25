/**
 * Adjust a numeric amount string by a delta, clamping to 0.
 * @param {string} current - current amount string
 * @param {number} delta - amount to add (negative to subtract)
 * @returns {string}
 */
export function adjustAmount(current, delta) {
  const newVal = Math.max(0, (parseFloat(current) || 0) + delta);
  return String(newVal);
}

/**
 * Adjust an ISO date string by a number of days.
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {number} days - days to add (negative to subtract)
 * @returns {string}
 */
export function adjustDate(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Validate an expense form before submission.
 * @param {Object} form - form state object
 * @param {boolean} isPersonal - whether this is a personal room
 * @returns {string} error message, or empty string if valid
 */
export function validateExpense(form, isPersonal) {
  if (!form.amount || parseFloat(form.amount) <= 0) return 'Amount is mandatory';
  if (!form.description || form.description.trim() === '') return 'Description is mandatory';
  if (!isPersonal && !form.paidBy) return 'Please select who paid';
  if (!isPersonal && form.splitAmong.length === 0) return 'Please select at least one person to split with';
  if (!form.categoryId) return 'Please select a category';
  if (!form.date) return 'Date is mandatory';
  return '';
}

/**
 * Calculate usageCount and lastUsedAt for a new expense.
 *
 * @param {Object} expense - The new expense data.
 * @param {Array} existingExpenses - All existing expenses in the room.
 * @returns {Object} { usageCount: number, lastUsedAt: string }
 */
export function getUsageFieldsForNewExpense(expense, existingExpenses = []) {
  const processedExpenses = existingExpenses.map(e => ({
    ...e,
    usageCount: e.usageCount !== undefined ? e.usageCount : 1,
    lastUsedAt: e.lastUsedAt || e.createdAt || e.date || new Date().toISOString()
  }));

  const desc = (expense.description || '').trim().toLowerCase();
  const groupName = (expense.groupName || '').trim().toLowerCase();
  const isItemised = !!expense.isItemised;

  let maxCount = 0;

  if (isItemised && groupName) {
    const matches = processedExpenses.filter(e => {
      const eGroupName = (e.groupName || '').trim().toLowerCase();
      return e.isItemised && eGroupName === groupName;
    });
    maxCount = matches.reduce((max, e) => Math.max(max, e.usageCount), maxCount);
  } else if (desc) {
    const matches = processedExpenses.filter(e => {
      const eDesc = (e.description || '').trim().toLowerCase();
      return !e.isItemised && eDesc === desc;
    });
    maxCount = matches.reduce((max, e) => Math.max(max, e.usageCount), maxCount);
  }

  const usageCount = Math.max(1, maxCount + 1);
  const lastUsedAt = new Date().toISOString();

  return { usageCount, lastUsedAt };
}

/**
 * Calculate usageCount and lastUsedAt for an updated expense.
 *
 * @param {Object} updatedExpense - The updated expense data.
 * @param {Array} existingExpenses - All existing expenses in the room.
 * @param {string} oldExpenseId - The ID of the expense being updated.
 * @returns {Object} { usageCount: number, lastUsedAt: string }
 */
export function getUsageFieldsForUpdatedExpense(updatedExpense, existingExpenses = [], oldExpenseId) {
  const processedExpenses = existingExpenses.map(e => ({
    ...e,
    usageCount: e.usageCount !== undefined ? e.usageCount : 1,
    lastUsedAt: e.lastUsedAt || e.createdAt || e.date || new Date().toISOString()
  }));

  const desc = (updatedExpense.description || '').trim().toLowerCase();
  const groupName = (updatedExpense.groupName || '').trim().toLowerCase();
  const isItemised = !!updatedExpense.isItemised;

  let maxCount = 0;
  const otherExpenses = processedExpenses.filter(e => e.id !== oldExpenseId);

  if (isItemised && groupName) {
    const matches = otherExpenses.filter(e => {
      const eGroupName = (e.groupName || '').trim().toLowerCase();
      return e.isItemised && eGroupName === groupName;
    });
    maxCount = matches.reduce((max, e) => Math.max(max, e.usageCount), maxCount);
  } else if (desc) {
    const matches = otherExpenses.filter(e => {
      const eDesc = (e.description || '').trim().toLowerCase();
      return !e.isItemised && eDesc === desc;
    });
    maxCount = matches.reduce((max, e) => Math.max(max, e.usageCount), maxCount);
  }

  const usageCount = Math.max(1, maxCount + 1);
  const lastUsedAt = new Date().toISOString();

  return { usageCount, lastUsedAt };
}

