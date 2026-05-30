import { useState } from 'react';
import { getTodayISO } from '../utils/helpers';

const DEFAULT_VALUES = {
  description: '',
  amount: '',
  paidBy: '',
  splitAmong: [],
  categoryId: 'cat-1',
  date: getTodayISO(),
};

/**
 * Manages all expense form state.
 * @param {Object} initialValues - Override defaults (e.g. when editing)
 * @param {Array} users - Room members for deriving splitAmong default
 */
export function useExpenseForm(initialValues = {}, users = []) {
  const [description, setDescription] = useState(initialValues.description ?? DEFAULT_VALUES.description);
  const [amount, setAmount] = useState(initialValues.amount !== undefined ? String(initialValues.amount) : DEFAULT_VALUES.amount);
  const [paidBy, setPaidBy] = useState(initialValues.paidBy ?? users[0]?.id ?? DEFAULT_VALUES.paidBy);
  const [splitAmong, setSplitAmong] = useState(initialValues.splitAmong ?? users.map(u => u.id));
  const [categoryId, setCategoryId] = useState(initialValues.categoryId ?? DEFAULT_VALUES.categoryId);
  const [date, setDate] = useState(initialValues.date ?? DEFAULT_VALUES.date);

  const setField = {
    description: setDescription,
    amount: setAmount,
    paidBy: setPaidBy,
    splitAmong: setSplitAmong,
    categoryId: setCategoryId,
    date: setDate,
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setPaidBy(users[0]?.id ?? '');
    setSplitAmong(users.map(u => u.id));
    setCategoryId('cat-1');
    setDate(getTodayISO());
  };

  const reinitialize = (values) => {
    setDescription(values.description ?? '');
    setAmount(String(values.amount ?? ''));
    setPaidBy(values.paidBy ?? '');
    setSplitAmong(values.splitAmong ?? []);
    setCategoryId(values.categoryId ?? 'cat-1');
    setDate(values.date ?? getTodayISO());
  };

  const toggleSplit = (userId) => {
    setSplitAmong(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => setSplitAmong(users.map(u => u.id));

  const perPerson = splitAmong.length > 0 && amount
    ? (parseFloat(amount) / splitAmong.length).toFixed(2)
    : '0';

  const allGradient = users.length >= 2
    ? `linear-gradient(135deg, ${users.map((u, i) => `${u.color} ${(i / (users.length - 1)) * 100}%`).join(', ')})`
    : users[0]?.color || 'var(--accent)';

  const form = { description, amount, paidBy, splitAmong, categoryId, date };

  return { form, setField, resetForm, reinitialize, toggleSplit, selectAll, perPerson, allGradient };
}
