import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import { useRoomContext } from '../../context/RoomContext';
import { useExpenseForm } from '../../hooks/useExpenseForm';
import { useSuccessState } from '../../hooks/useSuccessState';
import { addExpense, addItemisedExpenseGroup } from '../../services/expenseService';
import { validateExpense, adjustDate } from '../../utils/expenseFormHelpers';
import CountUp from '../common/CountUp';
import { getLastUsedMode, setLastUsedMode, getLastUsedDefaults, setLastUsedDefaults } from '../../utils/lastUsedDefaults';
import { getRecentDescriptions, addRecentDescription } from '../../utils/recentDescriptions';
import { detectRecurringExpenses } from '../../utils/recurringExpenses';
import './Expenses.css';

// Animated math placeholder examples
const MATH_EXAMPLES = ['50+20=70', '120-45=75', '15×4=60', '400÷8=50', '80+30=110'];

// eslint-disable-next-line no-unused-vars
function AnimatedAmountInput({ value, onChange, onBlur, onKeyDown, id, style, className, inputRef }) {
  const [exIdx, setExIdx] = useState(0);
  const [exVisible, setExVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setExVisible(false);
      setTimeout(() => { setExIdx(p => (p + 1) % MATH_EXAMPLES.length); setExVisible(true); }, 320);
    }, 2800);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <input
        ref={inputRef}
        className={className || 'amount-input'}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        id={id}
        style={style}
        autoComplete="off"
      />
      {!value && (
        <span
          className="math-animated-placeholder"
          style={{
            position: 'absolute',
            top: '50%',
            left: style?.textAlign === 'left' ? '0' : '50%',
            transform: style?.textAlign === 'left' ? 'translateY(-50%)' : 'translate(-50%, -50%)',
            opacity: exVisible ? 0.35 : 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            color: 'var(--text-tertiary)',
            letterSpacing: 'inherit',
          }}
        >
          {MATH_EXAMPLES[exIdx]}
        </span>
      )}
    </div>
  );
}

// Simple animated placeholder overlay for amount inputs (no value)
function AmountPlaceholderOverlay({ align = 'center', size }) {
  const [exIdx, setExIdx] = useState(0);
  const [exVisible, setExVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setExVisible(false);
      setTimeout(() => { setExIdx(p => (p + 1) % MATH_EXAMPLES.length); setExVisible(true); }, 300);
    }, 2800);
    return () => clearInterval(iv);
  }, []);

  return (
    <span style={{
      position: 'absolute',
      top: '50%',
      left: align === 'left' ? '0' : '50%',
      transform: align === 'left' ? 'translateY(-50%)' : 'translate(-50%, -50%)',
      opacity: exVisible ? 0.32 : 0,
      transition: 'opacity 0.3s ease',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      fontSize: size || 'inherit',
      fontWeight: 'inherit',
      color: 'var(--text-tertiary)',
      letterSpacing: 'inherit',
    }}>
      {MATH_EXAMPLES[exIdx]}
    </span>
  );
}

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
  cig: 'Smoking/Cigarettes', cigs: 'Smoking/Cigarettes', cigarette: 'Smoking/Cigarettes', cigarettes: 'Smoking/Cigarettes', sutta: 'Smoking/Cigarettes', bidi: 'Smoking/Cigarettes', hookah: 'Smoking/Cigarettes',
  beer: 'Alcohol', wine: 'Alcohol', whiskey: 'Alcohol', vodka: 'Alcohol', rum: 'Alcohol',
  daaru: 'Alcohol', drinks: 'Alcohol', alcohol: 'Alcohol', breezer: 'Alcohol'
};

