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
