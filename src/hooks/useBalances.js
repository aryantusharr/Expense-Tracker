import { useMemo } from 'react';
import { calculateBalances, getTotalExpenses, getMonthlyTotals } from '../utils/splitCalculator';
import { calculateSettlements, isAllSettled } from '../utils/settlementEngine';

export function useBalances(expenses, users) {
  const balances = useMemo(() => calculateBalances(expenses, users), [expenses, users]);
  const total = useMemo(() => getTotalExpenses(expenses), [expenses]);
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);
  const allSettled = useMemo(() => isAllSettled(balances), [balances]);
  const monthlyTotals = useMemo(() => getMonthlyTotals(expenses), [expenses]);

  return { balances, total, settlements, allSettled, monthlyTotals };
}
