import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../utils/helpers';
import './Dashboard.css';

export default function FlipBalanceCard({ b, expenses, hintAnimate }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [rotateY, setRotateY] = useState(0);
  const [ripple, setRipple] = useState(null);
  const [isJittering, setIsJittering] = useState(false);
  const containerRef = useRef(null);

  const isPositive = b.balance >= 0;
  const absBalance = Math.abs(b.balance);

  // Jitter on mount to hint card is interactive
  useEffect(() => {
    const t = setTimeout(() => {
      setIsJittering(true);
      setTimeout(() => setIsJittering(false), 450);
    }, 600);
    return () => clearTimeout(t);
  }, [b.userId]); // fires once per card


  // Sort helper: date DESC first, then createdAt DESC (Bug 1 fix)
  const sortByLatestDate = (a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    if (dateB - dateA !== 0) return dateB - dateA;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  };

  // Group-aware Last Paid logic
  const userExpenses = expenses.filter(e => e.paidBy === b.userId);
  const groupMap = {};
  const standalones = [];

  userExpenses.forEach(e => {
    if (e.isItemised && e.groupId) {
      if (!groupMap[e.groupId]) {
        groupMap[e.groupId] = {
          isGroup: true,
          groupId: e.groupId,
          groupName: e.groupName || 'Itemised Expense',
          amount: 0,
          date: e.date,
          createdAt: e.createdAt || e.date,
        };
      }
      groupMap[e.groupId].amount += parseFloat(e.amount) || 0;
      const existing = groupMap[e.groupId];
      const existingDate = new Date(existing.date || 0);
      const newDate = new Date(e.date || 0);
      const existingCreatedAt = new Date(existing.createdAt || 0);
      const newCreatedAt = new Date(e.createdAt || 0);
      if (newDate > existingDate || (newDate.getTime() === existingDate.getTime() && newCreatedAt > existingCreatedAt)) {
        groupMap[e.groupId].date = e.date;
        groupMap[e.groupId].createdAt = e.createdAt || e.date;
      }
    } else {
      standalones.push({
        isGroup: false,
        description: e.description || 'Other',
        amount: parseFloat(e.amount) || 0,
        date: e.date,
        createdAt: e.createdAt || e.date,
      });
    }
  });

  const allCandidates = [...Object.values(groupMap), ...standalones];
  const lastTx = allCandidates.sort(sortByLatestDate)[0];

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

  const handleClick = (e) => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Capture ripple coordinates relative to card
    if (containerRef.current && !prefersReduced) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setRipple({ x, y, id: Date.now() });
      setTimeout(() => setRipple(null), 700);
    }
    setIsFlipped(prev => !prev);
    setRotateY(prev => prev === 0 ? 180 : 0);
  };

  return (
    <div
      ref={containerRef}
      className={`balance-card-container${isJittering ? ' card-jitter' : ''}`}
      onClick={handleClick}
    >
      <motion.div
        className="balance-card-inner"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : rotateY }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div className="card balance-card balance-card-front" style={{ backfaceVisibility: 'hidden' }}>
          {ripple && (
            <div className="ripple-container">
              <span
                key={ripple.id}
                className="ripple-circle"
                style={{ left: ripple.x, top: ripple.y }}
              />
            </div>
          )}
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
          {lastTx && (
            <div className="last-transaction">
              Last: Paid <span className="last-amount">{formatCurrency(lastTx.amount)}</span> for {lastTx.isGroup ? lastTx.groupName : (lastTx.description || 'Other')} on {new Date(lastTx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>

        {/* Back */}
        <div className="card balance-card balance-card-back" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          {ripple && (
            <div className="ripple-container">
              <span
                key={ripple.id}
                className="ripple-circle"
                style={{ left: ripple.x, top: ripple.y }}
              />
            </div>
          )}
          <h4 className="back-title">This Month</h4>
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
