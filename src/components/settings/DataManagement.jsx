import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../common/Modal';
import ImportCSVModal from './ImportCSVModal';
import { generateExpenseReport } from '../../utils/pdfExport';
import { exportToExcel, exportToExcelMonthly } from '../../utils/excelExport';
import { calculateBalances } from '../../utils/splitCalculator';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Data management section extracted from SettingsPage.
 * Manages export scope/format pickers, import trigger, and import history.
 */
export default function DataManagement({ expenses, users, categories, room, roomCode }) {
  const [showExportScope, setShowExportScope] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [exportMode, setExportMode] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBannerDismissed, setImportBannerDismissed] = useState(false);

  const importHistory = useMemo(() => {
    try {
      const hist = JSON.parse(localStorage.getItem('csv-import-history') || '[]');
      return hist[0] || null;
    } catch { return null; }
  }, [showImportModal]);

  // Room-scoped 7-day import banner
  const importBanner = useMemo(() => {
    try {
      const ts = localStorage.getItem('lastImportTimestamp');
      const rc = localStorage.getItem('lastImportRoomCode');
      const count = localStorage.getItem('lastImportItemCount');
      if (!ts || !rc || !count) return null;
      if (rc !== roomCode) return null;
      const age = Date.now() - new Date(ts).getTime();
      if (age > SEVEN_DAYS_MS) return null;
      return { count: parseInt(count, 10), timestamp: ts };
    } catch { return null; }
  }, [roomCode, showImportModal]);

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

  return (
    <>
      {/* Room-scoped import success banner (7-day TTL) */}
      <AnimatePresence>
        {importBanner && !importBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px var(--space-md)',
              marginBottom: 'var(--space-md)',
              background: 'var(--success-bg)',
              border: '1px solid rgba(0, 206, 201, 0.3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-xs)',
              color: 'var(--success)',
              fontWeight: 500,
            }}
          >
            <span>
              ✅ <strong>{importBanner.count} expenses</strong> imported to this room on{' '}
              {new Date(importBanner.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
            <button
              onClick={() => setImportBannerDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--success)',
                cursor: 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
                padding: '0 4px',
                opacity: 0.7,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="card settings-section"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
      >
        <h3 className="section-title">Data Management</h3>
        <button className="export-btn" onClick={() => setShowExportScope(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <motion.g
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            >
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </motion.g>
          </svg>
          Export Data
        </button>
        <div className="data-mgmt-divider" />
        <button className="import-btn" onClick={() => setShowImportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <motion.g
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            >
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </motion.g>
          </svg>
          Import CSV
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
            <p className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>No expenses yet</p>
          ) : (
            availableMonths.map(m => (
              <button key={`${m.year}-${m.month}`} className="btn btn-secondary btn-full" style={{ marginBottom: 'var(--space-sm)' }} onClick={() => handleMonthSelect(m)}>
                📄 {m.label}
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Import CSV Modal */}
      <ImportCSVModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />
    </>
  );
}
