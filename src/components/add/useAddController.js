import { useCallback, useMemo, useState } from 'react';
import { useRoomContext } from '../../context/RoomContext';
import { useExpenseForm } from '../../hooks/useExpenseForm';
import { addExpense, addItemisedExpenseGroup } from '../../services/expenseService';
import { validateExpense } from '../../utils/expenseFormHelpers';
import { getLastUsedMode, setLastUsedMode, getLastUsedDefaults, setLastUsedDefaults } from '../../utils/lastUsedDefaults';
import { addRecentDescription } from '../../utils/recentDescriptions';
import { detectRecurringExpenses } from '../../utils/recurringExpenses';
import { memberStyle, monthWindow, localDateStr } from '../dashboard/dashboardData';
import { getSortedCategories } from './addHelpers';
import { guessCategory, learnPatterns } from '../../utils/categoryGuess';

/**
 * Logic for the redesigned Add screen. Save payload, validation and defaults are the same
 * as the old AddExpense.jsx — only the UI on top changed.
 */
// A Firestore write can wait forever on a bad connection (it queues locally and syncs later).
// Don't leave the slider stuck on "Adding…": after a while treat it as saved and let it sync.
const SAVE_WAIT_MS = 8000;
const withTimeout = p => Promise.race([p, new Promise(res => setTimeout(() => res('timeout'), SAVE_WAIT_MS))]);

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
  const [manualCat, setManualCat] = useState(false); // user tapped a category — never auto-change it after that
  const [saving, setSaving] = useState(false);

  const members = useMemo(() => users.map((u, i) => ({ ...u, ...memberStyle(i) })), [users]);
  const sortedCategories = useMemo(() => getSortedCategories(categories, expenses), [categories, expenses]);
  // Learned from everyone's expenses in this room (incl. synced copies in a personal room).
  const learned = useMemo(() => learnPatterns(expenses, categories), [expenses, categories]);
  const guessCat = useCallback(text => guessCategory(text, learned, categories), [learned, categories]);

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

  // Items mode: recent item names (lines of itemised bills), most used first.
  const itemChips = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const since = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const groups = {};
    for (const e of expenses) {
      if (!e.isItemised || (isPersonal && e.isSynced)) continue;
      const desc = (e.description || '').trim();
      if (!desc) continue;
      const t = e.createdAt ? new Date(e.createdAt).getTime() : (e.date ? new Date(e.date).getTime() : 0);
      if (t < since) continue;
      const g = groups[desc.toLowerCase()] ||= { description: desc, n: 0, last: 0 };
      g.n += 1;
      g.last = Math.max(g.last, t);
    }
    return Object.values(groups).sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 20).map(g => g.description);
  }, [expenses, isPersonal]);

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

  const setDescription = useCallback(val => {
    setField.description(val);
    if (manualCat) return;
    const id = guessCat(val);
    if (id) { setField.categoryId(id); setAutoCat(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessCat, manualCat]);

  const pickCategory = useCallback(id => { setField.categoryId(id); setAutoCat(false); setManualCat(true); }, [setField]);

  const applyRecurring = chip => {
    setField.description(chip.description);
    const learnedId = chip.categoryId ? null : guessCat(chip.description);
    setField.categoryId(chip.categoryId || learnedId || '');
    setAutoCat(!!learnedId);
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
      const done = addExpense(roomCode, {
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        paidBy: isPersonal ? (users[0]?.id || '') : form.paidBy,
        splitAmong: isPersonal ? [users[0]?.id || ''] : form.splitAmong,
        categoryId: form.categoryId,
        date: form.date,
      }, room, expenses.length ? expenses : null);
      done.catch(err => console.error('Save failed after timeout', err));
      await withTimeout(done);
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

  const resetQuick = () => { resetForm(); setField.categoryId(''); setAutoCat(false); setManualCat(false); };

  // ── Items mode: one bill (group) with one payer, several printed lines ──
  const [billName, setBillName] = useState('');
  const [billTotal, setBillTotal] = useState('');
  const [rows, setRows] = useState([]);   // printed lines, oldest first

  const totalNum = parseFloat(billTotal) || 0;
  const sumOfRows = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = parseFloat((totalNum - sumOfRows).toFixed(2));

  const addRow = row => setRows(prev => [...prev, { ...row, id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9) }]);
  const removeRow = id => setRows(prev => prev.filter(r => r.id !== id));

  const billProblem =
    totalNum <= 0 ? 'Enter a total'
      : !billName.trim() ? 'Add a bill name'
        : (!isPersonal && !form.paidBy) ? 'Choose who paid'
          : rows.length === 0 ? 'Add an item'
            : Math.abs(remaining) >= 0.01 ? (remaining > 0 ? `₹${remaining.toLocaleString('en-IN')} still to split` : `₹${Math.abs(remaining).toLocaleString('en-IN')} over the total`)
              : '';

  /** Saves the bill via addItemisedExpenseGroup (same documents as before). */
  const submitBill = async () => {
    if (billProblem) return { ok: false, message: billProblem };
    setSaving(true);
    try {
      const payerId = isPersonal ? (users[0]?.id || '') : form.paidBy;
      const items = rows.map(row => ({
        description: row.description.trim() || billName.trim(),
        amount: parseFloat(row.amount),
        categoryId: row.categoryId,
        splitAmong: isPersonal ? [payerId] : row.splitAmong,
      }));
      const done = addItemisedExpenseGroup(roomCode, billName.trim(), items, { paidBy: payerId, date: form.date }, room, expenses.length ? expenses : null);
      done.catch(err => console.error('Save failed after timeout', err));
      await withTimeout(done);
      const last = rows[rows.length - 1];
      setLastUsedDefaults(roomCode, {
        categoryId: last.categoryId,
        paidBy: isPersonal ? null : form.paidBy,
        splitAmong: isPersonal ? null : last.splitAmong,
      });
      rows.forEach(r => { if (r.description.trim()) addRecentDescription(roomCode, r.description); });
      return { ok: true, total: totalNum, name: billName.trim(), count: rows.length };
    } catch (err) {
      return { ok: false, message: err.message || 'Failed to add bill' };
    } finally {
      setSaving(false);
    }
  };

  const resetBill = () => { setBillName(''); setBillTotal(''); setRows([]); };

  /**
   * Budget nudge (personal rooms): a message when this expense pushes this month's spend
   * past 80% or 100% of the monthly budget — only on the crossing, so it never nags.
   */
  const budgetNudge = (amount, date) => {
    const budget = Number(room?.budget) || 0;
    if (!isPersonal || !(budget > 0) || !(amount > 0)) return null;
    const cur = monthWindow(expenses).months.slice(-1)[0];
    if (!cur || !date || date.slice(0, 7) !== localDateStr().slice(0, 7)) return null;
    const before = cur.total;
    const after = before + amount;
    const pct = Math.round((after / budget) * 100);
    const fmtR = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
    if (before <= budget && after > budget) return { kind: 'error', message: `Over budget · ${fmtR(after - budget)} past ${fmtR(budget)}`, sub: 'This month’s spend went over your monthly budget' };
    if (before < budget * 0.8 && after >= budget * 0.8) return { kind: 'warn', message: `${pct}% of budget used · ${fmtR(budget - after)} left`, sub: 'Heads up — you’re close to this month’s limit' };
    return null;
  };

  return {
    budgetNudge,
    roomCode, room, isPersonal, members, userIdentity,
    mode, setMode,
    form, setField, toggleSplit, setDescription, pickCategory, autoCat, guessCat,
    sortedCategories, filteredChips, itemChips, recurringExpensesList, itemisedGroupNamesList,
    applyRecurring, problem, submitQuick, resetQuick, saving,
    quickCheck: () => problem || validateExpense(form, isPersonal) || '',
    billName, setBillName, billTotal, setBillTotal, rows, addRow, removeRow, remaining, billProblem, submitBill, resetBill,
  };
}
