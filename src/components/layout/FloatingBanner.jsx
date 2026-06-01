import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function FloatingBanner({ pendingCount }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();

  if (pendingCount === 0 || isDismissed) {
    return null;
  }

  const handleDismiss = (e) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  const handleNavigate = () => {
    navigate('/review');
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="floating-banner-container"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
      >
        {pendingCount >= 2 && <div className="shadow-card shadow-card-2" />}
        {pendingCount >= 1 && <div className="shadow-card shadow-card-1" />}
        
        <div className="floating-banner-main" onClick={handleNavigate}>
          <div className="floating-banner-content">
            <span className="banner-text">Review Pending Transactions</span>
            <span className="bounce-arrow">→</span>
          </div>
          <button 
            className="banner-close-btn"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            &times;
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
