import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { joinRoom } from '../../services/roomService';
import { useRoomContext } from '../../context/RoomContext';
import './Setup.css';

export default function JoinRoom() {
  const navigate = useNavigate();
  const { joinRoomSession } = useRoomContext();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);

  const handleChange = (index, value) => {
    if (value.length > 1) value = value[value.length - 1];
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newCode = [...code];
    newCode[index] = upper;
    setCode(newCode);

    // Auto-advance to next input
    if (upper && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (index === 5 && upper) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) handleJoin(fullCode);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setCode(newCode);
    if (pasted.length === 6) {
      handleJoin(pasted);
    }
  };

  const handleJoin = async (roomCode) => {
    const finalCode = roomCode || code.join('');
    if (finalCode.length !== 6) {
      setError('Enter a 6-character code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await joinRoom(finalCode);
      joinRoomSession(finalCode);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Room not found');
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <button className="setup-back-btn" onClick={() => navigate('/')}>←</button>

      <motion.div
        className="setup-container"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="setup-title">Join Room</h1>
        <p className="setup-subtitle">Enter the 6-character room code shared by your roommate</p>

        <div className="code-input-container" onPaste={handlePaste}>
          {code.map((char, i) => (
            <motion.input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              className="code-char-input"
              type="text"
              inputMode="text"
              maxLength={1}
              value={char}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              id={`code-input-${i}`}
            />
          ))}
        </div>

        {error && <p className="error-text text-center">{error}</p>}

        <button
          className="btn btn-primary btn-full"
          onClick={() => handleJoin()}
          disabled={loading || code.join('').length < 6}
        >
          {loading ? '⏳ Joining...' : '🚀 Join Room'}
        </button>
      </motion.div>
    </div>
  );
}
