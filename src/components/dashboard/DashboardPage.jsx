import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import CountUp from '../common/CountUp';
import { useRoomContext } from '../../context/RoomContext';
import { formatCurrency, formatDate } from '../../utils/helpers';
import ExpenseChart from './ExpenseChart';
import SettlementList from './SettlementList';
import FlipBalanceCard from './FlipBalanceCard';
import { useBalances } from '../../hooks/useBalances';
import { useMonthTotals } from '../../hooks/useMonthTotals';
import { usePivotTable } from '../../hooks/usePivotTable';
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
  // One-shot discoverability hint for flip cards
  const [hintAnimate, setHintAnimate] = useState(false);
  const hintFiredRef = useRef(false);

  const handleTooltipClick = () => {
    setShowMatrixTooltip(true);
    setTimeout(() => setShowMatrixTooltip(false), 2000);
  };

  // Fire balance card discoverability hint on each mount
  useEffect(() => {
    if (isPersonal || hintFiredRef.current) return;
    const timer = setTimeout(() => {
      if (!hintFiredRef.current) {
        hintFiredRef.current = true;
        setHintAnimate(true);
        setTimeout(() => setHintAnimate(false), 1600);
      }
    }, 1400);
    return () => clearTimeout(timer);
  }, [isPersonal]);

  const { balances, total, settlements, allSettled, monthlyTotals } = useBalances(expenses, users);
  const { currentMonthTotal: rawCurrentMonthTotal, prevMonthTotal: rawPrevMonthTotal, currentMonthLabel, prevMonthLabel } = useMonthTotals(expenses);
  const currentMonthTotal = Math.round(rawCurrentMonthTotal);
  const prevMonthTotal = Math.round(rawPrevMonthTotal);
  const pivotData = usePivotTable(expenses, categories);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayOfMonth = today.getDate();
  const todayTotal = Math.round(expenses
    .filter(e => e.date === todayStr)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0));

  // Current month avg/day
  const daysElapsed = today.getDate();
  const avgPerDayVal = daysElapsed > 0 ? Math.round(currentMonthTotal / daysElapsed) : 0;
  const avgPerDayFormatted = `Avg · ₹${avgPerDayVal.toLocaleString('en-IN')}/day`;

  // Previous month avg/day
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthTotalDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const prevAvgPerDayVal = prevMonthTotal > 0 ? Math.round(prevMonthTotal / prevMonthTotalDays) : 0;
  const prevAvgFormatted = prevAvgPerDayVal > 0 ? `Avg · ₹${prevAvgPerDayVal.toLocaleString('en-IN')}/day` : null;

  // Sort helper: date DESC, then createdAt DESC
  const sortByLatestDate = (a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    if (dateB - dateA !== 0) return dateB - dateA;
    // Tiebreak by createdAt
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  };

  // Find last transaction for personal mode — Bug 1 + Bug 2 fix
  const personalLastTx = useMemo(() => {
    if (!isPersonal || expenses.length === 0) return null;
    const groupMap = {};
    const standalones = [];

    expenses.forEach(e => {
      if (e.isItemised && e.groupId) {
        if (!groupMap[e.groupId]) {
          groupMap[e.groupId] = {
            isGroup: true,
            groupId: e.groupId,
            groupName: e.groupName || 'Itemised Expense',
            amount: 0,
            date: e.date,
            createdAt: e.createdAt || e.date,
            syncedFromRoom: e.syncedFromRoom || e.syncedFromRoomName || null,
          };
        }
        groupMap[e.groupId].amount += parseFloat(e.amount) || 0;
        // Use date-first comparison (Bug 1)
        const existing = groupMap[e.groupId];
        const existingDate = new Date(existing.date || 0);
        const newDate = new Date(e.date || 0);
        const existingCreatedAt = new Date(existing.createdAt || 0);
        const newCreatedAt = new Date(e.createdAt || 0);
        if (newDate > existingDate || (newDate.getTime() === existingDate.getTime() && newCreatedAt > existingCreatedAt)) {
          groupMap[e.groupId].date = e.date;
          groupMap[e.groupId].createdAt = e.createdAt || e.date;
          groupMap[e.groupId].syncedFromRoom = e.syncedFromRoom || e.syncedFromRoomName || null;
        }
      } else {
        standalones.push({
          isGroup: false,
          description: e.description || 'Other',
          amount: parseFloat(e.amount) || 0,
          date: e.date,
          createdAt: e.createdAt || e.date,
          syncedFromRoom: e.syncedFromRoom || e.syncedFromRoomName || null,
        });
      }
    });

    const allCandidates = [...Object.values(groupMap), ...standalones];
    return allCandidates.sort(sortByLatestDate)[0];
  }, [isPersonal, expenses]);

  return (
    <>
      <Header title={room?.name || 'Dashboard'} subtitle={isPersonal ? 'Personal' : `${users.length} roommates`} />

      <div className="page-content">
        {/* Minimal inline identity selector prompt for shared room when no identity is set */}
        {!isPersonal && !userIdentity && users.length > 0 && (
          <motion.div
            className="card identity-prompt-card"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(162, 155, 254, 0.05))',
              borderColor: 'rgba(108, 92, 231, 0.3)',
              marginBottom: 'var(--space-lg)',
              padding: 'var(--space-md) var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)'
            }}
          >
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              👋 Who are you? Select your member profile:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setUserIdentity(u.id)}
                  className="chip clickable"
                  style={{
                    borderColor: u.color || 'var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)',
                    padding: '6px 12px',
                    fontSize: 'var(--font-xs)',
                    borderRadius: 'var(--radius-full)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = u.color ? `${u.color}22` : 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  <span className="avatar-sm" style={{ background: u.color || 'var(--accent)', width: '18px', height: '18px', fontSize: '9px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Total Card */}
        <motion.div className="card total-card" custom={0} initial="hidden" animate="visible" variants={cardVariants}>
          <p className="total-label">Total Expenses</p>
          <h2 className="total-amount">
            <CountUp value={Math.round(total)} prefix="₹" />
          </h2>
          {!isPersonal && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-xs)' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-color)',
                fontSize: 'var(--font-xs)',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>
                {todayTotal === 0
                  ? 'No expenses today'
                  : `Day ${dayOfMonth} · ${formatCurrency(todayTotal)} today`}
              </span>
            </div>
          )}

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

          {/* Day chip for Personal Room */}
          {isPersonal && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-md)' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-color)',
                fontSize: 'var(--font-xs)',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>
                {todayTotal === 0
                  ? 'No expenses today'
                  : `Day ${dayOfMonth} · ${formatCurrency(todayTotal)} today`}
              </span>
            </div>
          )}

          <div className="month-stats">
            <div className="month-stat">
              <span className="month-stat-label">{prevMonthLabel}</span>
              <span className="month-stat-value">{formatCurrency(prevMonthTotal)}</span>
              {prevAvgFormatted && (
                <span className="prev-avg-label">{prevAvgFormatted}</span>
              )}
            </div>
            <div className="month-stat-divider" />
            <div className="month-stat">
              <span className="month-stat-label">{currentMonthLabel}</span>
              <span className="month-stat-value">{formatCurrency(currentMonthTotal)}</span>
              <span className="month-avg-label">{avgPerDayFormatted}</span>
            </div>
          </div>
        </motion.div>

        {/* Last Paid Card (Personal Mode only) */}
        {isPersonal && personalLastTx && (
          <motion.div className="card last-paid-card" custom={1} initial="hidden" animate="visible" variants={cardVariants}>
            <div className="last-paid-label">
              Last Paid Expense
              {personalLastTx.syncedFromRoom && (
                <> is <span className="synced-badge">Synced from {personalLastTx.syncedFromRoom}</span></>
              )}
            </div>
            <div className="last-paid-body">
              <div className="last-paid-details">
                <h4 className="last-paid-title">
                  {personalLastTx.isGroup ? personalLastTx.groupName : (personalLastTx.description || 'Other')}
                </h4>
                <p className="last-paid-date">{formatDate(personalLastTx.date)}</p>
              </div>
              <div className="last-paid-amount">
                {formatCurrency(personalLastTx.amount)}
              </div>
            </div>
          </motion.div>
        )}

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
                  <FlipBalanceCard b={b} expenses={expenses} hintAnimate={hintAnimate} />
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
