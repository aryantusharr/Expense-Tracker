import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { getRoomShareUrl, copyToClipboard, shareRoom } from '../../utils/helpers';
import { useRoomContext } from '../../context/RoomContext';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import { syncExistingSharedExpenses, removeSyncedExpensesFromPersonalRooms } from '../../services/expenseService';
import './Setup.css';

export default function ShareRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { room, savedRooms, updateRoom, setUserIdentity } = useRoomContext();
  const [copied, setCopied] = useState('');
  
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [showDualSelect, setShowDualSelect] = useState(false);
  const [selectedPersonalRoom, setSelectedPersonalRoom] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  const personalRooms = useMemo(() => savedRooms.filter(r => r.isPersonal), [savedRooms]);

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

  const handleGotoDashboardClick = () => {
    setShowSyncPrompt(true);
  };

  const handleSyncPromptYes = () => {
    setShowSyncPrompt(false);
    setShowDualSelect(true);
  };

  const handleSyncPromptNo = () => {
    setShowSyncPrompt(false);
    navigate('/dashboard');
  };

  const handleConfirmMapping = async () => {
    if (!selectedPersonalRoom || !selectedUser) return;
    
    try {
      // 1. Clean up old synced expenses from all personal rooms on this device
      const allPersonalRoomCodes = savedRooms.filter(r => r.isPersonal).map(r => r.code);
      await removeSyncedExpensesFromPersonalRooms(code, allPersonalRoomCodes);

      // 2. Save mapping in Firestore users list
      const updatedUsers = room.users.map(u => 
        u.id === selectedUser ? { ...u, personalRoomCode: selectedPersonalRoom } : u
      );
      await updateRoom(code, { users: updatedUsers });
      
      setUserIdentity(selectedUser);

      // 3. Sync existing shared expenses to the personal room in the background
      syncExistingSharedExpenses(code, room?.name || 'Shared Room', selectedPersonalRoom, selectedUser).catch(err => {
        // Silent error
      });
    } catch (err) {
      // Silent error
    }
    
    setShowWarning(false);
    setShowDualSelect(false);
    navigate('/dashboard');
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
          onClick={handleGotoDashboardClick}
          id="btn-go-to-dashboard"
        >
          🚀 Go to Dashboard
        </button>
      </motion.div>

      {/* 1. Initial Prompt */}
      <ConfirmModal
        isOpen={showSyncPrompt}
        onClose={handleSyncPromptNo}
        onConfirm={handleSyncPromptYes}
        title="Sync Expenses?"
        message={`Would you like to automatically sync your share of ${roomName} expenses to your Personal Expenses tracker?`}
        confirmText="Yes, setup sync"
        cancelText="No, skip"
      />

      {/* 2. Dual Selection Modal */}
      <Modal isOpen={showDualSelect} onClose={() => setShowDualSelect(false)} title="Setup Profile Sync">
        <div className="expense-form" style={{ paddingBottom: 'var(--space-md)' }}>
          {personalRooms.length === 0 ? (
            <div className="text-center text-danger" style={{ padding: 'var(--space-md)', background: 'rgba(255,107,107,0.1)', borderRadius: 'var(--radius-md)' }}>
              <p>⚠️ No personal rooms found on this device.</p>
              <p style={{ fontSize: 'var(--font-sm)', marginTop: 'var(--space-xs)' }}>Please create a Personal Room first before setting up sync.</p>
            </div>
          ) : (
            <>
              <div className="input-group">
                <label>Choose your Personal Room</label>
                <select 
                  className="input" 
                  value={selectedPersonalRoom} 
                  onChange={(e) => setSelectedPersonalRoom(e.target.value)}
                >
                  <option value="" disabled>Select a room...</option>
                  {personalRooms.map(pr => (
                    <option key={pr.code} value={pr.code}>{pr.name}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Which person are you in <strong style={{ color: 'var(--accent)' }}>{roomName}</strong>?</label>
                <select 
                  className="input" 
                  value={selectedUser} 
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="" disabled>Select your profile...</option>
                  {room?.users?.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <button 
                className="btn btn-primary btn-full" 
                disabled={!selectedPersonalRoom || !selectedUser}
                onClick={() => setShowWarning(true)}
                style={{ marginTop: 'var(--space-lg)' }}
              >
                Link Profiles
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* 3. Confirmation Warning */}
      <ConfirmModal
        isOpen={showWarning}
        onClose={() => setShowWarning(false)}
        onConfirm={handleConfirmMapping}
        title="Are you sure?"
        message="This will automatically sync your share of any future and past expenses in this room to your selected personal room. You can change this later in Settings."
        confirmText="Confirm Sync"
      />
    </div>
  );
}
