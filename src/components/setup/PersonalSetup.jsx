import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRoomContext } from '../../context/RoomContext';
import { createPersonalTracker, joinRoom } from '../../services/roomService';
import './Setup.css';

export default function PersonalSetup() {
  const navigate = useNavigate();
  const { joinRoomSession } = useRoomContext();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Join existing personal room states
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState(['', '', '', '', '', '']);
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const joinInputRefs = useRef([]);

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

  const handleJoinChange = (index, value) => {
    if (value.length > 1) value = value[value.length - 1];
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newCode = [...joinCode];
    newCode[index] = upper;
    setJoinCode(newCode);

    // Auto-advance to next input
    if (upper && index < 5) {
      joinInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (index === 5 && upper) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) handleJoinSubmit(fullCode);
    }
  };

  const handleJoinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !joinCode[index] && index > 0) {
      joinInputRefs.current[index - 1]?.focus();
    }
  };

  const handleJoinPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const newCode = [...joinCode];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setJoinCode(newCode);
    if (pasted.length === 6) {
      handleJoinSubmit(pasted);
    }
  };

  const handleJoinSubmit = async (codeStr) => {
    const finalCode = codeStr || joinCode.join('');
    if (finalCode.length !== 6) {
      setJoinError('Enter a 6-character code');
      return;
    }

    setJoinLoading(true);
    setJoinError('');
    try {
      const { roomData } = await joinRoom(finalCode);
      if (roomData.isPersonal !== true) {
        setJoinError('This code belongs to a shared room.');
        setJoinLoading(false);
        return;
      }
      joinRoomSession(finalCode);
      navigate('/dashboard');
    } catch (err) {
      setJoinError(err.message || 'Tracker not found');
      setJoinLoading(false);
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
          {!showJoin ? (
            <>
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

              <p className="text-secondary" style={{ fontSize: 'var(--font-sm)', margin: 'var(--space-md) 0', textAlign: 'center' }}>
                ─── or ───
              </p>
              <p className="text-secondary" style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-sm)', textAlign: 'center' }}>
                Already have a personal tracker?
              </p>
              <button
                className="btn btn-secondary btn-full"
                onClick={() => { setShowJoin(true); setError(''); }}
              >
                Join
              </button>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <p className="text-secondary" style={{ fontSize: 'var(--font-sm)', margin: 'var(--space-md) 0', textAlign: 'center' }}>
                ─── Join Existing Tracker ───
              </p>
              <p className="setup-subtitle" style={{ fontSize: 'var(--font-xs)', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
                Enter the 6-character personal tracker code
              </p>

              <div className="code-input-container" onPaste={handleJoinPaste} style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: 'var(--space-md)' }}>
                {joinCode.map((char, i) => (
                  <input
                    key={i}
                    ref={(el) => (joinInputRefs.current[i] = el)}
                    className="code-char-input"
                    type="text"
                    inputMode="text"
                    maxLength={1}
                    value={char}
                    onChange={(e) => handleJoinChange(i, e.target.value)}
                    onKeyDown={(e) => handleJoinKeyDown(i, e)}
                    style={{
                      width: '40px',
                      height: '48px',
                      textAlign: 'center',
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)'
                    }}
                    id={`personal-join-input-${i}`}
                  />
                ))}
              </div>

              {joinError && <p className="error-text text-center" style={{ marginBottom: 'var(--space-md)' }}>{joinError}</p>}

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  className="btn btn-secondary btn-full"
                  onClick={() => { setShowJoin(false); setJoinError(''); }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-full"
                  onClick={() => handleJoinSubmit()}
                  disabled={joinLoading || joinCode.join('').length < 6}
                >
                  {joinLoading ? '⏳ Joining...' : 'Join'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
