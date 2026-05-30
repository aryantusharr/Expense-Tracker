/* eslint-disable */
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import CountUp from '../common/CountUp';
import { useRoomContext } from '../../context/RoomContext';
import { calculateBalances, getTotalExpenses, getMonthlyTotals, getExpensesByCategory } from '../../utils/splitCalculator';
import { calculateSettlements, isAllSettled } from '../../utils/settlementEngine';
import { formatCurrency, formatDate } from '../../utils/helpers';
import ExpenseChart from './ExpenseChart';
import SettlementList from './SettlementList';
import './Dashboard.css';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
  }),
};

export default function DashboardPage() {
  const { room, expenses, users, categories, userIdentity, setUserIdentity } = useRoomContext();
  const isPersonal = room?.isPersonal === true;
  const budget = room?.budget || 0;

  const [showMatrixTooltip, setShowMatrixTooltip] = useState(false);
  const handleTooltipClick = () => {
    setShowMatrixTooltip(true);
    setTimeout(() => setShowMatrixTooltip(false), 2000);
  };

  const balances = useMemo(() => calculateBalances(expenses, users), [expenses, users]);
  const total = useMemo(() => getTotalExpenses(expenses), [expenses]);
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);
  const allSettled = useMemo(() => isAllSettled(balances), [balances]);
  const monthlyTotals = useMemo(() => getMonthlyTotals(expenses), [expenses]);

  // Totals calculation
  const { currentMonthTotal, prevMonthTotal, currentMonthLabel, prevMonthLabel } = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth();
    const cy = now.getFullYear();
    const pm = cm === 0 ? 11 : cm - 1;
    const py = cm === 0 ? cy - 1 : cy;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let currentTotal = 0, prevTotal = 0;
    expenses.forEach(e => {
      const d = new Date(e.date);
      const em = d.getMonth(), ey = d.getFullYear();
      if (em === cm && ey === cy) currentTotal += parseFloat(e.amount) || 0;
      if (em === pm && ey === py) prevTotal += parseFloat(e.amount) || 0;
    });

    return {
      currentMonthTotal: currentTotal,
      prevMonthTotal: prevTotal,
      currentMonthLabel: monthNames[cm],
      prevMonthLabel: monthNames[pm],
    };
  }, [expenses]);

  // Expenses Pivot Table
  const pivotData = useMemo(() => {
    if (expenses.length === 0) return null;

    const catMap = {};
    (categories || []).forEach(c => { catMap[c.id] = c; });

    // 1. Gather all unique months
    const monthSet = new Set();
    expenses.forEach(e => {
      const d = new Date(e.date);
      monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });

    const sortedMonthsKeys = Array.from(monthSet).sort(); // Chronological
    const monthLabels = sortedMonthsKeys.map(k => {
      const [y, m] = k.split('-');
      const d = new Date(y, parseInt(m) - 1);
      return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    });

    // 2. Gather matrix data
    const matrix = {}; 
    const monthGrandTotals = {};
    let overallGrandTotal = 0;

    sortedMonthsKeys.forEach(m => monthGrandTotals[m] = 0);

    expenses.forEach(e => {
      const d = new Date(e.date);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const catId = e.categoryId || 'unknown';
      const amount = parseFloat(e.amount) || 0;

      if (!matrix[catId]) {
        const cat = catMap[catId] || { name: 'Other', icon: '📦' };
        matrix[catId] = { id: catId, name: cat.name, icon: cat.icon, totalsByMonth: {}, grandTotal: 0 };
        sortedMonthsKeys.forEach(m => matrix[catId].totalsByMonth[m] = 0);
      }

      matrix[catId].totalsByMonth[mKey] += amount;
      matrix[catId].grandTotal += amount;
      monthGrandTotals[mKey] += amount;
      overallGrandTotal += amount;
    });

    const sortedCategories = Object.values(matrix).sort((a, b) => a.name.localeCompare(b.name));

    return {
      monthKeys: sortedMonthsKeys,
      monthLabels,
      categories: sortedCategories,
      monthGrandTotals,
      overallGrandTotal
    };
  }, [expenses, categories]);

  return (
    <>
      <Header title={room?.name || 'Dashboard'} subtitle={isPersonal ? 'Personal' : `${users.length} roommates`} />

      <div className="page-content">


        {/* Total Card */}
        <motion.div className="card total-card" custom={0} initial="hidden" animate="visible" variants={cardVariants}>
          <p className="total-label">Total Expenses</p>
          <h2 className="total-amount">
            <CountUp value={total} prefix="₹" />
          </h2>
          <p className="total-count">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>

          {/* Budget gauge for personal mode */}
          {isPersonal && budget > 0 && (
            <div className="budget-gauge">
              <div className="budget-gauge-bar">
                <motion.div
                  className="budget-gauge-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(Math.min((currentMonthTotal / budget) * 100, 100), 0.1)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{
                    background: 'linear-gradient(90deg, #00cec9 0%, #00cec9 50%, #feca57 65%, #ff9f43 85%, #ff6b6b 100%)',
                    backgroundSize: `${10000 / Math.max(Math.min((currentMonthTotal / budget) * 100, 100), 0.1)}% 100%`,
                    backgroundPosition: 'left center'
                  }}
                />
              </div>
              <div className="budget-gauge-labels">
                <span>{formatCurrency(currentMonthTotal)} spent</span>
                <span>of {formatCurrency(budget)}</span>
              </div>
              {currentMonthTotal > budget && (
                <p className="budget-over">Over budget by {formatCurrency(currentMonthTotal - budget)}</p>
              )}
            </div>
          )}

          <div className="month-stats">
            <div className="month-stat">
              <span className="month-stat-label">{prevMonthLabel}</span>
              <span className="month-stat-value">{formatCurrency(prevMonthTotal)}</span>
            </div>
            <div className="month-stat-divider" />
            <div className="month-stat">
              <span className="month-stat-label">{currentMonthLabel}</span>
              <span className="month-stat-value">{formatCurrency(currentMonthTotal)}</span>
            </div>
          </div>
        </motion.div>

        {/* Balance Cards — hidden in personal mode */}
        {!isPersonal && (
        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants}>
          <h3 className="section-title">Balances</h3>
          <div className="balance-grid">
            {Object.values(balances).map((b, i) => (
              <motion.div
                key={b.userId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.08 + i * 0.03 }}
              >
                <FlipBalanceCard b={b} expenses={expenses} />
              </motion.div>
            ))}
          </div>
        </motion.div>
        )}

        {/* Settlements — hidden in personal mode */}
        {!isPersonal && (
        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}>
          <h3 className="section-title">Settlements</h3>
          <SettlementList settlements={settlements} allSettled={allSettled} />
        </motion.div>
        )}

        {/* Monthly Overview Chart */}
        {expenses.length > 0 && (
          <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}>
            <h3 className="section-title">Monthly Overview</h3>
            <ExpenseChart monthlyTotals={monthlyTotals} />
          </motion.div>
        )}

        {/* Expenses Pivot Table */}
        {pivotData && (
          <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants}>
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', position: 'relative' }}>
              Spending Matrix
              <span className="tooltip-icon" onClick={handleTooltipClick} style={{ cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              </span>
              <AnimatePresence>
                {showMatrixTooltip && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 5 }}
                    style={{
                      position: 'absolute',
                      left: '140px',
                      top: '-5px',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      padding: 'var(--space-sm) var(--space-md)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-xs)',
                      boxShadow: 'var(--shadow-md)',
                      whiteSpace: 'nowrap',
                      zIndex: 10,
                      border: '1px solid var(--border-color)',
                      textTransform: 'none',
                      letterSpacing: 'normal'
                    }}
                  >
                    Shows % change from previous month
                  </motion.div>
                )}
              </AnimatePresence>
            </h3>
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="pivot-table">
                  <thead>
                    <tr>
                      <th className="pivot-header-cell pivot-sticky-col">Category</th>
                      {pivotData.monthLabels.map(label => (
                        <th key={label} className="pivot-header-cell text-left">{label}</th>
                      ))}
                      <th className="pivot-header-cell text-left pivot-highlight">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotData.categories.map(cat => (
                      <tr key={cat.id}>
                        <td className="pivot-cell pivot-sticky-col">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <span>{cat.icon}</span>
                            <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{cat.name}</span>
                          </div>
                        </td>
                        {pivotData.monthKeys.map((mKey, index) => {
                          const currentTotal = cat.totalsByMonth[mKey];
                          let percentElement = null;
                          if (index > 0 && currentTotal > 0) {
                            const prevKey = pivotData.monthKeys[index - 1];
                            const prevTotal = cat.totalsByMonth[prevKey];
                            if (prevTotal > 0) {
                              const percent = ((currentTotal - prevTotal) / prevTotal) * 100;
                              const isUp = percent > 0;
                              const color = isUp ? 'var(--danger)' : 'var(--success)';
                              const arrow = isUp ? '↑' : '↓';
                              // Only show if not 0%
                              if (Math.abs(percent) >= 1) {
                                percentElement = (
                                  <span style={{ fontSize: '0.65rem', color, marginLeft: '6px', fontWeight: 700 }}>
                                    {arrow}{Math.abs(percent).toFixed(0)}%
                                  </span>
                                );
                              }
                            }
                          }
                          return (
                            <td key={mKey} className="pivot-cell text-left" style={{ color: 'var(--info)' }}>
                              {currentTotal > 0 ? (
                                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                                  {formatCurrency(currentTotal)}
                                  {percentElement}
                                </div>
                              ) : ''}
                            </td>
                          );
                        })}
                        <td className="pivot-cell text-left pivot-highlight font-semibold">
                          {formatCurrency(cat.grandTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="pivot-cell pivot-sticky-col pivot-highlight font-bold text-secondary">
                        Grand Total
                      </td>
                      {pivotData.monthKeys.map((mKey, index) => {
                        const currentTotal = pivotData.monthGrandTotals[mKey];
                        let percentElement = null;
                        if (index > 0 && currentTotal > 0) {
                          const prevKey = pivotData.monthKeys[index - 1];
                          const prevTotal = pivotData.monthGrandTotals[prevKey];
                          if (prevTotal > 0) {
                            const percent = ((currentTotal - prevTotal) / prevTotal) * 100;
                            const isUp = percent > 0;
                            const color = isUp ? 'var(--danger)' : 'var(--success)';
                            const arrow = isUp ? '↑' : '↓';
                            if (Math.abs(percent) >= 1) {
                              percentElement = (
                                <span style={{ fontSize: '0.65rem', color, marginLeft: '6px', fontWeight: 700 }}>
                                  {arrow}{Math.abs(percent).toFixed(0)}%
                                </span>
                              );
                            }
                          }
                        }
                        return (
                          <td key={mKey} className="pivot-cell text-left pivot-highlight font-semibold text-secondary">
                            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                              {formatCurrency(currentTotal)}
                              {percentElement}
                            </div>
                          </td>
                        );
                      })}
                      <td className="pivot-cell text-left pivot-highlight font-bold text-accent">
                        {formatCurrency(pivotData.overallGrandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}

function FlipBalanceCard({ b, expenses }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const isPositive = b.balance >= 0;
  const absBalance = Math.abs(b.balance);

  // Find last transaction
  const userExpenses = expenses.filter(e => e.paidBy === b.userId);
  const lastExp = userExpenses.sort((x, y) => new Date(y.date) - new Date(x.date))[0];

  // Calculate current month balance
  const now = new Date();
  const cm = now.getMonth();
  const cy = now.getFullYear();
  let cmPaid = 0, cmOwed = 0;

  expenses.forEach(e => {
    const d = new Date(e.date);
    if (d.getMonth() === cm && d.getFullYear() === cy) {
      const amount = parseFloat(e.amount) || 0;
      if (e.paidBy === b.userId) cmPaid += amount;
      const splitAmong = e.splitAmong || [];
      if (splitAmong.includes(b.userId)) {
        cmOwed += amount / splitAmong.length;
      }
    }
  });
  const cmBalance = Math.round(cmPaid - cmOwed);
  const cmAbsBalance = Math.abs(cmBalance);
  const cmPositive = cmBalance >= 0;

  return (
    <div className="balance-card-container" onClick={() => setIsFlipped(!isFlipped)}>
      <motion.div
        className="balance-card-inner"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div className="card balance-card balance-card-front" style={{ backfaceVisibility: 'hidden' }}>
          <div className="balance-card-flip-icon">🔄</div>
          <div className="balance-avatar" style={{ background: b.color }}>
            {b.name[0]}
          </div>
          <p className="balance-name">{b.name}</p>
          <p className={`balance-amount ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '+' : '−'}₹{absBalance.toLocaleString('en-IN')}
          </p>
          <div className="balance-detail-enhanced">
            <div className="balance-stat">
              <span className="stat-label">Paid</span>
              <span className="stat-val" title={formatCurrency(b.paid)}>{formatCurrency(b.paid)}</span>
            </div>
            <div className="stat-divider" />
            <div className="balance-stat">
              <span className="stat-label">Share</span>
              <span className="stat-val" title={formatCurrency(b.owed)}>{formatCurrency(b.owed)}</span>
            </div>
          </div>
          {lastExp && (
            <div className="last-transaction">
              Last: Paid <span className="last-amount">{formatCurrency(lastExp.amount)}</span> for {lastExp.description || 'Other'} on {new Date(lastExp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>

        {/* Back */}
        <div className="card balance-card balance-card-back" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <div className="balance-card-flip-icon">🔄</div>
          <h4 className="back-title">Current Month</h4>
          <p className={`balance-amount ${cmPositive ? 'positive' : 'negative'}`}>
            {cmPositive ? '+' : '−'}₹{cmAbsBalance.toLocaleString('en-IN')}
          </p>
          <div className="balance-detail-enhanced">
            <div className="balance-stat">
              <span className="stat-label">Paid</span>
              <span className="stat-val" title={formatCurrency(cmPaid)}>{formatCurrency(cmPaid)}</span>
            </div>
            <div className="stat-divider" />
            <div className="balance-stat">
              <span className="stat-label">Share</span>
              <span className="stat-val" title={formatCurrency(cmOwed)}>{formatCurrency(cmOwed)}</span>
            </div>
          </div>
          <p className="back-hint">Tap to flip back</p>
        </div>
      </motion.div>
    </div>
  );
}
