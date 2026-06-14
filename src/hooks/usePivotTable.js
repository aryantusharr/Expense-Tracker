import { useMemo } from 'react';

export function usePivotTable(expenses, categories) {
  return useMemo(() => {
    if (!expenses || expenses.length === 0) return null;

    const catMap = {};
    (categories || []).forEach(c => { catMap[c.id] = c; });

    // 1. Gather all unique months
    const monthSet = new Set();
    expenses.forEach(e => {
      const d = new Date(e.date);
      monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });

    const sortedMonthsKeys = Array.from(monthSet).sort(); // Chronological
    const monthLabels = sortedMonthsKeys.map(k => {
      const [y, m] = k.split('-');
      const d = new Date(y, parseInt(m) - 1);
      return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    });

    // Count category occurrences
    const categoryCount = {};
    expenses.forEach(e => {
      const catId = e.categoryId || 'unknown';
      categoryCount[catId] = (categoryCount[catId] || 0) + 1;
    });

    // 2. Gather matrix data
    const matrix = {}; 
    const monthGrandTotals = {};
    let overallGrandTotal = 0;

    sortedMonthsKeys.forEach(m => monthGrandTotals[m] = 0);

    expenses.forEach(e => {
      const d = new Date(e.date);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const catId = e.categoryId || 'unknown';
      const amount = parseFloat(e.amount) || 0;

      if (!matrix[catId]) {
        const cat = catMap[catId] || { name: 'Other', icon: '📦' };
        matrix[catId] = { id: catId, name: cat.name, icon: cat.icon, totalsByMonth: {}, grandTotal: 0 };
        sortedMonthsKeys.forEach(m => matrix[catId].totalsByMonth[m] = 0);
      }

      matrix[catId].totalsByMonth[mKey] += amount;
      matrix[catId].grandTotal += amount;
      monthGrandTotals[mKey] += amount;
      overallGrandTotal += amount;
    });

    const sortedCategories = Object.values(matrix).map(cat => {
      const roundedTotalsByMonth = {};
      Object.keys(cat.totalsByMonth).forEach(m => {
        roundedTotalsByMonth[m] = Math.round(cat.totalsByMonth[m]);
      });
      return {
        ...cat,
        totalsByMonth: roundedTotalsByMonth,
        grandTotal: Math.round(cat.grandTotal)
      };
    }).sort((a, b) => {
      const countA = categoryCount[a.id] || 0;
      const countB = categoryCount[b.id] || 0;
      if (countB !== countA) {
        return countB - countA;
      }
      return a.name.localeCompare(b.name);
    });

    const roundedMonthGrandTotals = {};
    Object.keys(monthGrandTotals).forEach(m => {
      roundedMonthGrandTotals[m] = Math.round(monthGrandTotals[m]);
    });

    return {
      monthKeys: sortedMonthsKeys,
      monthLabels,
      categories: sortedCategories,
      monthGrandTotals: roundedMonthGrandTotals,
      overallGrandTotal: Math.round(overallGrandTotal)
    };
  }, [expenses, categories]);
}
