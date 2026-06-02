import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import { useRoomContext } from '../../context/RoomContext';
import { useExpenseForm } from '../../hooks/useExpenseForm';
import { useSuccessState } from '../../hooks/useSuccessState';
import { addExpense } from '../../services/expenseService';
import { validateExpense, adjustDate } from '../../utils/expenseFormHelpers';
import CountUp from '../common/CountUp';
import { getLastUsedMode, setLastUsedMode, getLastUsedDefaults, setLastUsedDefaults } from '../../utils/lastUsedDefaults';
import { getRecentDescriptions, addRecentDescription } from '../../utils/recentDescriptions';
import './Expenses.css';

// Hinglish keyword category mapping
const HINGLISH_MAP = {
  // Groceries
  sabzi: 'Groceries', pyaaz: 'Groceries', aata: 'Groceries', dal: 'Groceries', chawal: 'Groceries',
  zepto: 'Groceries', blinkit: 'Groceries', bigbasket: 'Groceries', kirana: 'Groceries', doodh: 'Groceries',
  anda: 'Groceries', bread: 'Groceries',
  
  // Food & Dining
  biryani: 'Food & Dining', pizza: 'Food & Dining', burger: 'Food & Dining', zomato: 'Food & Dining', swiggy: 'Food & Dining',
  chai: 'Food & Dining', dhaba: 'Food & Dining', restaurant: 'Food & Dining', khana: 'Food & Dining', lunch: 'Food & Dining',
  dinner: 'Food & Dining', breakfast: 'Food & Dining', maggi: 'Food & Dining', noodles: 'Food & Dining', dominos: 'Food & Dining',
  
  // Transportation
  petrol: 'Transportation', diesel: 'Transportation', uber: 'Transportation', ola: 'Transportation', rapido: 'Transportation',
  auto: 'Transportation', rickshaw: 'Transportation', metro: 'Transportation', cab: 'Transportation', fuel: 'Transportation',
  toll: 'Transportation',
  
  // Entertainment
  netflix: 'Entertainment', spotify: 'Entertainment', prime: 'Entertainment', movie: 'Entertainment', ticket: 'Entertainment',
  cinema: 'Entertainment', hotstar: 'Entertainment', youtube: 'Entertainment',
  
  // Utilities
  rent: 'Utilities', bijli: 'Utilities', electricity: 'Utilities', water: 'Utilities', internet: 'Utilities',
  mobile: 'Utilities', recharge: 'Utilities', wifi: 'Utilities', broadband: 'Utilities',
  
  // Smoking/Cigarettes
  cig: 'Smoking/Cigarettes', cigs: 'Smoking/Cigarettes', cigarette: 'Smoking/Cigarettes', cigarettes: 'Smoking/Cigarettes', sutta: 'Smoking/Cigarettes',
  bidi: 'Smoking/Cigarettes', hookah: 'Smoking/Cigarettes',
  
  // Alcohol
  beer: 'Alcohol', wine: 'Alcohol', whiskey: 'Alcohol', vodka: 'Alcohol', rum: 'Alcohol',
  daaru: 'Alcohol', drinks: 'Alcohol', alcohol: 'Alcohol', breezer: 'Alcohol'
};

/**
 * Searches the room's category list for a target standard name.
 * Handles customized categories (edited, added, deleted) by:
 * 1. Performing case-insensitive exact matching.
 * 2. Performing case-insensitive partial substring matching.
 * 3. Gracefully skipping if no match is found.
 */
function findMatchingCategory(targetName, categories) {
  if (!categories || categories.length === 0) return null;
  const targetLower = targetName.toLowerCase();
  
  // 1. Exact match (case-insensitive)
  let matched = categories.find(c => c.name.toLowerCase() === targetLower);
  if (matched) return matched;
  
  // 2. Partial match (case-insensitive)
  matched = categories.find(c => {
    const nameLower = c.name.toLowerCase();
    return nameLower.includes(targetLower) || targetLower.includes(nameLower);
  });
  
  return matched || null;
}

/**
 * Sorts room categories as Recent (used in last 5 entries) first,
 * then Frequent (used in 60%+ of room's entries), then remaining alphabetically.
 */
