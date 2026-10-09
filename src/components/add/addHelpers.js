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

/**
 * Description suggestions from past expenses: `used` = most used of ALL time, `recent` = latest. (Same description, any case, is one.)
 * itemised: only lines of itemised bills (Items mode). Synced copies in a personal room are skipped.
 */
export function descriptionLists(expenses, { itemised = false, personal = false, n = 14 } = {}) {
  const groups = new Map();
  for (const e of expenses || []) {
    if (personal && e.isSynced) continue;
    if (itemised && !e.isItemised) continue;
    const d = (e.description || '').trim();
    if (!d || /^taxes (&|and) charges$/i.test(d)) continue;     // the bill's taxes line isn't something to type again
    const t = new Date(e.lastUsedAt || e.createdAt || e.date || 0).getTime() || 0;
    const g = groups.get(d.toLowerCase()) || { d, n: 0, last: 0 };
    g.n += Math.max(1, Number(e.usageCount) || 1);
    if (t >= g.last) { g.last = t; g.d = d; }
    groups.set(d.toLowerCase(), g);
  }
  const all = [...groups.values()];
  return {
    used: [...all].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, n).map(g => g.d),
    recent: [...all].sort((a, b) => b.last - a.last || b.n - a.n).slice(0, n).map(g => g.d),
  };
}
