import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createRoom, checkRoomNameExists } from '../../services/roomService';
import { useRoomContext } from '../../context/RoomContext';
import { getUserColor } from '../../utils/helpers';
import './Setup.css';

export default function CreateRoom() {
  const navigate = useNavigate();
  const { joinRoomSession } = useRoomContext();
  const [step, setStep] = useState(1); // 1: count + name, 2: names
  const [roomName, setRoomName] = useState('');
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateCount = (newCount) => {
    if (newCount < 2 || newCount > 20) return;
    setCount(newCount);
    const newNames = [...names];
    while (newNames.length < newCount) newNames.push('');
    while (newNames.length > newCount) newNames.pop();
    setNames(newNames);
  };

  const updateName = (index, value) => {
    const updated = [...names];
    updated[index] = value;
    setNames(updated);
  };

  // Fixed count for this step

  const handleNext = async () => {
    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }

    // Check for duplicate room name
    setLoading(true);
    setError('');
    try {
      const exists = await checkRoomNameExists(roomName.trim());
      if (exists) {
        setError('A room with this name already exists. Choose a different name.');
        setLoading(false);
        return;
      }
      setLoading(false);
      setStep(2);
    } catch (err) {
      setError('Failed to verify room name. Try again.');
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    // Validation
    const emptyFields = names.some(n => !n.trim());
    if (emptyFields) {
      setError('All name fields are mandatory. Please fill in every roommate\'s name.');
      return;
    }

    const filledNames = names.map(n => n.trim());

    setLoading(true);
    setError('');
    try {
      const { roomCode } = await createRoom(roomName.trim(), filledNames);
      joinRoomSession(roomCode);
      navigate(`/share/${roomCode}`);
    } catch (err) {
      setError(err.message || 'Failed to create room');
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <button className="setup-back-btn" onClick={() => step === 1 ? navigate('/') : setStep(1)}>
        ←
      </button>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            className="setup-container"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="setup-title">Create Room</h1>
            <p className="setup-subtitle">How many roommates?</p>

            <div className="count-selector">
              <button className="count-btn" onClick={() => updateCount(count - 1)}>−</button>
              <motion.span
                className="count-display"
                key={count}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              >
                {count}
              </motion.span>
              <button className="count-btn" onClick={() => updateCount(count + 1)}>+</button>
            </div>

            <div className="input-group" style={{ marginTop: 'var(--space-xl)' }}>
              <label>Room Name</label>
              <input
                className="input"
                placeholder="e.g. Flat 42A, Boys Hostel..."
                value={roomName}
                onChange={(e) => { setRoomName(e.target.value); setError(''); }}
                id="input-room-name"
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 'var(--space-2xl)' }}
              onClick={handleNext}
              disabled={!roomName.trim() || loading}
            >
              {loading ? '⏳ Checking...' : 'Next →'}
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            className="setup-container"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="setup-title">Name Everyone</h1>
            <p className="setup-subtitle">Enter names for all {count} roommates</p>


            <div className="roommates-list">
              {names.map((name, i) => (
                <motion.div
                  key={i}
                  className="roommate-input-row"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                >
                  <div className="avatar" style={{ background: getUserColor(i) }}>
                    {name.trim() ? name.trim()[0].toUpperCase() : (i + 1)}
                  </div>
                  <input
                    className="input"
                    placeholder={`Roommate ${i + 1}`}
                    value={name}
                    onChange={(e) => updateName(i, e.target.value)}
                    id={`input-roommate-${i}`}
                  />
                </motion.div>
              ))}
            </div>

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 'var(--space-xl)' }}
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? '⏳ Creating...' : '✨ Create Room'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
