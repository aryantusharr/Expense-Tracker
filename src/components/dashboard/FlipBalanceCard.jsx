import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../utils/helpers';
import './Dashboard.css';

export default function FlipBalanceCard({ b, expenses }) {
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