// Category Merchant regex patterns mapping
// eslint-disable-next-line no-unused-vars
const CATEGORY_REGEX_MAP = {
  'Groceries': /zepto|blinkit|bigbasket|kirana|doodh|milk|instamart|reliance|safal|grofers|supermarket|grocery|groceries|sabzi|aata|dal|rice/i,
  'Food & Dining': /zomato|swiggy|biryani|pizza|burger|chai|coffee|starbucks|restaurant|cafe|dhaba|dominos|mcdonald|kfc|pizza\s*hut|food|dinner|lunch|breakfast|tea|canteen/i,
  'Transportation': /uber|ola|rapido|metro|rickshaw|cab|taxi|auto|petrol|diesel|fuel|toll|cng|fastag|train|flight|bus/i,
  'Entertainment': /netflix|spotify|prime|movie|cinema|theater|ticket|concert|hotstar|youtube|game|bookmyshow|playstation|xbox|nintendo|steam/i,
  'Utilities': /rent|electricity|bijli|water|gas|internet|wifi|wi-fi|broadband|recharge|mobile|phone|dth|bill|insurance|maintenance/i,
  'Smoking/Cigarettes': /cig|cigarette|cigarettes|sutta|bidi|pan|hookah/i,
  'Alcohol': /beer|wine|whiskey|vodka|rum|daaru|drinks|alcohol|breezer|bar|pub|club|liquor/i
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
  } catch {
    // Ignore evaluation errors
  }
  return null;
};

