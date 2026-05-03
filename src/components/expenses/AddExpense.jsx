import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import { useRoomContext } from '../../context/RoomContext';
import { addExpense } from '../../services/expenseService';
import { getTodayISO } from '../../utils/helpers';
import './Expenses.css';

export default function AddExpense() {
  const { roomCode, room, users, categories } = useRoomContext();
  const isPersonal = room?.isPersonal === true;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(users[0]?.id || '');
  const [splitAmong, setSplitAmong] = useState(users.map(u => u.id));
  const [categoryId, setCategoryId] = useState('cat-1');
  const [date, setDate] = useState(getTodayISO());
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const toggleSplit = (userId) => {
    setSplitAmong(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => setSplitAmong(users.map(u => u.id));
  const perPerson = splitAmong.length > 0 && amount
    ? (parseFloat(amount) / splitAmong.length).toFixed(2)
    : '0';

  // Adjust amount by delta
  const adjustAmount = (delta) => {
    const current = parseFloat(amount) || 0;
    const newVal = Math.max(0, current + delta);
    setAmount(String(newVal));
  };

  // Adjust date by days
  const adjustDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation
    if (!amount || parseFloat(amount) <= 0) { setError('Amount is mandatory'); return; }
    if (!isPersonal && !paidBy) { setError('Please select who paid'); return; }
    if (!isPersonal && splitAmong.length === 0) { setError('Please select at least one person to split with'); return; }
    if (!categoryId) { setError('Please select a category'); return; }
    if (!date) { setError('Date is mandatory'); return; }

    setLoading(true);
    setError('');
    try {
      await addExpense(roomCode, {
        description: description.trim() || 'Untitled',
        amount: parseFloat(amount),
        paidBy,
        splitAmong,
        categoryId,
        date,
      });
      setSuccess(true);
      setDescription('');
      setAmount('');
      setSplitAmong(users.map(u => u.id));
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to add expense');
    }
    setLoading(false);
  };

  // Generate gradient from member colors
  const allGradient = users.length >= 2
    ? `linear-gradient(135deg, ${users.map((u, i) => `${u.color} ${(i / (users.length - 1)) * 100}%`).join(', ')})`
    : users[0]?.color || 'var(--accent)';

  return (
    <>
      <Header title="Add Expense" />
      <div className="page-content">
        <motion.form
          className="expense-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Amount with +/- */}
          <div className="amount-input-wrapper">
            <button type="button" className="amount-adj-btn" onClick={() => adjustAmount(-1)}>−</button>
            <div className="amount-center">
              <span className="currency-symbol">₹</span>
              <input
                className="amount-input"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                id="input-amount"
              />
            </div>
            <button type="button" className="amount-adj-btn" onClick={() => adjustAmount(1)}>+</button>
          </div>

          {/* Description (optional) */}
          <div className="input-group">
            <label>Description <span className="optional-tag">(optional)</span></label>
            <input
              className="input"
              placeholder="e.g. Groceries, Electricity bill..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              id="input-description"
            />
          </div>

          {/* Date with +/- */}
          <div className="input-group">
            <label>Date</label>
            <div className="date-stepper">
              <button type="button" className="stepper-btn" onClick={() => adjustDate(-1)}>−</button>
              <input
                className="input date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                id="input-date"
              />
              <button type="button" className="stepper-btn" onClick={() => adjustDate(1)}>+</button>
            </div>
          </div>

          {/* Category — animated scrollable */}
          <div className="input-group">
            <label>Category</label>
            <div className="category-scroll-strip">
              {categories.map(cat => {
                const isSelected = categoryId === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    type="button"
                    className={`category-pill ${isSelected ? 'selected' : ''}`}
                    onClick={() => setCategoryId(cat.id)}
                    whileTap={{ scale: 0.92 }}
                    layout
                  >
                    <motion.span
                      className="category-pill-icon"
                      animate={{
                        scale: isSelected ? 1.4 : 1,
                        y: isSelected ? -4 : 0,
                      }}
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
          <div className="input-group">
            <label>Paid By</label>
            <div className="user-select-row">
              {users.map(user => (
                <button
                  key={user.id}
                  type="button"
                  className={`user-select-btn ${paidBy === user.id ? 'active' : ''}`}
                  onClick={() => setPaidBy(user.id)}
                  style={{ '--user-color': user.color }}
                >
                  <div className="avatar avatar-sm" style={{ background: user.color }}>
                    {user.name[0]}
                  </div>
                  <span>{user.name}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Split Among — hidden in personal mode */}
          {!isPersonal && (
          <div className="input-group">
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
            <div className="user-select-row">
              {users.map(user => (
                <button
                  key={user.id}
                  type="button"
                  className={`user-select-btn ${splitAmong.includes(user.id) ? 'active' : ''}`}
                  onClick={() => toggleSplit(user.id)}
                  style={{ '--user-color': user.color }}
                >
                  <div className="avatar avatar-sm" style={{ background: user.color }}>
                    {splitAmong.includes(user.id) ? '✓' : user.name[0]}
                  </div>
                  <span>{user.name}</span>
                </button>
              ))}
            </div>
            {splitAmong.length > 0 && amount && (
              <p className="split-info">₹{perPerson} per person</p>
            )}
          </div>
          )}

          {error && <p className="error-text">{error}</p>}

          {/* Modern Success State */}
          <AnimatePresence>
            {success && (
              <motion.div
                className="premium-success-overlay"
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
                exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              >
                <motion.div 
                  className="success-card"
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                >
                  <div className="success-icon-wrapper">
                    <motion.svg 
                      width="60" height="60" viewBox="0 0 60 60"
                      initial="hidden" animate="visible"
                    >
                      <motion.circle
                        cx="30" cy="30" r="28"
                        stroke="var(--success)"
                        strokeWidth="4"
                        fill="none"
                        variants={{
                          hidden: { pathLength: 0, opacity: 0 },
                          visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5 } }
                        }}
                      />
                      <motion.path
                        d="M18 30L26 38L42 22"
                        stroke="var(--success)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        variants={{
                          hidden: { pathLength: 0, opacity: 0 },
                          visible: { pathLength: 1, opacity: 1, transition: { duration: 0.3, delay: 0.4 } }
                        }}
                      />
                    </motion.svg>
                  </div>
                  <h3>Saved Successfully</h3>
                  <p>Your expense has been added to the room.</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            className={`btn btn-primary btn-full add-expense-btn ${success ? 'btn-success-state' : ''}`}
            type="submit"
            disabled={loading || success}
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
            ) : success ? '✅ Added!' : '💰 Add Expense'}
          </motion.button>
        </motion.form>
      </div>
    </>
  );
}
