import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import SwipeableItem from '../common/SwipeableItem';
import ConfirmModal from '../common/ConfirmModal';
import EditExpenseModal from './EditExpenseModal';
import { useRoomContext } from '../../context/RoomContext';
import { deleteExpense } from '../../services/expenseService';
import { formatDate, formatCurrency } from '../../utils/helpers';
import './Expenses.css';

export default function ExpenseList() {
  const { roomCode, room, expenses, users, categories } = useRoomContext();
  const [filter, setFilter] = useState('all');
  const [editModal, setEditModal] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [activeSlideId, setActiveSlideId] = useState(null);

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

  const monthlyGroups = useMemo(() => {
    const groups = {};
    filtered.forEach(e => {
      const dateObj = new Date(e.date);
      if (isNaN(dateObj.getTime())) return;

      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const dayKey = e.date || 'unknown';

      if (!groups[monthKey]) {
        groups[monthKey] = {
          label: dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          totalAmount: 0,
          transactionCount: 0,
          days: {}
        };
      }

      groups[monthKey].totalAmount += parseFloat(e.amount) || 0;
      groups[monthKey].transactionCount += 1;

      if (!groups[monthKey].days[dayKey]) {
        groups[monthKey].days[dayKey] = [];
      }
      groups[monthKey].days[dayKey].push(e);
    });

    const sortedMonths = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    sortedMonths.forEach(([, monthData]) => {
      monthData.sortedDays = Object.entries(monthData.days).sort(([a], [b]) => new Date(b) - new Date(a));
    });

    return sortedMonths;
  }, [filtered]);

  // Auto-expand the latest month on first load
  useEffect(() => {
    if (monthlyGroups.length > 0 && activeDropdownId === null) {
// eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveDropdownId(monthlyGroups[0][0]);
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyGroups]);

  const toggleMonth = (monthKey) => {
    setActiveDropdownId(prev => (prev === monthKey ? null : monthKey));
  };

  const handleDelete = async (expenseId) => {
    await deleteExpense(roomCode, expenseId, room).catch(() => {});
  };

  return (
    <>
      <Header title="History" subtitle={`${filtered.length} expenses`} />
      <div className="page-content">
        {/* Filter chips */}
        <div className="filter-row">
          <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          {users.map(u => (
            <button key={u.id} className={`chip ${filter === u.id ? 'active' : ''}`} onClick={() => setFilter(u.id)}>{u.name}</button>
          ))}
        </div>

        {/* Expense list */}
        {monthlyGroups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p className="empty-state-title">No expenses yet</p>
            <p className="empty-state-text">Start by adding your first shared expense</p>
          </div>
        ) : (
          monthlyGroups.map(([monthKey, monthData]) => {
            const isExpanded = activeDropdownId === monthKey;
            return (
              <div key={monthKey} className="month-group-container">
                <div className={`month-summary-card ${isExpanded ? 'expanded' : ''}`} onClick={() => toggleMonth(monthKey)}>
                  <div className="month-summary-info">
                    <h3 className="month-summary-title">{monthData.label}</h3>
                    <p className="month-summary-subtitle">{monthData.transactionCount} transactions</p>
                  </div>
                  <div className="month-summary-right">
                    <span className="month-summary-total">{formatCurrency(monthData.totalAmount)}</span>
                    <motion.div className="month-summary-chevron" animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </motion.div>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="content"
                      initial="collapsed"
                      animate="open"
                      exit="collapsed"
                      variants={{ open: { opacity: 1, height: "auto" }, collapsed: { opacity: 0, height: 0 } }}
                      transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                      className="month-days-container"
                    >
                      {monthData.sortedDays.map(([date, items]) => (
                        <div key={date} className="day-group">
                          <p className="section-title day-section-title">{formatDate(date)}</p>
                          <AnimatePresence mode="popLayout">
                            {items.map((expense) => {
                              const payer = userMap[expense.paidBy];
                              const cat = catMap[expense.categoryId] || { icon: '📦', name: 'Other' };
                              const isSynced = Boolean(expense.isSynced);
                              const content = (
                                <div className={`expense-item ${isSynced ? 'synced-expense-item' : ''}`}>
                                  <div className="expense-icon">{cat.icon}</div>
                                  <div className="expense-info">
                                    <p className="expense-desc">
                                      {expense.description}
                                      {isSynced && (
                                        <span className="synced-badge">
                                          🔄 Synced from {expense.syncedFromRoomName || expense.syncedFromRoomCode || 'Shared Room'}
                                        </span>
                                      )}
                                    </p>
                                    <p className="expense-meta">
                                      <span className="expense-payer-dot" style={{ background: payer?.color || '#888' }} />
                                      {payer?.name || 'Unknown'}
                                      {!isSynced && (
                                        <>
                                          <span>•</span>
                                          {expense.splitAmong?.length || 0} split
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  <span className="expense-amount">{formatCurrency(expense.amount)}</span>
                                </div>
                              );

                              return (
                                <motion.div
                                  key={expense.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                >
                                  {isSynced ? content : (
                                    <SwipeableItem
                                      isSwiped={activeSlideId === expense.id}
                                      onSwipeChange={(swiped) => setActiveSlideId(swiped ? expense.id : null)}
                                      onDelete={() => setExpenseToDelete(expense)}
                                      onEdit={() => setEditModal(expense)}
                                    >
                                      {content}
                                    </SwipeableItem>
                                  )}
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Modal — now a separate component */}
      <EditExpenseModal
        expense={editModal}
        users={users}
        categories={categories}
        roomCode={roomCode}
        room={room}
        onClose={() => setEditModal(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={() => {
          handleDelete(expenseToDelete?.id);
          setExpenseToDelete(null);
        }}
        title="Delete Expense"
        message={`Are you sure you want to delete "${expenseToDelete?.description}"? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true}
      />
    </>
  );
}