export default function AddExpense() {
  const { roomCode, room, expenses, users, categories, userIdentity } = useRoomContext();
  const isPersonal = room?.isPersonal === true;

  const amountInputRef = useRef(null);
  const focusedAmountRef = useRef(null); // tracks which amount input is currently focused

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
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error'); // 'error' | 'success'
  const [isResetting, setIsResetting] = useState(false);
  const [isCategoryPulsing, setIsCategoryPulsing] = useState(false);
  const [fillAnimation, setFillAnimation] = useState({ scale: 1 });

  const triggerCategoryPulse = () => {
    setIsCategoryPulsing(true);
    setTimeout(() => setIsCategoryPulsing(false), 800);
  };

  const triggerFillPulse = () => {
    setFillAnimation({ 
      scale: [1, 1.04, 0.98, 1],
      boxShadow: ['0 0 0px rgba(108, 92, 231, 0)', '0 0 20px rgba(108, 92, 231, 0.45)', '0 0 0px rgba(108, 92, 231, 0)']
    });
    setTimeout(() => setFillAnimation({ scale: 1, boxShadow: 'none' }), 400);
  };
  const [mathToolbarVisible, setMathToolbarVisible] = useState(false);
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);
  const [visualViewportBottom, setVisualViewportBottom] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    const updateViewport = () => {
      const offsetBottom = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
      setVisualViewportBottom(offsetBottom > 0 ? offsetBottom : 0);
    };

    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
    updateViewport();

    const interval = setInterval(updateViewport, 200);

    return () => {
      window.visualViewport.removeEventListener('resize', updateViewport);
      window.visualViewport.removeEventListener('scroll', updateViewport);
      clearInterval(interval);
    };
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(''), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Math toolbar focus tracking
  const handleAmountFocus = useCallback((inputEl) => {
    focusedAmountRef.current = inputEl;
    setMathToolbarVisible(true);
    setIsNumpadOpen(true);
  }, []);

  const handleAmountBlur = useCallback(() => {
    // Short delay so toolbar button clicks register before hiding
    setTimeout(() => {
      const active = document.activeElement;
      const isAmountInput = active?.classList.contains('amount-input') ||
        active?.classList.contains('amount-input-field') ||
        active?.id?.startsWith('input-amount') ||
        active?.id === 'input-total-amount';
      if (!isAmountInput) {
        setMathToolbarVisible(false);
        setIsNumpadOpen(false);
      }
    }, 180);
  }, []);

  const insertMathOp = useCallback((op) => {
    const input = focusedAmountRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    const newVal = before + op + after;
    // Use native input value setter to trigger React's onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, newVal);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Move cursor after inserted op
    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + op.length;
      input.setSelectionRange(cursor, cursor);
    });
  }, []);

  // Helper: apply jitter to a DOM element by id or selector
  const jitterEl = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.remove('jitter');
    void el.offsetWidth; // force reflow so animation restarts
    el.classList.add('jitter');
    setTimeout(() => el.classList.remove('jitter'), 400);
  };

  // Split Transaction Mode States
  const [totalAmount, setTotalAmount] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isSticky, setIsSticky] = useState(false);
  const stickyAnchorRef = useRef(null); // ref on expense name field wrapper
  const [globalPaidBy, setGlobalPaidBy] = useState(() => {
    return defaults.paidBy || userIdentity || (users[0]?.id || '');
  });
  const [rows, setRows] = useState([]);

  // Use IntersectionObserver to detect when Expense Name field leaves viewport
  // — triggers sticky header only when the actual fields are scrolled away
  useEffect(() => {
    if (mode !== 'split') {
      Promise.resolve().then(() => {
        setIsSticky(false);
      });
      return;
    }
    const anchor = stickyAnchorRef.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      {
        root: null, // viewport
        rootMargin: '-60px 0px 0px 0px', // account for header height
        threshold: 0,
      }
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, [mode]);

  // Sort categories based on recent/frequent criteria
  const sortedCategories = useMemo(() => getSortedCategories(categories, expenses), [categories, expenses]);

  // Sync mode state when room changes
  useEffect(() => {
    if (roomCode) {
      const savedMode = getLastUsedMode(roomCode);
      Promise.resolve().then(() => {
        setMode(savedMode);
      });
    }
  }, [roomCode]);

  // Handle defaults and initial row setup in Split mode when roomCode/users load
  useEffect(() => {
    if (!roomCode) return;
    const roomDefaults = getLastUsedDefaults(roomCode);
    const defaultCatId = roomDefaults.categoryId || categories[0]?.id || 'cat-1';
    const defaultSplit = roomDefaults.splitAmong || users.map(u => u.id);

    Promise.resolve().then(() => {
      setGlobalPaidBy(roomDefaults.paidBy || userIdentity || (users[0]?.id || ''));
      setRows([
        {
          id: 'item_initial_' + Date.now(),
          categoryId: defaultCatId,
          description: '',
          amount: '',
          splitAmong: isPersonal ? [] : defaultSplit,
        }
      ]);
    });
  }, [roomCode, categories, users, isPersonal, userIdentity]);

  // Quick mode: live-filtered recent descriptions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recentDescs = useMemo(() => getRecentDescriptions(roomCode), [roomCode, showSuccess]);
  const filteredChips = recentDescs;

  // Recurring Expenses detection
  const recurringExpensesList = useMemo(() => detectRecurringExpenses(expenses), [expenses]);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Extract unique group names from itemised expenses and count their frequency
  const itemisedGroupNamesList = useMemo(() => {
    const frequency = {};
    expenses.forEach(e => {
      if (e.isItemised && e.groupName) {
        const name = e.groupName.trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!frequency[key]) {
          frequency[key] = {
            groupName: name,
            count: 0,
            categoryId: e.categoryId || null,
          };
        }
        frequency[key].count += 1;
      }
    });

    return Object.values(frequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [expenses]);

  const handleRecurringChipTap = (chip) => {
    if (mode !== 'quick') {
      handleModeChange('quick');
    }

    setField.description(chip.description);
    setField.categoryId(chip.categoryId);
    setField.amount(String(chip.lastAmount));
    setField.date(todayStr);

    if (!isPersonal) {
      if (chip.lastPaidBy) {
        setField.paidBy(chip.lastPaidBy);
      }
      if (chip.lastSplitAmong && chip.lastSplitAmong.length > 0) {
        setField.splitAmong(chip.lastSplitAmong);
      }
    }

    triggerFillPulse();
  };

  // Split mode math calculations
  const sumOfRows = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = parseFloat(((parseFloat(totalAmount) || 0) - sumOfRows).toFixed(2));
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

  // Description input handler: triggers Hinglish keyword mapping for category auto-select
  const handleDescriptionChange = (val) => {
    setField.description(val);

    const lowerVal = val.toLowerCase();
    for (const [keyword, categoryName] of Object.entries(HINGLISH_MAP)) {
      if (lowerVal.includes(keyword)) {
        const matchedCat = findMatchingCategory(categoryName, categories);
        if (matchedCat) {
          if (form.categoryId !== matchedCat.id) {
            setField.categoryId(matchedCat.id);
            triggerCategoryPulse();
            triggerFillPulse();
          }
          break; // Exit on first match
        }
      }
    }
  };

  // Select a recent description chip
  const handleChipTap = (desc) => {
    setField.description(desc);
    triggerFillPulse();

    // Check Hinglish mapping for selected chip
    const lowerDesc = desc.toLowerCase();
    for (const [keyword, categoryName] of Object.entries(HINGLISH_MAP)) {
      if (lowerDesc.includes(keyword)) {
        const matchedCat = findMatchingCategory(categoryName, categories);
        if (matchedCat) {
          if (form.categoryId !== matchedCat.id) {
            setField.categoryId(matchedCat.id);
            triggerCategoryPulse();
          }
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
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated = { ...r, [field]: value };
      if (field === 'description' && value) {
        const lowerVal = value.toLowerCase();
        for (const [keyword, categoryName] of Object.entries(HINGLISH_MAP)) {
          if (lowerVal.includes(keyword)) {
            const matchedCat = findMatchingCategory(categoryName, categories);
            if (matchedCat) {
              updated.categoryId = matchedCat.id;
              break;
            }
          }
        }
      }
      return updated;
    }));
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

    // Collect missing mandatory fields
    const missing = [];
    if (!form.amount || parseFloat(form.amount) <= 0) missing.push('Amount');
    if (!form.description || form.description.trim() === '') missing.push('Description');
    if (!form.categoryId) missing.push('Category');

    if (missing.length > 0) {
      setToastType('error');
      setToastMessage(`Missing: ${missing.join(', ')}`);
      if (missing.includes('Amount')) jitterEl('.amount-field');
      if (missing.includes('Description')) jitterEl('#input-description');
      if (missing.includes('Category')) jitterEl('.category-scroll-strip');
      return;
    }

    // Extra shared-room validations
    const validationError = validateExpense(form, isPersonal);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
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

      triggerSuccess();
      // Success toast
      setToastType('success');
      setToastMessage('✅ Expense added!');
      setIsResetting(true);
      setTimeout(() => {
        resetForm();
        setIsResetting(false);
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  // Split Transaction Submit
  const handleSplitSubmit = async (e) => {
    e.preventDefault();

    const missing = [];
    if (!groupName.trim()) {
      missing.push('Expense Name');
      jitterEl('#input-group-name');
    }
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      missing.push('Total Amount');
      jitterEl('.amount-field');
    }
    if (!isPersonal && !globalPaidBy) missing.push('Paid By');
    if (rows.length === 0) missing.push('At least one item');
    if (!isRemainingZero) missing.push(`Remaining ₹${remaining} must be ₹0`);

    // Row-level mandatory checks
    rows.forEach((row, i) => {
      if (!row.description || row.description.trim() === '') missing.push(`Item ${i + 1} Description`);
      if (!row.amount || parseFloat(row.amount) <= 0) missing.push(`Item ${i + 1} Amount`);
      if (!isPersonal && (!row.splitAmong || row.splitAmong.length === 0))
        missing.push(`Item ${i + 1} Split Among`);
    });

    if (missing.length > 0) {
      setToastMessage(`Missing: ${missing.join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payerId = isPersonal ? (users[0]?.id || '') : globalPaidBy;
      const items = rows.map(row => ({
        description: row.description.trim() || groupName.trim(),
        amount: parseFloat(row.amount),
        categoryId: row.categoryId,
        splitAmong: isPersonal ? [payerId] : row.splitAmong,
      }));

      const commonFields = {
        paidBy: payerId,
        date: form.date,
      };

      await addItemisedExpenseGroup(roomCode, groupName.trim(), items, commonFields, room);

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
      // Success toast
      setToastType('success');
      setToastMessage('✅ Split expenses added!');
      setIsResetting(true);
      setTimeout(() => {
        // Reset Split form values
        setTotalAmount('');
        setGroupName('');
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
        setIsResetting(false);
      }, 1000);

    } catch (err) {
      setError(err.message || 'Failed to save split transaction');
    } finally {
      setLoading(false);
    }
  };

  const currentActiveCategory = sortedCategories.find(c => c.id === form.categoryId);

  // Quick-form: button disabled when mandatory fields empty
  const quickFormIncomplete =
    !form.amount ||
    parseFloat(form.amount) <= 0 ||
    !form.description?.trim() ||
    !form.categoryId;

  return (
    <>
      {/* Sticky Sub-header for Split/Itemised mode — shows only when Expense Name scrolled out */}
      <AnimatePresence>
        {mode === 'split' && isSticky && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.22, type: 'spring', stiffness: 340, damping: 28 }}
            style={{
              position: 'fixed',
              top: 'calc(var(--safe-area-top) + var(--header-height))',
              left: 0,
              right: 0,
              zIndex: isNumpadOpen ? 5 : 100,
              background: 'rgba(20, 20, 38, 0.88)',
              borderBottom: '1px solid var(--border-light)',
              padding: '9px var(--space-lg)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              opacity: isNumpadOpen ? 0 : 1,
              pointerEvents: isNumpadOpen ? 'none' : 'auto',
              transition: 'opacity 0.2s ease, z-index 0.2s ease'
            }}
          >
            {/* Name • Amount pill format */}
            <span style={{
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              {groupName.trim() ? (
                <>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>
                    {groupName}
                  </span>
                  {totalAmount && parseFloat(totalAmount) > 0 && (
                    <>
                      <span style={{ opacity: 0.4, flexShrink: 0 }}>•</span>
                      <span style={{ color: 'var(--accent-light)', fontWeight: 700, flexShrink: 0 }}>
                        ₹{parseFloat(totalAmount).toLocaleString('en-IN')}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>Split Expense</span>
              )}
            </span>
            {/* Remaining indicator if not zero */}
            {!isRemainingZero && totalAmount && parseFloat(totalAmount) > 0 && (
              <span style={{
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                color: 'var(--danger)',
                flexShrink: 0,
                marginLeft: 'var(--space-sm)',
              }}>
                ₹{Math.abs(remaining).toFixed(0)} left
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast — error or success */}
      <AnimatePresence>
        {toastMessage && toastType === 'success' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(10, 10, 25, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 200,
            }}
          />
        )}
        {toastMessage && (
          toastType === 'success' ? (
            <motion.div
              key="success-toast"
              initial={{ opacity: 0, scale: 0.8, x: '-50%', y: '-35%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.8, x: '-50%', y: '-35%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                zIndex: 210,
                width: 'calc(100% - 48px)',
                maxWidth: '340px',
              }}
            >
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(0, 206, 201, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-xl)',
                textAlign: 'center',
                boxShadow: 'var(--shadow-lg), 0 0 30px rgba(0, 206, 201, 0.2)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}>
                <svg width="64" height="64" viewBox="0 0 100 100" style={{ margin: '0 auto var(--space-md) auto', display: 'block' }}>
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="var(--success)"
                    strokeWidth="6"
                    fill="transparent"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <motion.path
                    d="M32 52 L45 65 L68 35"
                    stroke="var(--success)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="transparent"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
                  />
                </svg>
                <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--success)', marginBottom: '8px', marginTop: 0 }}>
                  Success!
                </h3>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                  {toastMessage}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="error-toast"
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: 'calc(var(--safe-area-top) + var(--header-height) + 8px)',
                left: '50%',
                zIndex: 210,
                width: 'calc(100% - 32px)',
                maxWidth: '380px',
              }}
            >
              <div className="toast" style={{
                borderColor: 'rgba(255,107,107,0.4)',
                color: 'var(--danger)',
              }}>
                <span>{toastMessage}</span>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      <Header 
        title="Add Expense" 
        style={{
          opacity: isNumpadOpen ? 0 : 1,
          zIndex: isNumpadOpen ? 5 : 40,
          pointerEvents: isNumpadOpen ? 'none' : 'auto',
          transition: 'opacity 0.2s ease, z-index 0.2s ease'
        }}
      />
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
            🥞 Split
          </button>
        </div>

        {/* Recurring Expense Chips — shown in Quick mode only */}
        {mode === 'quick' && recurringExpensesList.length > 0 && (
          <div className="recurring-chips-container" style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            overflowX: 'auto',
            paddingBottom: '12px',
            marginBottom: 'var(--space-lg)',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            borderBottom: '1px solid var(--border-light)'
          }}>
            {recurringExpensesList.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleRecurringChipTap(chip)}
                className="chip clickable"
                style={{
                  whiteSpace: 'nowrap',
                  background: 'rgba(108, 92, 231, 0.08)',
                  borderColor: 'rgba(108, 92, 231, 0.25)',
                  color: 'var(--accent-light)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <span>{chip.description}</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span>₹{chip.lastAmount}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick Expense Form */}
        {mode === 'quick' && (
          <motion.form
            key="quick-form"
            className="expense-form"
            onSubmit={handleQuickSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ opacity: isResetting ? 0.5 : 1, transition: 'opacity 0.3s ease', pointerEvents: isResetting ? 'none' : 'auto' }}
          >
            {/* Amount with steppers */}
            <motion.div
              className="amount-input-wrapper amount-field"
              style={{ marginBottom: 'var(--space-lg)' }}
              animate={fillAnimation}
              transition={{ duration: 0.35, delay: 0.25 }}
            >
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
                <div style={{ position: 'relative' }}>
                  <input
                    ref={el => {
                      amountInputRef.current = el;
                      if (el) el.addEventListener('focus', () => handleAmountFocus(el), { once: false });
                    }}
                    className="amount-input"
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setField.amount(e.target.value)}
                    onFocus={(e) => handleAmountFocus(e.target)}
                    onBlur={() => { handleMathBlurOrEnter(form.amount, setField.amount); handleAmountBlur(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleMathBlurOrEnter(form.amount, setField.amount);
                      }
                    }}
                    id="input-amount"
                    autoComplete="off"
                  />
                  {!form.amount && (
                    <AmountPlaceholderOverlay align="center" />
                  )}
                </div>
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
            </motion.div>

            {/* Description with filtered chip list */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label>Description</label>

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

              <motion.input
                className="input"
                placeholder="e.g. Groceries, Electricity bill..."
                value={form.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                id="input-description"
                animate={fillAnimation}
                transition={{ duration: 0.35, delay: 0.20 }}
              />

            </div>

            {/* Date with steppers */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label>Date</label>
              <motion.div
                className="date-stepper"
                animate={fillAnimation}
                transition={{ duration: 0.35, delay: 0.15 }}
              >
                <button type="button" className="stepper-btn" onClick={() => setField.date(adjustDate(form.date, -1))}>−</button>
                <input
                  className="input date-input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setField.date(e.target.value)}
                  id="input-date"
                />
                <button type="button" className="stepper-btn" onClick={() => setField.date(adjustDate(form.date, 1))}>+</button>
              </motion.div>
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
              <motion.div
                className={`category-scroll-strip${isCategoryPulsing ? ' category-pulse' : ''}`}
                animate={fillAnimation}
                transition={{ duration: 0.35, delay: 0.10 }}
                style={{ display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto', paddingBottom: '4px' }}
              >
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
              </motion.div>
            </div>

            {/* Paid By — hidden in personal mode */}
            {!isPersonal && (
              <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label>Paid By</label>
                <motion.div
                  className="user-select-row"
                  animate={fillAnimation}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}
                >
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
                </motion.div>
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
                <motion.div
                  className="user-select-row"
                  animate={fillAnimation}
                  transition={{ duration: 0.35, delay: 0 }}
                  style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}
                >
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
                </motion.div>
                {form.splitAmong.length > 0 && form.amount && (
                  <p className="split-info">₹{perPerson} per person</p>
                )}
              </div>
            )}

            {error && <p className="error-text" style={{ marginBottom: 'var(--space-md)' }}>{error}</p>}

            <motion.button
              className={`btn btn-primary btn-full add-expense-btn ${showSuccess ? 'btn-success-state' : ''}`}
              type="submit"
              disabled={loading || showSuccess || quickFormIncomplete}
              whileTap={{ scale: quickFormIncomplete ? 1 : 0.95 }}
              whileHover={{ scale: quickFormIncomplete ? 1 : 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{ opacity: quickFormIncomplete ? 0.5 : 1, transition: 'opacity 0.2s' }}
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
            style={{ opacity: isResetting ? 0.5 : 1, transition: 'opacity 0.3s ease', pointerEvents: isResetting ? 'none' : 'auto' }}
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

            {/* Expense Name Field — stickyAnchorRef watches this for sticky header */}
            <div
              ref={stickyAnchorRef}
              className="input-group"
              style={{ marginBottom: 'var(--space-lg)' }}
              id="input-group-name-wrapper"
            >
              <label>Expense Name <span style={{ color: 'var(--accent-red)' }}>*</span></label>
              {itemisedGroupNamesList.length > 0 && (
                <div className="recent-chips-container" style={{
                  display: 'flex',
                  gap: 'var(--space-sm)',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  marginBottom: '6px',
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {itemisedGroupNamesList.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setGroupName(chip.groupName);
                        setTotalAmount('');
                        if (chip.categoryId && rows.length > 0) {
                          setRows(prev => prev.map(r => ({ ...r, categoryId: chip.categoryId })));
                        }
                      }}
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
                      {chip.groupName}
                    </button>
                  ))}
                </div>
              )}
              <input
                className="input"
                placeholder="e.g. Zepto Order, Dinner, Fuel..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                id="input-group-name"
              />
            </div>

            {/* Total Amount Field */}
            <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label>Total Amount</label>
              <div className="amount-center amount-field" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px var(--space-md)'
              }}>
                <span className="currency-symbol" style={{ fontSize: '1.4rem', fontWeight: 600, marginRight: 'var(--space-sm)' }}>₹</span>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    className="amount-input"
                    type="text"
                    inputMode="decimal"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    onFocus={(e) => handleAmountFocus(e.target)}
                    onBlur={() => { handleMathBlurOrEnter(totalAmount, setTotalAmount); handleAmountBlur(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleMathBlurOrEnter(totalAmount, setTotalAmount);
                      }
                    }}
                    id="input-total-amount"
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      width: '100%',
                      textAlign: 'left'
                    }}
                    autoComplete="off"
                  />
                  {!totalAmount && (
                    <AmountPlaceholderOverlay align="left" size="1.4rem" />
                  )}
                </div>
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
                          {/* Item Numbering */}
                          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                            Item {rows.length - index}
                          </div>

                          {/* Recurring suggestions for this item (top 3) */}
                          {recurringExpensesList.length > 0 && (
                            <div style={{
                              display: 'flex',
                              gap: '6px',
                              overflowX: 'auto',
                              paddingBottom: '2px',
                              scrollbarWidth: 'none',
                            }}>
                              {recurringExpensesList.slice(0, 3).map((chip, ci) => (
                                <button
                                  key={ci}
                                  type="button"
                                  onClick={() => {
                                    handleUpdateRowField(row.id, 'description', chip.description);
                                    handleUpdateRowField(row.id, 'categoryId', chip.categoryId);
                                    handleUpdateRowField(row.id, 'amount', String(chip.lastAmount));
                                  }}
                                  style={{
                                    whiteSpace: 'nowrap',
                                    background: 'rgba(108, 92, 231, 0.08)',
                                    borderColor: 'rgba(108, 92, 231, 0.2)',
                                    border: '1px solid rgba(108, 92, 231, 0.2)',
                                    color: 'var(--accent-light)',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                  }}
                                >
                                  <span>{chip.description}</span>
                                  <span style={{ opacity: 0.5 }}>|</span>
                                  <span>₹{chip.lastAmount}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Description — mandatory */}
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

                          {/* Category + Amount row */}
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
                              <div style={{ position: 'relative' }}>
                                <input
                                  className="input"
                                  type="text"
                                  inputMode="decimal"
                                  value={row.amount}
                                  onChange={(e) => handleUpdateRowField(row.id, 'amount', e.target.value)}
                                  onFocus={(e) => handleAmountFocus(e.target)}
                                  onBlur={() => { handleRowMathBlur(row.id, row.amount); handleAmountBlur(); }}
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
                                  autoComplete="off"
                                />
                                {!row.amount && (
                                  <span style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '8px',
                                    transform: 'translateY(-50%)',
                                    pointerEvents: 'none',
                                    fontSize: 'var(--font-xs)',
                                    color: 'var(--text-tertiary)',
                                    opacity: 0.5,
                                  }}>₹0</span>
                                )}
                              </div>
                            </div>
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

            {/* Remaining to split — STICKY BAR above bottom nav */}
            <AnimatePresence>
              {!isRemainingZero && totalAmount && parseFloat(totalAmount) > 0 && (
                <motion.div
                  className="remaining-sticky-bar"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ 
                    opacity: (isNumpadOpen && remaining > 0) ? 0 : 1, 
                    y: (isNumpadOpen && remaining > 0) ? 20 : 0 
                  }}
                  exit={{ opacity: 0, y: 30, transition: { duration: 0.2, ease: 'easeIn' } }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{
                    pointerEvents: (isNumpadOpen && remaining > 0) ? 'none' : 'auto'
                  }}
                >
                  <span>Remaining to Split</span>
                  <span className="remaining-sticky-amount">
                    <CountUp value={remaining} decimals={2} prefix="₹" />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inline remaining for zero state confirmation */}
            {isRemainingZero && totalAmount && parseFloat(totalAmount) > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-lg)',
                padding: 'var(--space-md) var(--space-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--success-bg)',
                border: '1px solid rgba(0, 206, 201, 0.3)',
                color: 'var(--success)',
                fontWeight: 600,
                fontSize: 'var(--font-sm)',
              }}>
                <span>✓ Fully split</span>
                <span style={{ fontSize: 'var(--font-md)', fontWeight: 700 }}>
                  <CountUp value={0} decimals={2} prefix="₹" />
                </span>
              </div>
            )}

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

        {/* Math Toolbar — floats above bottom nav when amount field is focused */}
        <AnimatePresence>
          {mathToolbarVisible && (
            <motion.div
              className="math-toolbar"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40, transition: { duration: 0.2, ease: 'easeIn' } }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              style={{
                bottom: `${visualViewportBottom + 8}px`
              }}
            >
              {['+', '−', '×', '÷'].map(op => (
                <button
                  key={op}
                  type="button"
                  className="math-toolbar-btn"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur before insert
                    // Map display symbols to actual math operators
                    const opMap = { '−': '-', '×': '*', '÷': '/' };
                    insertMathOp(opMap[op] || op);
                  }}
                >
                  {op}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </>
  );
}
