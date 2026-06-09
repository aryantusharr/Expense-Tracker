import { useState } from 'react';
import { motion } from 'framer-motion';
import Header from '../layout/Header';
import CategoryManager from '../categories/CategoryManager';
import Modal from '../common/Modal';
import SyncSettings from './SyncSettings';
import DataManagement from './DataManagement';
import { useRoomContext } from '../../context/RoomContext';
import { useTheme } from '../../context/ThemeContext';
import { copyToClipboard } from '../../utils/helpers';
import './Settings.css';

// Copy icon SVG
function CopyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export default function SettingsPage() {
  const { room, roomCode, expenses, users, categories, switchRoom, updateRoom, userIdentity, setUserIdentity, savedRooms } = useRoomContext();
  const { theme, toggleTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const isPersonal = room?.isPersonal === true;

  const handleCopy = async () => {
    await copyToClipboard(roomCode);
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

          {/* Name row */}
          <div className="setting-row">
            <span className="setting-label">Name</span>
            <span className="setting-value">{room?.name}</span>
          </div>

          {/* Personal: Code row between Name and Budget */}
          {isPersonal && (
            <div className="setting-row" style={{ alignItems: 'center' }}>
              <span className="setting-label">Code</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span className="setting-value setting-code">{roomCode}</span>
                <button
                  className="btn-icon"
                  onClick={handleCopy}
                  title="Copy Code"
                  style={{
                    width: '30px',
                    height: '30px',
                    background: copied ? 'rgba(0, 206, 201, 0.15)' : 'var(--bg-input)',
                    border: copied ? '1px solid rgba(0, 206, 201, 0.4)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: copied ? 'var(--success)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <CopyIcon size={14} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Personal: Budget row — always show, allow adding if missing */}
          {isPersonal && (
            <div className="setting-row" style={{ alignItems: 'center' }}>
              <span className="setting-label">Budget</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span className="setting-value">
                  {room?.budget ? `₹${room.budget.toLocaleString('en-IN')}/mo` : 'Not set'}
                </span>
                <button
                  className="btn-icon"
                  onClick={() => { setBudgetInput(String(room?.budget || '')); setShowBudgetModal(true); }}
                  title={room?.budget ? 'Edit Budget' : 'Add Budget'}
                  style={{ width: '30px', height: '30px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
              </div>
            </div>
          )}


          {/* Shared room: Code with inline copy icon + Members */}
          {!isPersonal && (
            <>
              <div className="setting-row" style={{ alignItems: 'center' }}>
                <span className="setting-label">Code</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className="setting-value setting-code">{roomCode}</span>
                  <button
                    className="btn-icon"
                    onClick={handleCopy}
                    title="Copy Code"
                    style={{
                      width: '30px',
                      height: '30px',
                      background: copied ? 'rgba(0, 206, 201, 0.15)' : 'var(--bg-input)',
                      border: copied ? '1px solid rgba(0, 206, 201, 0.4)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: copied ? 'var(--success)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    {copied ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <CopyIcon size={14} />
                    )}
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <span className="setting-label">Members</span>
                <span className="setting-value">{users.length}</span>
              </div>
            </>
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
