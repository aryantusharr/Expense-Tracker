import { motion } from 'framer-motion';
import './Dashboard.css';

export default function SettlementList({ settlements, allSettled }) {
  if (allSettled) {
    return (
      <div className="card settled-badge">
        <motion.div
          className="settled-icon"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          ✅
        </motion.div>
        <p className="settled-text">All Settled Up!</p>
        <p className="settled-subtext">No pending payments</p>
      </div>
    );
  }

  return (
    <div className="flex-col gap-sm" style={{ marginBottom: 'var(--space-xl)' }}>
      {settlements.map((s, i) => (
        <motion.div
          key={`${s.from.id}-${s.to.id}`}
          className="card settlement-card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
        >

          <div className="settlement-arrow">
            <div className="settlement-user">
              <div className="avatar avatar-sm" style={{ background: s.from.color }}>
                {s.from.name[0]}
              </div>
              <span className="settlement-name">{s.from.name}</span>
            </div>
            <span className="settlement-direction">→</span>
            <div className="settlement-user">
              <div className="avatar avatar-sm" style={{ background: s.to.color }}>
                {s.to.name[0]}
              </div>
              <span className="settlement-name">{s.to.name}</span>
            </div>
          </div>
          <div>
            <span className="settlement-amount">₹{s.amount.toLocaleString('en-IN')}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
