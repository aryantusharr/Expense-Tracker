import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Header from '../layout/Header';
import CategoryManager from '../categories/CategoryManager';
import Modal from '../common/Modal';
import { useRoomContext } from '../../context/RoomContext';
import { useTheme } from '../../context/ThemeContext';
import { generateExpenseReport } from '../../utils/pdfExport';
import { exportToExcel, exportToExcelMonthly } from '../../utils/excelExport';
import { calculateBalances } from '../../utils/splitCalculator';
import { getRoomShareUrl, copyToClipboard } from '../../utils/helpers';
import { QRCodeSVG } from 'qrcode.react';
import './Settings.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function SettingsPage() {
  const { room, roomCode, expenses, users, categories, switchRoom, updateRoom } = useRoomContext();
  const { theme, toggleTheme } = useTheme();
  const [showShare, setShowShare] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const [showExportScope, setShowExportScope] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [exportMode, setExportMode] = useState('all'); // 'all' or 'monthly'
  const [selectedMonth, setSelectedMonth] = useState(null);

  const isPersonal = room?.isPersonal === true;

  // Get months that have expenses for the picker
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
        {/* Room Info */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
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

        {/* Theme */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="section-title">Appearance</h3>
          <div className="setting-row">
            <span className="setting-label">{theme === 'dark' ? '🌙' : '☀️'} Dark Mode</span>
            <button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={toggleTheme}>
              <div className="toggle-knob" />
            </button>
          </div>
        </motion.div>

        {/* Export */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="section-title">Export</h3>
          <button className="export-btn" onClick={() => setShowExportScope(true)}>
            📤 Export Data
          </button>
        </motion.div>

        {/* Categories */}
        <motion.div
          className="card settings-section"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <CategoryManager />
        </motion.div>

        {/* Leave Room */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <button className="btn btn-secondary btn-full" onClick={switchRoom} style={{ marginTop: 'var(--space-lg)' }}>
            🔄 Switch Room
          </button>
          <p className="text-center text-secondary" style={{ fontSize: 'var(--font-xs)', marginTop: 'var(--space-sm)' }}>
            Your rooms are saved — switch anytime
          </p>
        </motion.div>

        {/* Share Modal */}
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

        {/* Export Scope Modal */}
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

        {/* Format Picker Modal */}
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

        {/* Month Picker Modal */}
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

        {/* Budget Modal */}
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
      </div>
    </>
  );
}
