/**
 * Detection logic for recurring expenses.
 * Groups expenses by trimmed, case-insensitive description + categoryId.
 * Recurring criteria:
 * (a) 2+ times on the same calendar date, OR
 * (b) 2+ different calendar months.
 */

export function detectRecurringExpenses(expenses) {
  if (!expenses || expenses.length === 0) return [];

  const groups = {};

  for (const exp of expenses) {
    const descTrimmed = (exp.description || '').trim();
    const key = `${descTrimmed.toLowerCase()}|${exp.categoryId || 'no-cat'}`;

    if (!groups[key]) {
      groups[key] = {
        key,
        description: descTrimmed || 'Untitled',
        categoryId: exp.categoryId,
        items: [],
        mostRecent: exp
      };
    }

    groups[key].items.push(exp);

    // Track the most recent transaction to pre-fill latest amount/paidBy/splitAmong
    const currentMR = groups[key].mostRecent;
    const currentMRDate = new Date(currentMR.date || 0);
    const expDate = new Date(exp.date || 0);
    if (expDate > currentMRDate) {
      groups[key].mostRecent = exp;
      groups[key].description = descTrimmed;
    } else if (expDate.getTime() === currentMRDate.getTime()) {
      const currentMRTime = new Date(currentMR.createdAt || 0);
      const expTime = new Date(exp.createdAt || 0);
      if (expTime > currentMRTime) {
        groups[key].mostRecent = exp;
        groups[key].description = descTrimmed;
      }
    }
  }

  const recurringList = [];

  for (const key in groups) {
    const group = groups[key];
    const items = group.items;

    if (items.length < 2) continue;

    // Condition (a): 2+ times on the same calendar date
    const datesMap = {};
    let hasSameDateMultiple = false;
    for (const exp of items) {
      const d = exp.date;
      if (d) {
        datesMap[d] = (datesMap[d] || 0) + 1;
        if (datesMap[d] >= 2) {
          hasSameDateMultiple = true;
        }
      }
    }

    // Condition (b): 2+ different calendar months (YYYY-MM)
    const monthsSet = new Set();
    for (const exp of items) {
      if (exp.date) {
        const month = exp.date.substring(0, 7);
        monthsSet.add(month);
      }
    }
    const hasMultipleMonths = monthsSet.size >= 2;

    if (hasSameDateMultiple || hasMultipleMonths) {
      const mr = group.mostRecent;
      recurringList.push({
        description: group.description,
        categoryId: group.categoryId,
        lastAmount: mr.amount,
        lastPaidBy: mr.paidBy || null,
        lastSplitAmong: mr.splitAmong || [],
        mostRecentDate: new Date(mr.date || 0),
        count: items.length
      });
    }
  }

  // Sort by count descending, fallback to mostRecentDate descending
  recurringList.sort((a, b) => b.count - a.count || b.mostRecentDate - a.mostRecentDate);

  return recurringList;
}
