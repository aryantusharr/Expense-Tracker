import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRoomContext } from '../../context/RoomContext';
import { createPersonalTracker } from '../../services/roomService';
import './Setup.css';

export default function PersonalSetup() {
  const navigate = useNavigate();
  const { joinRoomSession } = useRoomContext();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Your name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { roomCode } = await createPersonalTracker(name.trim(), parseFloat(budget) || 0);
      joinRoomSession(roomCode);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to create tracker');
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <button className="setup-back-btn" onClick={() => navigate('/')}>
        ←
      </button>

      <motion.div
        className="setup-container"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="setup-title">Personal Tracker</h1>
        <p className="setup-subtitle">Track your own expenses with categories, charts, and PDF reports.</p>

        <div className="create-room-form">
          <div className="input-group">
            <label>Your Name</label>
            <input
              className="input"
              placeholder="e.g. Shatakshi, Tushar..."
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              id="input-personal-name"
            />
          </div>

          <div className="input-group">
            <label>Monthly Budget <span className="optional-tag">(optional)</span></label>
            <div className="amount-input-wrapper" style={{ padding: 'var(--space-md) 0' }}>
              <div className="amount-center">
                <span className="currency-symbol" style={{ fontSize: 'var(--font-lg)' }}>₹</span>
                <input
                  className="amount-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  style={{ fontSize: '2rem', width: '140px' }}
                  id="input-budget"
                />
              </div>
            </div>
            <p className="text-secondary" style={{ fontSize: 'var(--font-xs)', textAlign: 'center' }}>
              Set a monthly budget to track your spending limit
            </p>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            className="btn btn-primary btn-full"
            onClick={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading ? '⏳ Setting up...' : '🚀 Start Tracking'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
