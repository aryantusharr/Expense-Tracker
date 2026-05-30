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

    const sortedCategories = Object.values(matrix).sort((a, b) => a.name.localeCompare(b.name));

    return {
      monthKeys: sortedMonthsKeys,
      monthLabels,
      categories: sortedCategories,
      monthGrandTotals,
      overallGrandTotal
    };
  }, [expenses, categories]);
}
