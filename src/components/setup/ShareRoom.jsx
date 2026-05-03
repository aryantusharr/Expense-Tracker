import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { getRoomShareUrl, copyToClipboard, shareRoom } from '../../utils/helpers';
import { useRoomContext } from '../../context/RoomContext';
import './Setup.css';

export default function ShareRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { room } = useRoomContext();
  const [copied, setCopied] = useState('');

  const shareUrl = getRoomShareUrl(code);
  const roomName = room?.name || 'Room';

  const handleCopy = async (text, type) => {
    await copyToClipboard(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleNativeShare = async () => {
    const shared = await shareRoom(code, roomName);
    if (!shared) {
      handleCopy(shareUrl, 'link');
    }
  };

  return (
    <div className="setup-page">
      <motion.div
        className="setup-container share-room"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}
        >
          🎉
        </motion.div>

        <h1 className="setup-title">Room Created!</h1>
        <p className="setup-subtitle">Share this with your roommates so they can join</p>

        <motion.div
          className="share-qr"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <QRCodeSVG
            value={shareUrl}
            size={180}
            bgColor="white"
            fgColor="#1c1c1e"
            level="M"
            includeMargin={false}
          />
        </motion.div>

        <motion.div
          className="share-code"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {code}
        </motion.div>

        <p className="copy-feedback">{copied === 'code' ? '✓ Code copied!' : ' '}</p>

        <div className="share-actions">
          <button className="btn btn-primary" onClick={handleNativeShare}>
            📤 Share
          </button>
          <button className="btn btn-secondary" onClick={() => handleCopy(shareUrl, 'link')}>
            {copied === 'link' ? '✓ Copied!' : '📋 Copy Link'}
          </button>
          <button className="btn btn-secondary" onClick={() => handleCopy(code, 'code')}>
            {copied === 'code' ? '✓ Copied!' : '🔢 Code'}
          </button>
        </div>

        <div className="share-divider">or</div>

        <button
          className="btn btn-primary btn-full"
          onClick={() => navigate('/dashboard')}
          id="btn-go-to-dashboard"
        >
          🚀 Go to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