function getSortedCategories(categories, expenses) {
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
const evaluateMathExpression = (str) => {
  if (!str) return null;
  // strip out anything that isn't a digit, decimal point, space, or +, -, *, /
  const sanitized = str.replace(/[^0-9.\s+\-*/()]/g, '');
  try {
    const result = new Function(`return (${sanitized})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return parseFloat(result.toFixed(2));
    }
  } catch (e) {
    // Ignore evaluation errors
  }
  return null;
};

export default function AddExpense() {
  const { roomCode, room, expenses, users, categories, userIdentity } = useRoomContext();
  const isPersonal = room?.isPersonal === true;

  // Mode Toggle State
  const [mode, setMode] = useState(() => getLastUsedMode(roomCode));

  // Load defaults from localStorage
  const defaults = useMemo(() => getLastUsedDefaults(roomCode), [roomCode]);

  const initialFormValues = useMemo(() => ({
    categoryId: defaults.categoryId || undefined,
    paidBy: defaults.paidBy || undefined,
    splitAmong: defaults.splitAmong || undefined,
  }), [defaults]);

  // Hook for Quick Expense Form
  const { form, setField, resetForm, toggleSplit, selectAll, perPerson, allGradient } = useExpenseForm(
    initialFormValues,
    users,
    userIdentity
  );

  const { showSuccess, triggerSuccess } = useSuccessState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Split Transaction Mode States
  const [totalAmount, setTotalAmount] = useState('');
  const [globalPaidBy, setGlobalPaidBy] = useState(() => {
    return defaults.paidBy || userIdentity || (users[0]?.id || '');
  });
  const [rows, setRows] = useState([]);

  // Sort categories based on recent/frequent criteria
  const sortedCategories = useMemo(() => getSortedCategories(categories, expenses), [categories, expenses]);

  // Sync mode state when room changes
  useEffect(() => {
    if (roomCode) {
      const savedMode = getLastUsedMode(roomCode);
      setMode(savedMode);
    }
  }, [roomCode]);

  // Handle defaults and initial row setup in Split mode when roomCode/users load
  useEffect(() => {
    if (!roomCode) return;
    const roomDefaults = getLastUsedDefaults(roomCode);
    setGlobalPaidBy(roomDefaults.paidBy || userIdentity || (users[0]?.id || ''));

    const defaultCatId = roomDefaults.categoryId || categories[0]?.id || 'cat-1';
    const defaultSplit = roomDefaults.splitAmong || users.map(u => u.id);

    setRows([
      {
        id: 'item_initial_' + Date.now(),
        categoryId: defaultCatId,
        description: '',
        amount: '',
        splitAmong: isPersonal ? [] : defaultSplit,
      }
    ]);
  }, [roomCode, categories, users, isPersonal, userIdentity]);

  // Quick mode: live-filtered recent descriptions
  const recentDescs = useMemo(() => getRecentDescriptions(roomCode), [roomCode, showSuccess]);
  const filteredChips = useMemo(() => {
    if (!form.description) return recentDescs;
    return recentDescs.filter(desc =>
      desc.toLowerCase().includes(form.description.toLowerCase())
    );
  }, [recentDescs, form.description]);

  // Split mode math calculations
  const sumOfRows = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = parseFloat(( (parseFloat(totalAmount) || 0) - sumOfRows ).toFixed(2));
  const isRemainingZero = Math.abs(remaining) < 0.01;

  // Math expression evaluation handlers
  const handleMathBlurOrEnter = (val, setter) => {
    const evaluated = evaluateMathExpression(val);
    if (evaluated !== null) {
      setter(String(evaluated));
    }
  };

  const handleRowMathBlur = (rowId, val) => {
    const evaluated = evaluateMathExpression(val);
    if (evaluated !== null) {
      handleUpdateRowField(rowId, 'amount', String(evaluated));
    }
  };

  // Mode Toggle change handler
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setLastUsedMode(roomCode, newMode);
    setError('');
  };

  // Description input handler: triggers Hinglish keyword mapping
  const handleDescriptionChange = (val) => {
    setField.description(val);
    
    const lowerVal = val.toLowerCase();
    for (const [keyword, categoryName] of Object.entries(HINGLISH_MAP)) {
      if (lowerVal.includes(keyword)) {
        const matchedCat = findMatchingCategory(categoryName, categories);
        if (matchedCat) {
          setField.categoryId(matchedCat.id);
          break; // Exit on first match
        }
      }
    }
  };

  // Select a recent description chip
  const handleChipTap = (desc) => {
    setField.description(desc);
    
    // Check Hinglish mapping for selected chip
    const lowerDesc = desc.toLowerCase();
    for (const [keyword, categoryName] of Object.entries(HINGLISH_MAP)) {
      if (lowerDesc.includes(keyword)) {
        const matchedCat = findMatchingCategory(categoryName, categories);
        if (matchedCat) {
          setField.categoryId(matchedCat.id);
          break;
        }
      }
    }
  };

  // Split Transaction handlers
  const handleAddItem = () => {
    const prevItem = rows[0] || {};
    const roomDefaults = getLastUsedDefaults(roomCode);
    const defaultCatId = prevItem.categoryId || roomDefaults.categoryId || categories[0]?.id || 'cat-1';
    const defaultSplit = prevItem.splitAmong ? [...prevItem.splitAmong] : (isPersonal ? [] : (roomDefaults.splitAmong || users.map(u => u.id)));

    const autoAmount = remaining > 0 ? String(remaining) : '';

    const newItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      categoryId: defaultCatId,
      description: '',
      amount: autoAmount,
      splitAmong: defaultSplit,
    };

    // Insert at index 0 for top of order display
    setRows(prev => [newItem, ...prev]);
  };

  const handleRemoveItem = (rowId) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleUpdateRowField = (rowId, field, value) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const handleToggleRowSplit = (rowId, userId) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const split = r.splitAmong.includes(userId)
        ? r.splitAmong.filter(id => id !== userId)
        : [...r.splitAmong, userId];
      return { ...r, splitAmong: split };
    }));
  };

  // Quick Expense Submit
  const handleQuickSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateExpense(form, isPersonal);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    try {
      await addExpense(roomCode, {
        description: form.description.trim() || 'Untitled',
        amount: parseFloat(form.amount),
        paidBy: isPersonal ? (users[0]?.id || '') : form.paidBy,
        splitAmong: isPersonal ? [users[0]?.id || ''] : form.splitAmong,
        categoryId: form.categoryId,
        date: form.date,
      }, room);

      // Save defaults to localStorage
      setLastUsedDefaults(roomCode, {
        categoryId: form.categoryId,
        paidBy: isPersonal ? null : form.paidBy,
        splitAmong: isPersonal ? null : form.splitAmong,
      });

      // Save to recent descriptions
      addRecentDescription(roomCode, form.description);

      triggerSuccess();
      resetForm();
    } catch (err) {
      setError(err.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  // Split Transaction Submit
  const handleSplitSubmit = async (e) => {
    e.preventDefault();

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      setError('Total UPI amount must be greater than 0');
      return;
    }
    if (!isPersonal && !globalPaidBy) {
      setError('Please select who paid');
      return;
    }
    if (rows.length === 0) {
      setError('Please add at least one item');
      return;
    }
    if (!isRemainingZero) {
      setError(`Remaining amount to split must be exactly ₹0 (currently ₹${remaining})`);
      return;
    }

    // Row-level validations
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.amount || parseFloat(row.amount) <= 0) {
        setError(`Item amount must be greater than 0 (Check item ${rows.length - i})`);
        return;
      }
      if (!isPersonal && (!row.splitAmong || row.splitAmong.length === 0)) {
        setError(`Item must have at least one roommate selected (Check item ${rows.length - i})`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // Save itemized items in order
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        const payerId = isPersonal ? (users[0]?.id || '') : globalPaidBy;
        const splitList = isPersonal ? [payerId] : row.splitAmong;

        await addExpense(roomCode, {
          description: row.description.trim() || 'Itemised Expense',
          amount: parseFloat(row.amount),
          paidBy: payerId,
          splitAmong: splitList,
          categoryId: row.categoryId,
          date: form.date, // Reuse global Date
        }, room);
      }

      // Save defaults using the last added item settings
      const lastRow = rows[0];
      if (lastRow) {
        setLastUsedDefaults(roomCode, {
          categoryId: lastRow.categoryId,
          paidBy: isPersonal ? null : globalPaidBy,
          splitAmong: isPersonal ? null : lastRow.splitAmong,
        });

        // Cache all item descriptions
        rows.forEach(r => {
          if (r.description.trim()) {
            addRecentDescription(roomCode, r.description);
          }
        });
      }

      triggerSuccess();
      
      // Reset Split form values
      setTotalAmount('');
      const defaultCatId = lastRow?.categoryId || defaults.categoryId || categories[0]?.id || 'cat-1';
      const defaultSplit = lastRow?.splitAmong || defaults.splitAmong || users.map(u => u.id);
      setRows([
        {
          id: 'item_reset_' + Date.now(),
          categoryId: defaultCatId,
          description: '',
          amount: '',
          splitAmong: isPersonal ? [] : defaultSplit,
        }
      ]);

    } catch (err) {
      setError(err.message || 'Failed to save split transaction');
    } finally {
      setLoading(false);
    }
  };

  const currentActiveCategory = sortedCategories.find(c => c.id === form.categoryId);

  return (
    <>
      <Header title="Add Expense" />
      <div className="page-content">
        
        {/* Mode Toggle at top */}
        <div className="mode-toggle-container" style={{
          display: 'flex',
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          marginBottom: 'var(--space-lg)',
          border: '1px solid var(--border-light)'
        }}>
          <button
            type="button"
            className={`toggle-btn ${mode === 'quick' ? 'active' : ''}`}
            onClick={() => handleModeChange('quick')}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 'var(--radius-sm)',
              background: mode === 'quick' ? 'var(--bg-elevated)' : 'transparent',
              color: mode === 'quick' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-sm)',
              boxShadow: mode === 'quick' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ⚡ Quick Expense
          </button>
          <button
            type="button"
            className={`toggle-btn ${mode === 'split' ? 'active' : ''}`}
            onClick={() => handleModeChange('split')}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 'var(--radius-sm)',
              background: mode === 'split' ? 'var(--bg-elevated)' : 'transparent',
              color: mode === 'split' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 'var(--font-sm)',
              boxShadow: mode === 'split' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            🥞 Split Transaction
          </button>
        </div>

        {/* Quick Expense Form */}
        {mode === 'quick' && (
          <motion.form
            key="quick-form"
            className="expense-form"
            onSubmit={handleQuickSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Amount with steppers */}
            <div className="amount-input-wrapper" style={{ marginBottom: 'var(--space-lg)' }}>
              <button
                type="button"
                className="amount-adj-btn"
                onClick={() => {
                  const evaluated = evaluateMathExpression(form.amount);
                  const currentVal = evaluated !== null ? String(evaluated) : form.amount;
                  const delta = -1;
                  const newVal = Math.max(0, (parseFloat(currentVal) || 0) + delta);
                  setField.amount(String(newVal));
                }}
              >
                −
              </button>
              <div className="amount-center">
                <span className="currency-symbol">₹</span>
                <input
                  className="amount-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="₹xx + ₹x"
                  value={form.amount}
                  onChange={(e) => setField.amount(e.target.value)}
                  onBlur={() => handleMathBlurOrEnter(form.amount, setField.amount)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleMathBlurOrEnter(form.amount, setField.amount);
                    }
                  }}
                  id="input-amount"
                />
              </div>
              <button
                type="button"
                className="amount-adj-btn"
                onClick={() => {
                  const evaluated = evaluateMathExpression(form.amount);
                  const currentVal = evaluated !== null ? String(evaluated) : form.amount;
                  const delta = 1;
                  const newVal = Math.max(0, (parseFloat(currentVal) || 0) + delta);
                  setField.amount(String(newVal));
                }}
              >
                +
              </button>
            </div>

            {/* Description with filtered chip list */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label>Description <span className="optional-tag">(optional)</span></label>
              
              {/* live-filtered chips list */}
              {filteredChips.length > 0 && (
                <div className="recent-chips-container" style={{
                  display: 'flex',
                  gap: 'var(--space-sm)',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  marginBottom: '6px',
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {filteredChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChipTap(chip)}
                      className="chip clickable"
                      style={{
                        whiteSpace: 'nowrap',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-secondary)',
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--font-xs)',
                        cursor: 'pointer'
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              <input
                className="input"
                placeholder="e.g. Groceries, Electricity bill..."
                value={form.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                id="input-description"
              />
            </div>

            {/* Date with steppers */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label>Date</label>
              <div className="date-stepper">
                <button type="button" className="stepper-btn" onClick={() => setField.date(adjustDate(form.date, -1))}>−</button>
                <input
                  className="input date-input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setField.date(e.target.value)}
                  id="input-date"
                />
                <button type="button" className="stepper-btn" onClick={() => setField.date(adjustDate(form.date, 1))}>+</button>
              </div>
            </div>

            {/* Sorted Category Pills */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label>Category</label>
                {currentActiveCategory && (
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Selected: {currentActiveCategory.name}
                  </span>
                )}
              </div>
              <div className="category-scroll-strip" style={{ display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto', paddingBottom: '4px' }}>
                {sortedCategories.map(cat => {
                  const isSelected = form.categoryId === cat.id;
                  return (
                    <motion.button
                      key={cat.id}
                      type="button"
                      className={`category-pill ${isSelected ? 'selected' : ''}`}
                      onClick={() => setField.categoryId(cat.id)}
                      whileTap={{ scale: 0.92 }}
                      layout
                    >
                      <motion.span
                        className="category-pill-icon"
                        animate={{ scale: isSelected ? 1.4 : 1, y: isSelected ? -4 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      >
                        {cat.icon}
                      </motion.span>
                      <span className="category-pill-label">{cat.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Paid By — hidden in personal mode */}
            {!isPersonal && (
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label>Paid By</label>
                <div className="user-select-row" style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  {users.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      className={`user-select-btn ${form.paidBy === user.id ? 'active' : ''}`}
                      onClick={() => setField.paidBy(user.id)}
                      style={{ '--user-color': user.color }}
                    >
                      <div className="avatar avatar-sm" style={{ background: user.color }}>{user.name[0]}</div>
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Split Among — hidden in personal mode */}
            {!isPersonal && (
              <div className="input-group" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="flex items-center justify-between">
                  <label>Split Among</label>
                  <button
                    type="button"
                    className="btn btn-sm all-members-btn"
                    style={{ background: allGradient, color: 'white', border: 'none' }}
                    onClick={selectAll}
                  >
                    All
                  </button>
                </div>
                <div className="user-select-row" style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  {users.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      className={`user-select-btn ${form.splitAmong.includes(user.id) ? 'active' : ''}`}
                      onClick={() => toggleSplit(user.id)}
                      style={{ '--user-color': user.color }}
                    >
                      <div className="avatar avatar-sm" style={{ background: user.color }}>
                        {form.splitAmong.includes(user.id) ? '✓' : user.name[0]}
                      </div>
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
                {form.splitAmong.length > 0 && form.amount && (
                  <p className="split-info">₹{perPerson} per person</p>
                )}
              </div>
            )}

            {error && <p className="error-text" style={{ marginBottom: 'var(--space-md)' }}>{error}</p>}

            <motion.button
              className={`btn btn-primary btn-full add-expense-btn ${showSuccess ? 'btn-success-state' : ''}`}
              type="submit"
              disabled={loading || showSuccess}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              {loading ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block' }}
                >
                  ⏳
                </motion.span>
              ) : showSuccess ? '✅ Added!' : '💰 Add Expense'}
            </motion.button>
          </motion.form>
        )}

        {/* Split Transaction Form */}
        {mode === 'split' && (
          <motion.form
            key="split-form"
            className="expense-form"
            onSubmit={handleSplitSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Global Date Field */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label>Date</label>
              <div className="date-stepper">
                <button type="button" className="stepper-btn" onClick={() => setField.date(adjustDate(form.date, -1))}>−</button>
                <input
                  className="input date-input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setField.date(e.target.value)}
                  id="input-date-split"
                />
                <button type="button" className="stepper-btn" onClick={() => setField.date(adjustDate(form.date, 1))}>+</button>
              </div>
            </div>

            {/* Global Paid By Chips (Shared Rooms Only) */}
            {!isPersonal && (
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label>Paid By</label>
                <div className="user-select-row" style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  {users.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      className={`user-select-btn ${globalPaidBy === user.id ? 'active' : ''}`}
                      onClick={() => setGlobalPaidBy(user.id)}
                      style={{ '--user-color': user.color }}
                    >
                      <div className="avatar avatar-sm" style={{ background: user.color }}>{user.name[0]}</div>
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Total UPI Amount Field */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label>Total UPI Amount</label>
              <div className="amount-center" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px var(--space-md)'
              }}>
                <span className="currency-symbol" style={{ fontSize: '1.4rem', fontWeight: 600, marginRight: 'var(--space-sm)' }}>₹</span>
                <input
                  className="amount-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="₹xx + ₹x"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  onBlur={() => handleMathBlurOrEnter(totalAmount, setTotalAmount)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleMathBlurOrEnter(totalAmount, setTotalAmount);
                    }
                  }}
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    width: '100%',
                    textAlign: 'left'
                  }}
                />
              </div>
            </div>

            {/* Itemised Items dynamic list */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <label style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Itemised Items
                </label>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleAddItem}
                  style={{
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-xs)'
                  }}
                >
                  + Add Item
                </button>
              </div>

              <div className="items-list-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <AnimatePresence initial={false}>
                  {rows.map((row, index) => {
                    const rowSum = parseFloat(row.amount) || 0;
                    const rowPerPerson = row.splitAmong && row.splitAmong.length > 0 && rowSum > 0
                      ? (rowSum / row.splitAmong.length).toFixed(2)
                      : '0';

                    return (
                      <motion.div
                        key={row.id}
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="card"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: 'var(--space-md)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Remove Row Button */}
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(row.id)}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              border: 'none',
                              background: 'rgba(255, 107, 107, 0.15)',
                              color: 'var(--danger)',
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              zIndex: 10
                            }}
                            aria-label="Remove item"
                          >
                            &times;
                          </button>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                          {/* Category select and Amount input */}
                          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <div style={{ flex: 1.2 }}>
                              <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Category</label>
                              <select
                                className="input select-input"
                                value={row.categoryId}
                                onChange={(e) => handleUpdateRowField(row.id, 'categoryId', e.target.value)}
                                style={{
                                  padding: '8px var(--space-sm)',
                                  fontSize: 'var(--font-sm)',
                                  background: 'var(--bg-input)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--radius-sm)',
                                  width: '100%'
                                }}
                              >
                                {sortedCategories.map(c => (
                                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Amount</label>
                              <input
                                className="input"
                                type="text"
                                inputMode="decimal"
                                placeholder="₹0"
                                value={row.amount}
                                onChange={(e) => handleUpdateRowField(row.id, 'amount', e.target.value)}
                                onBlur={() => handleRowMathBlur(row.id, row.amount)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleRowMathBlur(row.id, row.amount);
                                  }
                                }}
                                style={{
                                  padding: '8px var(--space-sm)',
                                  fontSize: 'var(--font-sm)',
                                  background: 'var(--bg-input)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--radius-sm)',
                                  width: '100%'
                                }}
                              />
                            </div>
                          </div>

                          {/* Description */}
                          <div>
                            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Description</label>
                            <input
                              className="input"
                              placeholder="e.g. Snacks, Drinks..."
                              value={row.description}
                              onChange={(e) => handleUpdateRowField(row.id, 'description', e.target.value)}
                              style={{
                                padding: '8px var(--space-sm)',
                                fontSize: 'var(--font-sm)',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                width: '100%'
                              }}
                            />
                          </div>

                          {/* Split Among (Shared Rooms only) */}
                          {!isPersonal && (
                            <div style={{ marginTop: '4px' }}>
                              <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                Split Among
                              </label>
                              <div className="user-select-row" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {users.map(user => {
                                  const isSelected = row.splitAmong.includes(user.id);
                                  return (
                                    <button
                                      key={user.id}
                                      type="button"
                                      className={`user-select-btn ${isSelected ? 'active' : ''}`}
                                      onClick={() => handleToggleRowSplit(row.id, user.id)}
                                      style={{
                                        '--user-color': user.color,
                                        padding: '4px 8px',
                                        minWidth: 'auto',
                                        flex: '0 0 auto',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <div className="avatar" style={{ background: user.color, width: '18px', height: '18px', fontSize: '0.65rem' }}>
                                        {isSelected ? '✓' : user.name[0]}
                                      </div>
                                      <span>{user.name.split(' ')[0]}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {row.splitAmong.length > 0 && rowSum > 0 && (
                                <p className="split-info" style={{ margin: '4px 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                                  ₹{rowPerPerson} per person
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Remaining amount display bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-lg)',
              padding: 'var(--space-md) var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              background: isRemainingZero ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: isRemainingZero ? '1px solid rgba(0, 206, 201, 0.3)' : '1px solid rgba(255, 107, 107, 0.3)',
              color: isRemainingZero ? 'var(--success)' : 'var(--danger)',
              fontWeight: 600,
              fontSize: 'var(--font-sm)',
              transition: 'all 0.25s ease'
            }}>
              <span>Remaining to Split:</span>
              <span style={{ fontSize: 'var(--font-md)', fontWeight: 700 }}>
                <CountUp value={remaining} decimals={2} prefix="₹" />
              </span>
            </div>

            {error && <p className="error-text" style={{ marginBottom: 'var(--space-md)' }}>{error}</p>}

            <motion.button
              className={`btn btn-primary btn-full add-expense-btn ${showSuccess ? 'btn-success-state' : ''}`}
              type="submit"
              disabled={loading || showSuccess || !isRemainingZero}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              {loading ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block' }}
                >
                  ⏳
                </motion.span>
              ) : showSuccess ? '✅ Added!' : '🥞 Confirm & Add Expenses'}
            </motion.button>
          </motion.form>
        )}

      </div>
    </>
  );
}
