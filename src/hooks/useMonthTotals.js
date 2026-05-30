import { useMemo } from 'react';

export function useMonthTotals(expenses) {
  return useMemo(() => {
    const now = new Date();
    const cm = now.getMonth();
    const cy = now.getFullYear();
    const pm = cm === 0 ? 11 : cm - 1;
    const py = cm === 0 ? cy - 1 : cy;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let currentTotal = 0, prevTotal = 0;
    expenses.forEach(e => {
      const d = new Date(e.date);
      const em = d.getMonth(), ey = d.getFullYear();
      if (em === cm && ey === cy) currentTotal += parseFloat(e.amount) || 0;
      if (em === pm && ey === py) prevTotal += parseFloat(e.amount) || 0;
    });

    return {
      currentMonthTotal: currentTotal,
      prevMonthTotal: prevTotal,
      currentMonthLabel: monthNames[cm],
      prevMonthLabel: monthNames[pm],
    };
  }, [expenses]);
}
