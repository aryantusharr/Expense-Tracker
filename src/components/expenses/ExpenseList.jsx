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
  const isPersonal = room?.isPersonal === true;
  const [filter, setFilter] = useState('all');
  const [editModal, setEditModal] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [activeMonthId, setActiveMonthId] = useState(null);
  const [activeDateIds, setActiveDateIds] = useState([]);
  const [activeSlideId, setActiveSlideId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

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
      const dayEntries = Object.entries(monthData.days);
      const processedDays = dayEntries.map(([dayKey, dayExpenses]) => {
        const groupMap = {};
        const singles = [];

        dayExpenses.forEach(e => {
          if (e.isItemised && e.groupId) {
            if (!groupMap[e.groupId]) {
              groupMap[e.groupId] = {
                type: 'group',
                groupId: e.groupId,
                groupName: e.groupName || 'Itemised Expense',
                items: [],
                totalAmount: 0,
                createdAt: e.createdAt || e.date,
                date: e.date,
                paidBy: e.paidBy,
                categoryId: e.categoryId,
                isSynced: Boolean(e.isSynced || e.parentExpenseId || e.syncedFromRoomCode),
                syncedFromRoomName: e.syncedFromRoomName || e.syncedFromRoom || null,
                syncedFromRoomCode: e.syncedFromRoomCode || null,
              };
            }
            groupMap[e.groupId].items.push(e);
            groupMap[e.groupId].totalAmount += parseFloat(e.amount) || 0;
            if (new Date(e.createdAt || e.date) > new Date(groupMap[e.groupId].createdAt)) {
              groupMap[e.groupId].createdAt = e.createdAt || e.date;
            }
          } else {
            singles.push({
              type: 'single',
              expense: e,
              createdAt: e.createdAt || e.date,
            });
          }
        });

        const dayItems = [...Object.values(groupMap), ...singles].sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return [dayKey, dayItems];
      });

      monthData.sortedDays = processedDays.sort(([a], [b]) => new Date(b) - new Date(a));
    });

    return sortedMonths;
  }, [filtered]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Auto-expand the latest month + latest date on first load
  useEffect(() => {
    if (monthlyGroups.length > 0 && activeMonthId === null) {
      const currentMonthKey = getCurrentMonth();
      const monthExists = monthlyGroups.some(([key]) => key === currentMonthKey);
      const targetMonthKey = monthExists ? currentMonthKey : monthlyGroups[0][0];
      
      setActiveMonthId(targetMonthKey);

      const targetMonthData = monthlyGroups.find(([key]) => key === targetMonthKey);
      if (targetMonthData && targetMonthData[1]?.sortedDays?.length > 0) {
        const latestDate = targetMonthData[1].sortedDays[0][0];
        setActiveDateIds([latestDate]);
      } else {
        setActiveDateIds([]);
      }
    }
  }, [monthlyGroups]);

  const toggleMonth = (monthKey) => {
    setActiveMonthId(prev => (prev === monthKey ? null : monthKey));
  };

  const toggleDate = (dateKey) => {
    setActiveDateIds(prev => {
      if (prev.includes(dateKey)) {
        return prev.filter(id => id !== dateKey);
      } else {
        const next = [...prev, dateKey];
        if (next.length > 2) {
          next.shift(); // close oldest
        }
        return next;
      }
    });
  };

  const handleDelete = async (expenseId) => {
    await deleteExpense(roomCode, expenseId, room).catch(() => {});
  };

  return (
    <>
      <Header title="History" subtitle={`${filtered.length} expenses`} />
      <div className="page-content">
        {/* Filter chips — only in shared rooms */}
        {!isPersonal && (
          <div className="filter-row">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            {users.map(u => (
              <button key={u.id} className={`chip ${filter === u.id ? 'active' : ''}`} onClick={() => setFilter(u.id)}>{u.name}</button>
            ))}
          </div>
        )}

        {/* Expense list */}
        {monthlyGroups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p className="empty-state-title">No expenses yet</p>
            <p className="empty-state-text">Start by adding your first shared expense</p>
          </div>
        ) : (
          monthlyGroups.map(([monthKey, monthData]) => {
            const isExpanded = activeMonthId === monthKey;
            return (
              <div key={monthKey} className="month-group-container">
                <div className={`month-summary-card ${isExpanded ? 'expanded' : ''}`} onClick={() => toggleMonth(monthKey)}>
                  <div className="month-summary-info">
                    <h3 className="month-summary-title">{monthData.label}</h3>
                    <p className="month-summary-subtitle">{monthData.transactionCount} transactions</p>
                  </div>
                  <div className="month-summary-right">
                    <span className="month-summary-total">{formatCurrency(Math.round(monthData.totalAmount))}</span>
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
                      {monthData.sortedDays.map(([date, items]) => {
                        const dateTotal = items.reduce((sum, item) => {
                          if (item.type === 'single') return sum + (parseFloat(item.expense.amount) || 0);
                          return sum + (parseFloat(item.totalAmount) || 0);
                        }, 0);
                        const isDateExpanded = activeDateIds.includes(date);

                        return (
                          <div key={date} className="day-group">
                            {/* Date Card Header */}
                            <div 
                              className={`date-summary-card ${isDateExpanded ? 'expanded' : ''}`}
                              onClick={() => toggleDate(date)}
                              style={{
                                width: 'calc(100% - 20px)',
                                margin: '0 0 var(--space-sm) 0',
                                padding: '8px var(--space-md)',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {formatDate(date)}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  ₹{Math.round(dateTotal).toLocaleString('en-IN')}
                                </span>
                                <motion.div animate={{ rotate: isDateExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </motion.div>
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {isDateExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <AnimatePresence mode="popLayout">
                                    {items.map((item) => {
                                      if (item.type === 'single') {
                                        const expense = item.expense;
                                        const payer = userMap[expense.paidBy];
                                        const cat = catMap[expense.categoryId] || { icon: '📦', name: 'Other' };
                                        const isSynced = Boolean(expense.isSynced || expense.parentExpenseId || expense.syncedFromRoomCode);
                                        const content = (
                                          <div className={`expense-item ${isSynced ? 'synced-expense-item' : ''}`}>
                                            <div className="expense-icon">{cat.icon}</div>
                                            <div className="expense-info">
                                              <p className="expense-desc">{expense.description}</p>
                                              {isSynced && (
                                                <p style={{ margin: '2px 0 0 0', display: 'flex', alignItems: 'center' }}>
                                                  <span className="synced-badge">
                                                    Synced from {expense.syncedFromRoomName || expense.syncedFromRoomCode || 'Shared Room'}
                                                  </span>
                                                </p>
                                              )}
                                              <p className="expense-meta">
                                                {!isPersonal && (
                                                  <>
                                                    <span className="expense-payer-dot" style={{ background: payer?.color || '#888' }} />
                                                    {payer?.name || 'Unknown'}
                                                    {!isSynced && (
                                                      <>
                                                        <span>•</span>
                                                        {expense.splitAmong?.length || 0} split
                                                      </>
                                                    )}
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
                                            style={{ marginBottom: 'var(--space-sm)' }}
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
                                      } else {
                                        const isGroupExpanded = expandedGroups.has(item.groupId);
                                        const payer = userMap[item.paidBy];
                                        const groupCat = catMap[item.categoryId] || { icon: '🥞', name: 'Other' };

                                        return (
                                          <motion.div
                                            key={item.groupId}
                                            layout
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            style={{ marginBottom: 'var(--space-sm)' }}
                                          >
                                            <div 
                                              className={`expense-item group-parent-item ${item.isSynced ? 'synced-expense-item' : ''}`} 
                                              onClick={() => toggleGroup(item.groupId)} 
                                              style={{ 
                                                cursor: 'pointer', 
                                                background: 'var(--bg-glass)', 
                                                borderLeft: '3px solid var(--accent)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                width: '100%',
                                                padding: '12px var(--space-md)'
                                              }}
                                            >
                                              <div className="expense-icon">{groupCat.icon}</div>
                                              <div className="expense-info" style={{ flex: 1 }}>
                                                <p className="expense-desc" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontWeight: 600, margin: 0 }}>
                                                  {item.groupName}
                                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--border-light)', color: 'var(--text-secondary)' }}>
                                                    {item.items.length} items
                                                  </span>
                                                </p>
                                                {item.isSynced && (
                                                  <p style={{ margin: '2px 0 0 0', display: 'flex', alignItems: 'center' }}>
                                                    <span className="synced-badge">
                                                      Synced from {item.syncedFromRoomName || item.syncedFromRoomCode || 'Shared Room'}
                                                    </span>
                                                  </p>
                                                )}
                                                <p className="expense-meta" style={{ margin: '4px 0 0 0' }}>
                                                  {!isPersonal && (
                                                    <>
                                                      <span className="expense-payer-dot" style={{ background: payer?.color || '#888' }} />
                                                      {payer?.name || 'Unknown'}
                                                    </>
                                                  )}
                                                </p>
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                <span className="expense-amount" style={{ fontWeight: 700 }}>{formatCurrency(item.totalAmount)}</span>
                                                <motion.div animate={{ rotate: isGroupExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                                                </motion.div>
                                              </div>
                                            </div>

                                            <AnimatePresence initial={false}>
                                              {isGroupExpanded && (
                                                <motion.div
                                                  initial={{ height: 0, opacity: 0 }}
                                                  animate={{ height: 'auto', opacity: 1 }}
                                                  exit={{ height: 0, opacity: 0 }}
                                                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                                                  style={{ overflow: 'hidden', paddingLeft: 'var(--space-md)', borderLeft: '1px dashed var(--border-light)', marginLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}
                                                >
                                                  {item.items.map(child => {
                                                    const childCat = catMap[child.categoryId] || { icon: '📦', name: 'Other' };
                                                    
                                                    const childContent = (
                                                      <div className="expense-item child-expense-item" style={{ padding: '8px var(--space-md)', background: 'transparent' }}>
                                                        <div className="expense-icon" style={{ width: '28px', height: '28px', fontSize: '1rem' }}>{childCat.icon}</div>
                                                        <div className="expense-info">
                                                          <p className="expense-desc" style={{ fontSize: 'var(--font-sm)' }}>
                                                            {child.description}
                                                          </p>
                                                          <p className="expense-meta" style={{ fontSize: '10px' }}>
                                                            {!isPersonal && (
                                                              <>
                                                                {child.splitAmong?.length || 0} split
                                                              </>
                                                            )}
                                                          </p>
                                                        </div>
                                                        <span className="expense-amount" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                                                          {formatCurrency(child.amount)}
                                                        </span>
                                                      </div>
                                                    );
                                                    const isChildSynced = Boolean(child.isSynced || child.parentExpenseId || child.syncedFromRoomCode);
                                                    return (
                                                      <motion.div
                                                        key={child.id}
                                                        layout
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -10 }}
                                                        style={{ marginBottom: 'var(--space-sm)' }}
                                                      >
                                                        {isChildSynced ? childContent : (
                                                          <SwipeableItem
                                                            isSwiped={activeSlideId === child.id}
                                                            onSwipeChange={(swiped) => setActiveSlideId(swiped ? child.id : null)}
                                                            onDelete={() => setExpenseToDelete(child)}
                                                            onEdit={() => setEditModal(child)}
                                                          >
                                                            {childContent}
                                                          </SwipeableItem>
                                                        )}
                                                      </motion.div>
                                                    );
                                                  })}
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </motion.div>
                                        );
                                      }
                                    })}
                                  </AnimatePresence>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
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
