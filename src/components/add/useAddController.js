import { useCallback, useMemo, useState } from 'react';
import { useRoomContext } from '../../context/RoomContext';
import { useExpenseForm } from '../../hooks/useExpenseForm';
import { addExpense } from '../../services/expenseService';
import { validateExpense } from '../../utils/expenseFormHelpers';
import { getLastUsedMode, setLastUsedMode, getLastUsedDefaults, setLastUsedDefaults } from '../../utils/lastUsedDefaults';
import { addRecentDescription } from '../../utils/recentDescriptions';
import { detectRecurringExpenses } from '../../utils/recurringExpenses';
import { memberStyle } from '../dashboard/dashboardData';
import { HINGLISH_MAP, findMatchingCategory, getSortedCategories } from './addHelpers';

/**
 * Logic for the redesigned Add screen. Save payload, validation and defaults are the same
 * as the old AddExpense.jsx — only the UI on top changed.
 */
export function useAddController() {
  const { roomCode, room, expenses, users, categories, userIdentity } = useRoomContext();
  const isPersonal = room?.isPersonal === true;

  const [mode, setModeState] = useState(() => getLastUsedMode(roomCode) === 'split' ? 'split' : 'quick');
  const setMode = useCallback(m => { setModeState(m); setLastUsedMode(roomCode, m === 'split' ? 'split' : 'quick'); }, [roomCode]);

  const defaults = useMemo(() => getLastUsedDefaults(roomCode), [roomCode]);
  const { form, setField, resetForm, toggleSplit } = useExpenseForm(
    { categoryId: '', paidBy: defaults.paidBy || undefined, splitAmong: defaults.splitAmong || undefined },
    users,
    userIdentity
  );

  const [autoCat, setAutoCat] = useState(false);   // category was picked from the description
  const [saving, setSaving] = useState(false);

  const members = useMemo(() => users.map((u, i) => ({ ...u, ...memberStyle(i) })), [users]);
  const sortedCategories = useMemo(() => getSortedCategories(categories, expenses), [categories, expenses]);

  // Quick mode: live-filtered description suggestions based on 45-day usage count
  const descriptionChips = useMemo(() => {
    const roomExpenses = isPersonal ? expenses.filter(e => !e.isSynced) : expenses;
    // eslint-disable-next-line react-hooks/purity
    const fortyFiveDaysAgo = Date.now() - 45 * 24 * 60 * 60 * 1000;

    const recentExpenses = roomExpenses.filter(e => {
      const time = e.lastUsedAt ? new Date(e.lastUsedAt).getTime() : (e.createdAt ? new Date(e.createdAt).getTime() : (e.date ? new Date(e.date).getTime() : 0));
      return time >= fortyFiveDaysAgo;
    });

    const groups = {};
    for (const e of recentExpenses) {
      const desc = (e.description || '').trim();
      if (!desc) continue;
      const key = desc.toLowerCase();
      if (!groups[key]) {
        // Find room-wide matches to compute usage count and last used date
        const matches = roomExpenses.filter(x => (x.description || '').trim().toLowerCase() === key);
        const maxCount = matches.reduce((max, x) => Math.max(max, x.usageCount !== undefined ? x.usageCount : 1), matches.length || 1);
        const lastUsed = matches.reduce((max, x) => {
          const t = x.lastUsedAt ? new Date(x.lastUsedAt).getTime() : (x.createdAt ? new Date(x.createdAt).getTime() : 0);
          return Math.max(max, t);
        }, 0);

        groups[key] = {
          description: desc,
          usageCount: maxCount,
          lastUsedAt: lastUsed
        };
      }
    }

    return Object.values(groups)
      .sort((a, b) => b.usageCount - a.usageCount || b.lastUsedAt - a.lastUsedAt)
      .slice(0, 10)
      .map(g => g.description);
  }, [expenses, isPersonal]);
  const filteredChips = descriptionChips;

  // Recurring Expenses suggestions: filtered for recurring entries in last 45 days, sorted by 45-day usage count
  const recurringExpensesList = useMemo(() => {
    const roomExpenses = isPersonal ? expenses.filter(e => !e.isSynced) : expenses;
    // eslint-disable-next-line react-hooks/purity
    const fortyFiveDaysAgo = Date.now() - 45 * 24 * 60 * 60 * 1000;

    const recentExpenses = roomExpenses.filter(e => {
      const time = e.lastUsedAt ? new Date(e.lastUsedAt).getTime() : (e.createdAt ? new Date(e.createdAt).getTime() : (e.date ? new Date(e.date).getTime() : 0));
      return time >= fortyFiveDaysAgo;
    });

    const detected = detectRecurringExpenses(recentExpenses);

    const recurringMap = {};
    for (const item of detected) {
      const key = item.description.trim().toLowerCase();
      recurringMap[key] = {
        description: item.description,
        categoryId: item.categoryId,
        lastAmount: item.lastAmount,
        lastPaidBy: item.lastPaidBy,
        lastSplitAmong: item.lastSplitAmong,
        usageCount: 1,
        lastUsedAt: 0
      };
    }

    for (const e of recentExpenses) {
      if (e.recurring === true || e.isRecurring === true) {
        const key = (e.description || '').trim().toLowerCase();
        if (!recurringMap[key]) {
          recurringMap[key] = {
            description: (e.description || '').trim(),
            categoryId: e.categoryId,
            lastAmount: e.amount,
            lastPaidBy: e.paidBy || null,
            lastSplitAmong: e.splitAmong || [],
            usageCount: 1,
            lastUsedAt: 0
          };
        }
      }
    }

    for (const key in recurringMap) {
      const group = recurringMap[key];
      const matches = roomExpenses.filter(x => (x.description || '').trim().toLowerCase() === key);
      const maxCount = matches.reduce((max, x) => Math.max(max, x.usageCount !== undefined ? x.usageCount : 1), matches.length || 1);
      const lastUsed = matches.reduce((max, x) => {
        const t = x.lastUsedAt ? new Date(x.lastUsedAt).getTime() : (x.createdAt ? new Date(x.createdAt).getTime() : 0);
        return Math.max(max, t);
      }, 0);
      group.usageCount = maxCount;
      group.lastUsedAt = lastUsed;
    }

    return Object.values(recurringMap)
      .sort((a, b) => b.usageCount - a.usageCount || b.lastUsedAt - a.lastUsedAt)
      .slice(0, 10);
  }, [expenses, isPersonal]);

  // Name suggestions: Group unique group names from itemised expenses in last 45 days, sorted by usageCount
  const itemisedGroupNamesList = useMemo(() => {
    const roomExpenses = isPersonal ? expenses.filter(e => !e.isSynced) : expenses;
    // eslint-disable-next-line react-hooks/purity
    const fortyFiveDaysAgo = Date.now() - 45 * 24 * 60 * 60 * 1000;

    const recentExpenses = roomExpenses.filter(e => {
      const time = e.lastUsedAt ? new Date(e.lastUsedAt).getTime() : (e.createdAt ? new Date(e.createdAt).getTime() : (e.date ? new Date(e.date).getTime() : 0));
      return time >= fortyFiveDaysAgo;
    });

    const groups = {};
    for (const e of recentExpenses) {
      if (e.isItemised && e.groupName) {
        const name = e.groupName.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!groups[key]) {
          groups[key] = {
            groupName: name,
            categoryId: e.categoryId || null,
            usageCount: 1,
            lastUsedAt: 0
          };
        }
      }
    }

    for (const key in groups) {
      const group = groups[key];
      const matches = roomExpenses.filter(x => x.isItemised && (x.groupName || '').trim().toLowerCase() === key);
      const maxCount = matches.reduce((max, x) => Math.max(max, x.usageCount !== undefined ? x.usageCount : 1), matches.length || 1);
      const lastUsed = matches.reduce((max, x) => {
        const t = x.lastUsedAt ? new Date(x.lastUsedAt).getTime() : (x.createdAt ? new Date(x.createdAt).getTime() : 0);
        return Math.max(max, t);
      }, 0);
      group.usageCount = maxCount;
      group.lastUsedAt = lastUsed;
    }

    return Object.values(groups)
      .sort((a, b) => b.usageCount - a.usageCount || b.lastUsedAt - a.lastUsedAt)
      .slice(0, 10);
  }, [expenses, isPersonal]);

  const autoPickCategory = useCallback(text => {
    const lower = (text || '').toLowerCase();
    for (const [keyword, categoryName] of Object.entries(HINGLISH_MAP)) {
      if (lower.includes(keyword)) {
        const match = findMatchingCategory(categoryName, categories);
        if (match) {
          setField.categoryId(match.id);
          setAutoCat(true);
          return true;
        }
        break;
      }
    }
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const setDescription = useCallback(val => {
    setField.description(val);
    autoPickCategory(val);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPickCategory]);

  const pickCategory = useCallback(id => { setField.categoryId(id); setAutoCat(false); }, [setField]);

  const applyRecurring = chip => {
    setField.description(chip.description);
    setField.categoryId(chip.categoryId || '');
    setAutoCat(false);
    setField.amount(String(chip.lastAmount));
    if (!isPersonal) {
      if (chip.lastPaidBy) setField.paidBy(chip.lastPaidBy);
      if (chip.lastSplitAmong?.length > 0) setField.splitAmong(chip.lastSplitAmong);
    }
  };

  /** What's still missing for the slide to add (empty string = ready). */
  const amountNum = parseFloat(form.amount) || 0;
  const problem =
    amountNum <= 0 ? 'Enter an amount'
      : !form.description?.trim() ? 'Add a description'
        : !form.categoryId ? 'Pick a category'
          : (!isPersonal && !form.paidBy) ? 'Choose who paid'
            : (!isPersonal && form.splitAmong.length === 0) ? 'Pick who to split with'
              : '';

  /** Saves the quick expense. Resolves { ok, message }. Same document as before. */
  const submitQuick = async () => {
    if (problem) return { ok: false, message: problem };
    const validationError = validateExpense(form, isPersonal);
    if (validationError) return { ok: false, message: validationError };
    setSaving(true);
    try {
      await addExpense(roomCode, {
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        paidBy: isPersonal ? (users[0]?.id || '') : form.paidBy,
        splitAmong: isPersonal ? [users[0]?.id || ''] : form.splitAmong,
        categoryId: form.categoryId,
        date: form.date,
      }, room);
      setLastUsedDefaults(roomCode, {
        categoryId: form.categoryId,
        paidBy: isPersonal ? null : form.paidBy,
        splitAmong: isPersonal ? null : form.splitAmong,
      });
      addRecentDescription(roomCode, form.description);
      return { ok: true, amount: parseFloat(form.amount), description: form.description.trim() };
    } catch (err) {
      return { ok: false, message: err.message || 'Failed to add expense' };
    } finally {
      setSaving(false);
    }
  };

  const resetQuick = () => { resetForm(); setField.categoryId(''); setAutoCat(false); };

  return {
    roomCode, room, isPersonal, members, userIdentity,
    mode, setMode,
    form, setField, toggleSplit, setDescription, pickCategory, autoCat,
    sortedCategories, filteredChips, recurringExpensesList, itemisedGroupNamesList,
    applyRecurring, problem, submitQuick, resetQuick, saving,
  };
}
