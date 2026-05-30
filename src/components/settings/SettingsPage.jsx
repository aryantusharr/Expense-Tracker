/* eslint-disable */
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Header from '../layout/Header';
import CategoryManager from '../categories/CategoryManager';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import ImportCSVModal from './ImportCSVModal';
import { useRoomContext } from '../../context/RoomContext';
import { useTheme } from '../../context/ThemeContext';
import { generateExpenseReport } from '../../utils/pdfExport';
import { exportToExcel, exportToExcelMonthly } from '../../utils/excelExport';
import { calculateBalances } from '../../utils/splitCalculator';
import { getRoomShareUrl, copyToClipboard } from '../../utils/helpers';
import { syncExistingSharedExpenses, removeSyncedExpensesFromPersonalRooms } from '../../services/expenseService';
import { QRCodeSVG } from 'qrcode.react';
import './Settings.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function SettingsPage() {
  const { room, roomCode, expenses, users, categories, switchRoom, updateRoom, userIdentity, setUserIdentity, savedRooms } = useRoomContext();
  const { theme, toggleTheme } = useTheme();
  const [showShare, setShowShare] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const [showExportScope, setShowExportScope] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [exportMode, setExportMode] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Sync state
  const [showSyncSetup, setShowSyncSetup] = useState(false);
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const [showDisableWarning, setShowDisableWarning] = useState(false);
  const [showEnableWarning, setShowEnableWarning] = useState(false);
  const [selectedPersonalRoom, setSelectedPersonalRoom] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const personalRooms = useMemo(() => savedRooms.filter(r => r.isPersonal), [savedRooms]);
  
  const currentUser = useMemo(() => users?.find(u => u.id === userIdentity), [users, userIdentity]);
  const currentPersonalRoom = useMemo(() => {
    if (!currentUser?.personalRoomCode) return null;
    return savedRooms.find(r => r.code === currentUser.personalRoomCode) || null;
  }, [savedRooms, currentUser]);
  const isSyncActive = Boolean(currentUser?.personalRoomCode);

  // Handle the toggle button click — show appropriate warning
  const handleToggleSync = () => {
    if (isSyncActive) {
      // Turning OFF → show disable warning
      setShowDisableWarning(true);
    } else if (currentPersonalRoom) {
      // Turning ON (has previous mapping) → show enable warning
      setShowEnableWarning(true);
    } else {
      // No mapping exists → open setup
      handleChangeSyncClick();
    }
  };

  // Confirm disable sync
  const handleConfirmDisable = async () => {
    setSyncLoading(true);
    try {
      const updatedUsers = users.map(u => 
        u.id === userIdentity ? { ...u, personalRoomCode: null } : u
      );
      await updateRoom(roomCode, { users: updatedUsers });
      setSyncMessage('✅ Sync has been turned OFF. New expenses will no longer sync to your personal room.');
      setTimeout(() => setSyncMessage(''), 4000);
    } catch (err) {
      console.error('Failed to disable sync:', err);
      setSyncMessage('❌ Failed to disable sync. Please try again.');
      setTimeout(() => setSyncMessage(''), 4000);
    }
    setSyncLoading(false);
    setShowDisableWarning(false);
  };

  // Confirm enable sync (re-enable with existing mapping)
  const handleConfirmEnable = async () => {
    if (!currentUser?._lastPersonalRoomCode && !currentPersonalRoom) {
      // No previous mapping — open setup instead
      setShowEnableWarning(false);
      handleChangeSyncClick();
      return;
    }

    setSyncLoading(true);
    try {
      // Re-enable with the last known personal room code
      const personalCode = currentUser._lastPersonalRoomCode || currentPersonalRoom?.code;
      if (!personalCode) {
        setShowEnableWarning(false);
        handleChangeSyncClick();
        setSyncLoading(false);
        return;
      }
      const updatedUsers = users.map(u => 
        u.id === userIdentity ? { ...u, personalRoomCode: personalCode } : u
      );
      await updateRoom(roomCode, { users: updatedUsers });
      setSyncMessage('✅ Sync has been turned ON. Your expenses will now sync to your personal room.');
      setTimeout(() => setSyncMessage(''), 4000);
    } catch (err) {
      console.error('Failed to enable sync:', err);
      setSyncMessage('❌ Failed to enable sync. Please try again.');
      setTimeout(() => setSyncMessage(''), 4000);
    }
    setSyncLoading(false);
    setShowEnableWarning(false);
  };

  const handleChangeSyncClick = () => {
    setSelectedUser(userIdentity || '');
    setSelectedPersonalRoom(currentUser?.personalRoomCode || '');
    setShowSyncSetup(true);
  };

  const handleConfirmMapping = async () => {
    if (!selectedPersonalRoom || !selectedUser) return;
    
    setSyncLoading(true);
    try {
      // 1. Clean up old synced expenses from all personal rooms on this device
      const allPersonalRoomCodes = savedRooms.filter(r => r.isPersonal).map(r => r.code);
      await removeSyncedExpensesFromPersonalRooms(roomCode, allPersonalRoomCodes);

      // 2. Save mapping in Firestore users list
      // Also clear personalRoomCode for the old identity if we are changing who we are
      const updatedUsers = users.map(u => {
        if (u.id === selectedUser) {
          return { ...u, personalRoomCode: selectedPersonalRoom };
        }
        if (u.personalRoomCode === selectedPersonalRoom || u.id === userIdentity) {
          return { ...u, personalRoomCode: null, _lastPersonalRoomCode: u.personalRoomCode };
        }
        return u;
      });
      await updateRoom(roomCode, { users: updatedUsers });
      
      setUserIdentity(selectedUser);

      // 3. Sync existing shared expenses to the personal room in the background
      syncExistingSharedExpenses(roomCode, room?.name || 'Shared Room', selectedPersonalRoom, selectedUser).catch(err => {
        console.error('Background sync of existing expenses failed:', err);
      });

      setSyncMessage('✅ Profile sync configured! Existing expenses will sync in the background.');
      setTimeout(() => setSyncMessage(''), 4000);
    } catch (err) {
      console.error('Failed to confirm mapping:', err);
      setSyncMessage('❌ Failed to configure sync. Please try again.');
      setTimeout(() => setSyncMessage(''), 4000);
    }
    setSyncLoading(false);
    setShowSyncWarning(false);
    setShowSyncSetup(false);
  };

  const importHistory = useMemo(() => {
    try {
      const hist = JSON.parse(localStorage.getItem('csv-import-history') || '[]');
      return hist[0] || null;
    } catch { return null; }
  }, [showImportModal]);

  const isPersonal = room?.isPersonal === true;

  const availableMonths = useMemo(() => {
    const months = new Set();
    expenses.forEach(e => {
      const d = new Date(e.date);
      months.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    return Array.from(months)
      .map(key => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, label: `${MONTH_NAMES[month]} ${year}` };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month);
  }, [expenses]);

  const handleExportFullPdf = () => {
    const balances = calculateBalances(expenses, users);
    generateExpenseReport(expenses, users, balances, room?.name || 'Room', categories);
    setShowFormatPicker(false);
  };

  const handleExportFullExcel = () => {
    exportToExcel(expenses, categories, room?.name || 'SplitEase');
    setShowFormatPicker(false);
  };

  const handleExportMonthPdf = (monthObj) => {
    const filtered = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === monthObj.month && d.getFullYear() === monthObj.year;
    });
    const balances = calculateBalances(filtered, users);
    generateExpenseReport(filtered, users, balances, room?.name || 'Room', categories, monthObj);
    setShowFormatPicker(false);
  };

  const handleExportMonthExcel = (monthObj) => {
    exportToExcelMonthly(expenses, categories, room?.name || 'SplitEase', monthObj);
    setShowFormatPicker(false);
  };

  const openFormatPickerForMode = (mode, monthObj = null) => {
    setExportMode(mode);
    setSelectedMonth(monthObj);
    setShowExportScope(false);
    if (mode === 'monthly' && !monthObj) {
      setTimeout(() => setShowMonthPicker(true), 200);
    } else {
      setTimeout(() => setShowFormatPicker(true), 200);
    }
  };

  const handleMonthSelect = (m) => {
    setShowMonthPicker(false);
    setSelectedMonth(m);
    setTimeout(() => setShowFormatPicker(true), 200);
  };

  const handleCopy = async () => {
    await copyToClipboard(getRoomShareUrl(roomCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveBudget = async () => {
    if (budgetInput && !isNaN(budgetInput)) {
      await updateRoom(roomCode, { budget: parseFloat(budgetInput) });
      setShowBudgetModal(false);
    }
  };

  return (
    <>
      <Header title="Settings" />
      <div className="page-content">
        
        {/* Sync Status Message */}
        {syncMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              background: syncMessage.startsWith('✅') ? 'rgba(0, 206, 201, 0.15)' : 'rgba(255, 107, 107, 0.15)',
              color: syncMessage.startsWith('✅') ? 'var(--success)' : 'var(--danger)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              marginBottom: 'var(--space-md)',
              border: `1px solid ${syncMessage.startsWith('✅') ? 'rgba(0, 206, 201, 0.3)' : 'rgba(255, 107, 107, 0.3)'}`,
            }}
          >
            {syncMessage}
          </motion.div>
        )}

        {/* 1. Switch Room Card */}
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

        {/* 2. Room Info */}
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

        {/* 3. Categories */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.06 }}
        >
          <CategoryManager />
        </motion.div>

        {/* 4. Appearance (Theme) */}
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

        {/* 5. Profile Sync */}
        {!isPersonal && (
          <motion.div
            className="card settings-section"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Profile Sync</h3>
              {currentUser && (
                <button 
                  className={`toggle ${isSyncActive ? 'active' : ''}`} 
                  onClick={handleToggleSync}
                  disabled={syncLoading}
                >
                  <div className="toggle-knob" />
                </button>
              )}
            </div>
            
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
              Automatically sync your share of room expenses to your personal tracker.
            </p>

            {currentUser && isSyncActive && currentPersonalRoom ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {currentUser.name} <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>→</span> {currentPersonalRoom.name}
                  </span>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--success)' }}>
                    ✓ Sync is ON
                  </span>
                </div>
                <button className="btn btn-secondary" onClick={handleChangeSyncClick} style={{ padding: '6px 12px', fontSize: 'var(--font-xs)' }}>
                  Change
                </button>
              </div>
            ) : currentUser && !isSyncActive ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Sync is OFF
                  </span>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                    Turn on to auto-sync expenses
                  </span>
                </div>
                <button className="btn btn-primary" onClick={handleChangeSyncClick} style={{ padding: '6px 12px', fontSize: 'var(--font-xs)' }}>
                  Setup
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-full" onClick={handleChangeSyncClick}>
                Setup Profile Sync
              </button>
            )}
          </motion.div>
        )}

        {/* 6. Data Management */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
        >
          <h3 className="section-title">Data Management</h3>
          <button className="export-btn" onClick={() => setShowExportScope(true)}>
            📤 Export Data
          </button>
          <div className="data-mgmt-divider" />
          <button className="import-btn" onClick={() => setShowImportModal(true)}>
            📥 Import CSV
          </button>
          {importHistory && (
            <div className="import-history">
              <span className="import-history-icon">✅</span>
              <span className="import-history-text">
                Last import: <strong>{importHistory.count} expenses</strong> · {new Date(importHistory.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </motion.div>

        {/* Modals */}
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

        <Modal isOpen={showExportScope} onClose={() => setShowExportScope(false)} title="Export Scope">
          <div className="flex-col gap-sm">
            <div className="export-option-card" onClick={() => openFormatPickerForMode('all')}>
              <div className="export-option-icon">📋</div>
              <div className="export-option-text">
                <div className="export-option-title">All Transactions</div>
                <div className="export-option-subtitle">Export your entire transaction history</div>
              </div>
            </div>
            <div className="export-option-card" onClick={() => openFormatPickerForMode('monthly')}>
              <div className="export-option-icon">📅</div>
              <div className="export-option-text">
                <div className="export-option-title">Monthly Report</div>
                <div className="export-option-subtitle">Export a specific month's data</div>
              </div>
            </div>
          </div>
        </Modal>

        <Modal isOpen={showFormatPicker} onClose={() => setShowFormatPicker(false)} title="Choose Format">
          <div className="flex-col gap-sm">
            <div className="export-option-card" onClick={exportMode === 'all' ? handleExportFullPdf : () => handleExportMonthPdf(selectedMonth)}>
              <div className="export-option-icon">📄</div>
              <div className="export-option-text">
                <div className="export-option-title">PDF Document</div>
                <div className="export-option-subtitle">Best for printing and sharing</div>
              </div>
            </div>
            <div className="export-option-card" onClick={exportMode === 'all' ? handleExportFullExcel : () => handleExportMonthExcel(selectedMonth)}>
              <div className="export-option-icon">📊</div>
              <div className="export-option-text">
                <div className="export-option-title">Excel (.xlsx)</div>
                <div className="export-option-subtitle">Best for analysis and editing</div>
              </div>
            </div>
          </div>
        </Modal>

        <Modal isOpen={showMonthPicker} onClose={() => setShowMonthPicker(false)} title="Select Month">
          <div className="month-picker-list">
            {availableMonths.length === 0 ? (
              <p className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>
                No expenses yet
              </p>
            ) : (
              availableMonths.map(m => (
                <button
                  key={`${m.year}-${m.month}`}
                  className="btn btn-secondary btn-full"
                  style={{ marginBottom: 'var(--space-sm)' }}
                  onClick={() => handleMonthSelect(m)}
                >
                  📄 {m.label}
                </button>
              ))
            )}
          </div>
        </Modal>

        <Modal isOpen={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Edit Budget">
          <div className="expense-form">
            <div className="input-group">
              <label>Monthly Budget (₹)</label>
              <input 
                className="input" 
                type="number" 
                value={budgetInput} 
                onChange={(e) => setBudgetInput(e.target.value)} 
                placeholder="e.g. 50000"
              />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleSaveBudget}>
              Save Budget
            </button>
          </div>
        </Modal>

        <ImportCSVModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
        />

        {/* Dual Selection Modal */}
        <Modal isOpen={showSyncSetup} onClose={() => setShowSyncSetup(false)} title="Setup Profile Sync">
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
                  <label>Which person are you in <strong style={{ color: 'var(--accent)' }}>{room?.name || 'this room'}</strong>?</label>
                  <select 
                    className="input" 
                    value={selectedUser} 
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="" disabled>Select your profile...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <button 
                  className="btn btn-primary btn-full" 
                  disabled={!selectedPersonalRoom || !selectedUser || syncLoading}
                  onClick={() => setShowSyncWarning(true)}
                  style={{ marginTop: 'var(--space-lg)' }}
                >
                  {syncLoading ? '⏳ Linking...' : 'Link Profiles'}
                </button>
              </>
            )}
          </div>
        </Modal>

        {/* Confirmation Warning for new mapping */}
        <ConfirmModal
          isOpen={showSyncWarning}
          onClose={() => setShowSyncWarning(false)}
          onConfirm={handleConfirmMapping}
          title="Confirm Profile Sync"
          message="This will automatically sync your share of any future and past expenses in this room to your selected personal room. Synced entries will be read-only in your personal room."
          confirmText="Confirm Sync"
          isDanger={false}
        />

        {/* Disable Sync Warning */}
        <ConfirmModal
          isOpen={showDisableWarning}
          onClose={() => setShowDisableWarning(false)}
          onConfirm={handleConfirmDisable}
          title="Turn Off Sync?"
          message="Turning off sync will stop new shared expenses from being automatically added to your personal room. Previously synced expenses will remain in your personal room."
          confirmText="Turn Off"
          isDanger={true}
        />

        {/* Enable Sync Warning */}
        <ConfirmModal
          isOpen={showEnableWarning}
          onClose={() => setShowEnableWarning(false)}
          onConfirm={handleConfirmEnable}
          title="Turn On Sync?"
          message={`New shared expenses will be automatically synced to ${currentPersonalRoom?.name || 'your personal room'}. Your share will appear as read-only entries.`}
          confirmText="Turn On"
          isDanger={false}
        />

      </div>
    </>
  );
}
