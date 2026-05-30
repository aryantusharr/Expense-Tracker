import { useState } from 'react';
import { motion } from 'framer-motion';
import Header from '../layout/Header';
import CategoryManager from '../categories/CategoryManager';
import Modal from '../common/Modal';
import SyncSettings from './SyncSettings';
import DataManagement from './DataManagement';
import { useRoomContext } from '../../context/RoomContext';
import { useTheme } from '../../context/ThemeContext';
import { getRoomShareUrl, copyToClipboard } from '../../utils/helpers';
import { QRCodeSVG } from 'qrcode.react';
import './Settings.css';

export default function SettingsPage() {
  const { room, roomCode, expenses, users, categories, switchRoom, updateRoom, userIdentity, setUserIdentity, savedRooms } = useRoomContext();
  const { theme, toggleTheme } = useTheme();
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const isPersonal = room?.isPersonal === true;

  const handleCopy = async () => {
    await copyToClipboard(getRoomShareUrl(roomCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveBudget = async () => {
    if (!budgetInput || isNaN(budgetInput)) return;
    await updateRoom(roomCode, { budget: parseFloat(budgetInput) });
    setShowBudgetModal(false);
  };

  return (
    <>
      <Header title="Settings" />
      <div className="page-content">

        {/* Profile Sync (shared rooms only) */}
        {!isPersonal && (
          <SyncSettings
            room={room}
            roomCode={roomCode}
            users={users}
            userIdentity={userIdentity}
            setUserIdentity={setUserIdentity}
            savedRooms={savedRooms}
            updateRoom={updateRoom}
          />
        )}

        {/* Switch Room */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 className="section-title" style={{ marginBottom: 4 }}>Switch Room</h3>
              <p className="text-secondary" style={{ fontSize: 'var(--font-xs)', margin: 0 }}>
                Leave this room and go to dashboard
              </p>
            </div>
            <button className="btn btn-secondary" onClick={switchRoom} style={{ padding: '8px 16px' }}>
              🔄 Switch
            </button>
          </div>
        </motion.div>

        {/* Room Info */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.03 }}
        >
          <h3 className="section-title">Room</h3>
          <div className="setting-row">
            <span className="setting-label">Name</span>
            <span className="setting-value">{room?.name}</span>
          </div>
          {!isPersonal && (
            <>
              <div className="setting-row">
                <span className="setting-label">Code</span>
                <span className="setting-value setting-code">{roomCode}</span>
              </div>
              <div className="setting-row">
                <span className="setting-label">Members</span>
                <span className="setting-value">{users.length}</span>
              </div>
              <button className="btn btn-secondary btn-full" onClick={() => setShowShare(true)} style={{ marginTop: 'var(--space-md)' }}>
                Share Room
              </button>
            </>
          )}
          {isPersonal && room?.budget !== undefined && (
            <div className="setting-row" style={{ alignItems: 'center' }}>
              <span className="setting-label">Budget</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span className="setting-value">₹{room.budget.toLocaleString('en-IN')}/mo</span>
                <button
                  className="btn-icon"
                  onClick={() => { setBudgetInput(String(room.budget)); setShowBudgetModal(true); }}
                  style={{ width: '30px', height: '30px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Categories */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.06 }}
        >
          <CategoryManager />
        </motion.div>

        {/* Appearance */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.09 }}
        >
          <h3 className="section-title">Appearance</h3>
          <div className="setting-row">
            <span className="setting-label">{theme === 'dark' ? '🌙' : '☀️'} Dark Mode</span>
            <button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={toggleTheme}>
              <div className="toggle-knob" />
            </button>
          </div>
        </motion.div>

        {/* Data Management */}
        <DataManagement expenses={expenses} users={users} categories={categories} room={room} />

        {/* Share Room Modal */}
        <Modal isOpen={showShare} onClose={() => setShowShare(false)} title="Share Room">
          <div className="text-center">
            <div className="share-qr" style={{ margin: 'var(--space-lg) auto' }}>
              <QRCodeSVG value={getRoomShareUrl(roomCode)} size={160} bgColor="white" fgColor="#1c1c1e" level="M" />
            </div>
            <p className="share-code">{roomCode}</p>
            <button className="btn btn-primary btn-full" onClick={handleCopy}>
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
          </div>
        </Modal>

        {/* Budget Modal */}
        <Modal isOpen={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Edit Budget">
          <div className="expense-form">
            <div className="input-group">
              <label>Monthly Budget (₹)</label>
              <input className="input" type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="e.g. 50000" />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleSaveBudget}>Save Budget</button>
          </div>
        </Modal>

      </div>
    </>
  );
}
