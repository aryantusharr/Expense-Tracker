// Moved from expenses/AddExpense.jsx — category sorting + math helpers.
// Category auto-pick lives in utils/categoryGuess.js.
/**
 * Sorts room categories as Recent (used in last 5 entries) first,
 * then Frequent (used in 60%+ of room's entries), then remaining alphabetically.
 */
export function getSortedCategories(categories, expenses) {
  if (!categories || categories.length === 0) return [];
  if (!expenses || expenses.length === 0) {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Sort expenses by date descending to get recent entries
  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Recent: categories used in the last 5 entries (up to 5 unique)
  const recentIds = [];
  for (const exp of sortedExpenses) {
    if (exp.categoryId && !recentIds.includes(exp.categoryId)) {
      recentIds.push(exp.categoryId);
      if (recentIds.length === 5) break;
    }
  }

  // Frequent: categories used in 60%+ of this room's entries
  const frequentIds = [];
  const counts = {};
  for (const exp of expenses) {
    if (exp.categoryId) {
      counts[exp.categoryId] = (counts[exp.categoryId] || 0) + 1;
    }
  }
  const totalCount = expenses.length;
  for (const catId in counts) {
    if (counts[catId] / totalCount >= 0.6) {
      frequentIds.push(catId);
    }
  }

  const recentCats = [];
  const frequentCats = [];
  const remainingCats = [];

  for (const cat of categories) {
    if (recentIds.includes(cat.id)) {
      continue;
    } else if (frequentIds.includes(cat.id)) {
      frequentCats.push(cat);
    } else {
      remainingCats.push(cat);
    }
  }

  // Preserve the exact chronological order of recency
  for (const id of recentIds) {
    const cat = categories.find(c => c.id === id);
    if (cat) recentCats.push(cat);
  }

  remainingCats.sort((a, b) => a.name.localeCompare(b.name));
  frequentCats.sort((a, b) => a.name.localeCompare(b.name));

  return [...recentCats, ...frequentCats, ...remainingCats];
}
// Safely evaluates basic math expressions containing + - * /
export const evaluateMathExpression = (str) => {
  if (!str) return null;
  // strip out anything that isn't a digit, decimal point, space, or +, -, *, /
  const sanitized = str.replace(/[^0-9.\s+\-*/()]/g, '');
  try {
    const result = new Function(`return (${sanitized})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return parseFloat(result.toFixed(2));
    }
  } catch {
    // Ignore evaluation errors
  }
  return null;
};

/** Suggestions narrowed by what's typed (an exact match drops out). */
export const matchChips = (list, typed, n = 8) => {
  const q = (typed || '').trim().toLowerCase();
  return list.filter(d => !q || (d.toLowerCase().includes(q) && d.toLowerCase() !== q)).slice(0, n);
};
