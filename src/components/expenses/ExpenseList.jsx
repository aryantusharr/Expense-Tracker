import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import SwipeableItem from '../common/SwipeableItem';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import { useRoomContext } from '../../context/RoomContext';
import { deleteExpense, updateExpense } from '../../services/expenseService';
import { formatDate, formatCurrency, getTodayISO } from '../../utils/helpers';
import './Expenses.css';

export default function ExpenseList() {
  const { roomCode, expenses, users, categories } = useRoomContext();
  const [filter, setFilter] = useState('all');
  const [editModal, setEditModal] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  const catMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    if (filter === 'all') return expenses;
    return expenses.filter(e => e.paidBy === filter);
  }, [expenses, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(e => {
      const key = e.date || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => new Date(b) - new Date(a));
  }, [filtered]);

  const handleDelete = async (expenseId) => {
    try {
      await deleteExpense(roomCode, expenseId);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDeleteClick = (expense) => {
    setExpenseToDelete(expense);
  };

  return (
    <>
      <Header title="History" subtitle={`${filtered.length} expenses`} />
      <div className="page-content">
        {/* Filter */}
        <div className="filter-row">
          <button
            className={`chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {users.map(u => (
            <button
              key={u.id}
              className={`chip ${filter === u.id ? 'active' : ''}`}
              onClick={() => setFilter(u.id)}
            >
              {u.name}
            </button>
          ))}
        </div>

        {/* Expense List */}
        {grouped.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p className="empty-state-title">No expenses yet</p>
            <p className="empty-state-text">Start by adding your first shared expense</p>
          </div>
        ) : (
          grouped.map(([date, items]) => (
            <div key={date} style={{ marginBottom: 'var(--space-lg)' }}>
              <p className="section-title">{formatDate(date)}</p>
              <AnimatePresence mode="popLayout">
                {items.map((expense) => {
                  const payer = userMap[expense.paidBy];
                  const cat = catMap[expense.categoryId] || { icon: '📦', name: 'Other' };
                  return (
                    <motion.div
                      key={expense.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 500, 
                        damping: 40
                      }}
                    >
                      <SwipeableItem
                        onDelete={() => handleDeleteClick(expense)}
                        onEdit={() => setEditModal(expense)}
                      >
                        <div className="expense-item">
                          <div className="expense-icon">{cat.icon}</div>
                          <div className="expense-info">
                            <p className="expense-desc">{expense.description}</p>
                            <p className="expense-meta">
                              <span
                                className="expense-payer-dot"
                                style={{ background: payer?.color || '#888' }}
                              />
                              {payer?.name || 'Unknown'}
                              <span>•</span>
                              {expense.splitAmong?.length || 0} split
                            </p>
                          </div>
                          <span className="expense-amount">{formatCurrency(expense.amount)}</span>
                        </div>
                      </SwipeableItem>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <EditExpenseModal
        expense={editModal}
        users={users}
        categories={categories}
        roomCode={roomCode}
        onClose={() => setEditModal(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={() => handleDelete(expenseToDelete?.id)}
        title="Delete Expense"
        message={`Are you sure you want to delete "${expenseToDelete?.description}"? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true}
      />
    </>
  );
}

function EditExpenseModal({ expense, users, categories, roomCode, onClose }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitAmong, setSplitAmong] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expense) {
      setDescription(expense.description || '');
      setAmount(String(expense.amount || ''));
      setPaidBy(expense.paidBy || '');
      setSplitAmong(expense.splitAmong || []);
      setCategoryId(expense.categoryId || '');
      setDate(expense.date || getTodayISO());
    }
  }, [expense]);

  const handleSave = async () => {
    if (!expense) return;
    setLoading(true);
    try {
      await updateExpense(roomCode, expense.id, {
        description, amount: parseFloat(amount), paidBy, splitAmong, categoryId, date,
      });
      onClose();
    } catch (err) {
      console.error('Update failed:', err);
    }
    setLoading(false);
  };

  const adjustAmount = (delta) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(Math.max(0, current + delta)));
  };

  const adjustDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <Modal isOpen={!!expense} onClose={onClose} title="Edit Expense">
      {expense && (
        <div className="expense-form" style={{ paddingBottom: 'var(--space-xl)' }}>
          <div className="amount-input-wrapper" style={{ padding: 'var(--space-lg) 0' }}>
            <button type="button" className="amount-adj-btn" onClick={() => adjustAmount(-1)}>−</button>
            <div className="amount-center">
              <span className="currency-symbol">₹</span>
              <input
                className="amount-input"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <button type="button" className="amount-adj-btn" onClick={() => adjustAmount(1)}>+</button>
          </div>

          <div className="input-group">
            <label>Description</label>
            <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="input-group">
            <label>Date</label>
            <div className="date-stepper">
              <button type="button" className="stepper-btn" onClick={() => adjustDate(-1)}>−</button>
              <input className="input date-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              <button type="button" className="stepper-btn" onClick={() => adjustDate(1)}>+</button>
            </div>
          </div>

          <div className="input-group">
            <label>Category</label>
            <div className="category-scroll-strip">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-pill ${categoryId === cat.id ? 'selected' : ''}`}
                  onClick={() => setCategoryId(cat.id)}
                >
                  <span className="category-pill-icon">{cat.icon}</span>
                  <span className="category-pill-label">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label>Paid By</label>
            <div className="user-select-row">
              {users.map(u => (
                <button
                  key={u.id}
                  className={`user-select-btn ${paidBy === u.id ? 'active' : ''}`}
                  onClick={() => setPaidBy(u.id)}
                  style={{ '--user-color': u.color }}
                >
                  <div className="avatar avatar-sm" style={{ background: u.color }}>{u.name[0]}</div>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label>Split Among</label>
            <div className="user-select-row">
              {users.map(u => (
                <button
                  key={u.id}
                  className={`user-select-btn ${splitAmong.includes(u.id) ? 'active' : ''}`}
                  onClick={() => setSplitAmong(prev =>
                    prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                  )}
                  style={{ '--user-color': u.color }}
                >
                  <div className="avatar avatar-sm" style={{ background: u.color }}>
                    {splitAmong.includes(u.id) ? '✓' : u.name[0]}
                  </div>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: 'sticky', bottom: '-24px', background: 'var(--bg-card-solid)', padding: 'var(--space-md) 0 0 0', zIndex: 10, borderTop: '1px solid var(--border-light)', margin: 'var(--space-xl) -24px 0 -24px' }}>
            <div style={{ padding: '0 var(--space-2xl)' }}>
              <button className="btn btn-primary btn-full" onClick={handleSave} disabled={loading}>
                {loading ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
