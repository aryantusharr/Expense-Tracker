// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useRoomContext } from '../../context/RoomContext';
import { addExpense } from '../../services/expenseService';
import { formatCurrency, getTodayISO } from '../../utils/helpers';
import './Expenses.css';

export default function SharedBifurcationModal({ isOpen, onClose, transaction, room, onSuccess }) {
  const { roomCode, userIdentity } = useRoomContext();
  
// eslint-disable-next-line react-hooks/exhaustive-deps
  const categories = room?.categories || [];
// eslint-disable-next-line react-hooks/exhaustive-deps
  const users = room?.users || [];
  
  const [mode, setMode] = useState('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Global Paid By
  const [globalPaidBy, setGlobalPaidBy] = useState(() => {
    return userIdentity && users.some(u => u.id === userIdentity) 
      ? userIdentity 
      : (users[0]?.id || '');
  });

  // Single mode state
  const [singleDescription, setSingleDescription] = useState('');
  const [singleDate, setSingleDate] = useState(getTodayISO());
  const [singleCategoryId, setSingleCategoryId] = useState('cat-1');
  const [singleSplitAmong, setSingleSplitAmong] = useState([]);

  // Itemise Mode rows state — each row has splitAmong array
  const [rows, setRows] = useState([{ categoryId: 'cat-1', description: '', amount: '', splitAmong: [], error: '' }]);

  // Low confidence — rawText expansion
  const [showRawText, setShowRawText] = useState(false);
  const isLowConfidence = transaction?.confidence === 'low';

  // Initialize
  useEffect(() => {
    if (!transaction || !categories || categories.length === 0 || users.length === 0) return;
    
    const matched = categories.find(
      c => c.name.toLowerCase() === (transaction.suggestedCategoryName || '').toLowerCase()
    );
    const allUserIds = users.map(u => u.id);

    // For low confidence items — no pre-fills except date
    if (isLowConfidence) {
// eslint-disable-next-line react-hooks/set-state-in-effect
      setSingleCategoryId(categories[0]?.id || 'cat-1');
      setSingleDate(transaction.date || getTodayISO());
      setSingleDescription('');
      setSingleSplitAmong([...allUserIds]);
      setRows([{ categoryId: categories[0]?.id || 'cat-1', description: '', amount: '', splitAmong: [...allUserIds], error: '' }]);
    } else {
      const defaultCatId = matched ? matched.id : (categories[0]?.id || 'cat-1');
      setSingleCategoryId(defaultCatId);
      setSingleDate(transaction.date || getTodayISO());
      setSingleDescription('');
      setSingleSplitAmong([...allUserIds]);
      setRows([{ categoryId: defaultCatId, description: '', amount: '', splitAmong: [...allUserIds], error: '' }]);
    }
    
    setGlobalPaidBy(
      userIdentity && users.some(u => u.id === userIdentity) 
        ? userIdentity 
        : (users[0]?.id || '')
    );
    setMode('single');
    setError('');
    setShowRawText(false);
  }, [transaction, categories, users, userIdentity, isLowConfidence]);

  if (!transaction || !room) return null;

  // --- Reactive validations ---
  const hasSingleSplitIssue = singleSplitAmong.length === 0;
  const hasItemiseSplitIssue = rows.some(r => r.splitAmong.length === 0);
  const sumOfRows = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = parseFloat((transaction.amount - sumOfRows).toFixed(2));
  const isRemainingZero = Math.abs(remaining) < 0.01;

  // Confirm button disabled logic
  const isConfirmDisabled = loading ||
    (mode === 'single' && hasSingleSplitIssue) ||
    (mode === 'itemise' && (!isRemainingZero || hasItemiseSplitIssue));

  // Validate itemise rows — returns inline errors per row
  const validateAndMarkRows = () => {
    let valid = true;
// eslint-disable-next-line no-unused-vars
    const updated = rows.map((row, i) => {
      let rowError = '';
      if (!row.amount || parseFloat(row.amount) <= 0) {
        rowError = 'Amount must be greater than 0';
        valid = false;
      } else if (row.splitAmong.length === 0) {
        rowError = 'Select at least one member';
        valid = false;
      }
      return { ...row, error: rowError };
    });
    setRows(updated);
    return valid;
  };

  // Single confirm
  const handleSingleConfirm = async () => {
    if (hasSingleSplitIssue) return;
    if (!globalPaidBy) { setError('Please select who paid.'); return; }
    if (!navigator.onLine) {
      setError('You are offline. Your pending transactions are saved and will be here when you\'re back.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await addExpense(roomCode, {
        description: singleDescription.trim() || transaction.merchant || 'Untitled',
        amount: parseFloat(transaction.amount),
        paidBy: globalPaidBy,
        splitAmong: singleSplitAmong,
        categoryId: singleCategoryId,
        date: singleDate,
      }, room);

      await onSuccess(transaction.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save expense. Check your connection.');
      setLoading(false);
    }
  };

  // Itemise confirm
  const handleItemiseConfirm = async () => {
    if (!validateAndMarkRows()) return;
    if (!globalPaidBy) { setError('Please select who paid.'); return; }
    if (!navigator.onLine) {
      setError('You are offline. Your pending transactions are saved and will be here when you\'re back.');
      return;
    }

    setLoading(true);
    setError('');
    
    const remainingRows = [...rows];
    let failed = false;

    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        await addExpense(roomCode, {
          description: row.description.trim() || transaction.merchant || 'Itemised Expense',
          amount: parseFloat(row.amount),
          paidBy: globalPaidBy,
          splitAmong: row.splitAmong,
          categoryId: row.categoryId,
          date: singleDate,
        }, room);
        remainingRows.shift();
      }
// eslint-disable-next-line no-unused-vars
    } catch (err) {
      failed = true;
      const failedAmt = remainingRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      setError(`Partially saved. ₹${failedAmt} still pending. Check your connection and retry.`);
      setRows(remainingRows);
    }

    if (!failed) {
      await onSuccess(transaction.id);
      onClose();
    } else {
      setLoading(false);
    }
  };

  // --- Row helpers ---
  const addRow = () => {
    const defaultCatId = categories[0]?.id || 'cat-1';
    const allUserIds = users.map(u => u.id);
    // Auto-fill remaining amount for rows after the first
    const autoAmount = rows.length > 0 && remaining > 0 ? String(remaining) : '';
    // Insert at position 0 (top)
    setRows(prev => [
      { categoryId: defaultCatId, description: '', amount: autoAmount, splitAmong: [...allUserIds], error: '' },
      ...prev
    ]);
  };

  const removeRow = (index) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const updateRowField = (index, field, value) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value, error: '' } : r));
  };

  const toggleRowSplit = (rowIndex, userId) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      const splitList = row.splitAmong.includes(userId)
        ? row.splitAmong.filter(id => id !== userId)
        : [...row.splitAmong, userId];
      return { ...row, splitAmong: splitList, error: '' };
    }));
  };

  const toggleSingleSplit = (userId) => {
    setSingleSplitAmong(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Per person share calculators
  const singlePerPerson = singleSplitAmong.length > 0 
    ? (parseFloat(transaction.amount) / singleSplitAmong.length).toFixed(2) 
    : '0.00';

  const getRowPerPerson = (row) => {
    const amt = parseFloat(row.amount) || 0;
    return row.splitAmong.length > 0 ? (amt / row.splitAmong.length).toFixed(2) : '0.00';
  };

  // Format Date for header
  const getFormattedDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase();
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Shared Room Split" disableDrag={true}>
      <div className="bifurcation-container" style={{ paddingBottom: 'calc(var(--space-md) + var(--safe-area-bottom))' }}>
        
        {/* Sticky Header Display */}
        <div className="picker-tx-header card" style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md) var(--space-lg)',
          marginBottom: 'var(--space-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-md)',
          position: 'sticky',
          top: 0,
          zIndex: 20
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <span style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {transaction.merchant || 'Unknown'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-xs)' }}>
            <span style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--accent-light)' }}>
              {formatCurrency(transaction.amount)}
            </span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              {getFormattedDate(transaction.date)} {transaction.time ? `• ${transaction.time}` : ''}
            </span>
          </div>
        </div>

        {/* Low confidence rawText section */}
        {isLowConfidence && transaction.rawText && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <button
              type="button"
              onClick={() => setShowRawText(!showRawText)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--danger-bg)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--danger)',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>⚠️ Original SMS</span>
              <span>{showRawText ? '▲' : '▼'}</span>
            </button>
            {showRawText && (
              <pre style={{
                marginTop: 'var(--space-xs)',
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-xs)',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {transaction.rawText}
              </pre>
            )}
          </div>
        )}

        {/* Global Paid By */}
        <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>Paid By</label>
          <div className="user-select-row" style={{ display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto', paddingBottom: '4px' }}>
            {users.map(user => (
              <button
                key={user.id}
                type="button"
                className={`user-select-btn ${globalPaidBy === user.id ? 'active' : ''}`}
                onClick={() => { setGlobalPaidBy(user.id); setError(''); }}
                style={{ '--user-color': user.color }}
              >
                <div className="avatar avatar-sm" style={{ background: user.color }}>{user.name[0]}</div>
                <span>{user.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Toggle Mode Bar */}
        <div className="toggle-mode-bar" style={{
          display: 'flex',
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          marginBottom: 'var(--space-xl)',
          border: '1px solid var(--border-light)'
        }}>
          <button
            className={`toggle-btn ${mode === 'single' ? 'active' : ''}`}
            onClick={() => { setMode('single'); setError(''); }}
            style={{
              flex: 1, padding: 'var(--space-sm) 0', border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: mode === 'single' ? 'var(--bg-elevated)' : 'transparent',
              color: mode === 'single' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600, cursor: 'pointer',
              boxShadow: mode === 'single' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            Single Expense
          </button>
          <button
            className={`toggle-btn ${mode === 'itemise' ? 'active' : ''}`}
            onClick={() => { setMode('itemise'); setError(''); }}
            style={{
              flex: 1, padding: 'var(--space-sm) 0', border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: mode === 'itemise' ? 'var(--bg-elevated)' : 'transparent',
              color: mode === 'itemise' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600, cursor: 'pointer',
              boxShadow: mode === 'itemise' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            Itemise / Split
          </button>
        </div>

        {/* Mode Forms */}
        <div className="bifurcation-content" style={{ maxHeight: '42vh', overflowY: 'auto', paddingRight: '4px', marginBottom: 'var(--space-lg)' }}>
          {/* Global errors only (non-row-level) */}
          {error && <p className="error-text" style={{ margin: '0 0 var(--space-md) 0' }}>{error}</p>}

          {mode === 'single' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label>Amount</label>
                <input className="input read-only-input" type="text" value={formatCurrency(transaction.amount)}
                  readOnly style={{ opacity: 0.7, background: 'var(--border-light)' }} />
              </div>

              <div className="input-group">
                <label>Date</label>
                <input className="input" type="date" value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)} />
              </div>

              <div className="input-group">
                <label>Description <span className="optional-tag">(optional)</span></label>
                <input className="input" placeholder="e.g. Grocery run, Zepto dinner..."
                  value={singleDescription} onChange={(e) => setSingleDescription(e.target.value)} />
              </div>

              <div className="input-group">
                <label>Category</label>
                <select className="input select-input" value={singleCategoryId}
                  onChange={(e) => setSingleCategoryId(e.target.value)}
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Single Split Among */}
              <div className="input-group" style={{ marginTop: 'var(--space-sm)' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Split Among</span>
                  <button type="button" className="btn btn-sm"
                    onClick={() => setSingleSplitAmong(users.map(u => u.id))}
                    style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                    Select All
                  </button>
                </label>
                <div className="user-select-row" style={{ display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto', paddingBottom: '4px' }}>
                  {users.map(user => {
                    const isSelected = singleSplitAmong.includes(user.id);
                    return (
                      <button key={user.id} type="button"
                        className={`user-select-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => toggleSingleSplit(user.id)}
                        style={{ '--user-color': user.color }}>
                        <div className="avatar avatar-sm" style={{ background: user.color }}>
                          {isSelected ? '✓' : user.name[0]}
                        </div>
                        <span>{user.name}</span>
                      </button>
                    );
                  })}
                </div>
                {singleSplitAmong.length > 0 && (
                  <p className="split-info">₹{singlePerPerson} per person</p>
                )}
              </div>
            </div>
          ) : (
            /* Itemise Mode */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label>Date</label>
                <input className="input" type="date" value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  style={{ marginBottom: 'var(--space-sm)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 'var(--space-sm) 0' }}>
                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>Itemised Items</span>
                <button type="button" className="btn btn-sm" onClick={addRow}
                  disabled={isRemainingZero}
                  style={{
                    background: isRemainingZero ? 'var(--bg-input)' : 'var(--accent)',
                    color: isRemainingZero ? 'var(--text-tertiary)' : 'white',
                    border: 'none', padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)',
                    cursor: isRemainingZero ? 'not-allowed' : 'pointer',
                    opacity: isRemainingZero ? 0.5 : 1
                  }}>
                  + Add Item
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {rows.map((row, index) => {
                  const rowPerPerson = getRowPerPerson(row);
                  return (
                    <div key={index} className="card" style={{
                      background: 'var(--bg-elevated)',
                      border: row.error ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                      position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)'
                    }}>
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(index)}
                          style={{
                            position: 'absolute', top: '6px', right: '6px', border: 'none',
                            background: 'rgba(255, 107, 107, 0.15)', color: 'var(--danger)',
                            width: '24px', height: '24px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', zIndex: 10
                          }} aria-label="Remove item">&times;</button>
                      )}

                      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <div style={{ flex: 1.2 }}>
                          <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Category</label>
                          <select className="input select-input" value={row.categoryId}
                            onChange={(e) => updateRowField(index, 'categoryId', e.target.value)}
                            style={{ padding: '8px var(--space-sm)', fontSize: 'var(--font-sm)' }}>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Amount</label>
                          <input className="input" type="number" placeholder="₹0" value={row.amount}
                            onChange={(e) => updateRowField(index, 'amount', e.target.value)}
                            style={{ padding: '8px var(--space-sm)', fontSize: 'var(--font-sm)' }} />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Description</label>
                        <input className="input" placeholder="e.g. Snacks, Dinner..."
                          value={row.description}
                          onChange={(e) => updateRowField(index, 'description', e.target.value)}
                          style={{ padding: '8px var(--space-sm)', fontSize: 'var(--font-sm)' }} />
                      </div>

                      {/* Inline Split Among for this row */}
                      <div style={{ marginTop: 'var(--space-xs)' }}>
                        <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Split Among</label>
                        <div className="user-select-row" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                          {users.map(user => {
                            const isSelected = row.splitAmong.includes(user.id);
                            return (
                              <button key={user.id} type="button"
                                className={`user-select-btn ${isSelected ? 'active' : ''}`}
                                onClick={() => toggleRowSplit(index, user.id)}
                                style={{ '--user-color': user.color, padding: '4px 8px', minWidth: 'auto', flex: '0 0 auto' }}>
                                <div className="avatar" style={{ background: user.color, width: '22px', height: '22px', fontSize: '0.65rem', marginRight: '4px' }}>
                                  {isSelected ? '✓' : user.name[0]}
                                </div>
                                <span style={{ fontSize: '0.75rem' }}>{user.name.split(' ')[0]}</span>
                              </button>
                            );
                          })}
                        </div>
                        {row.splitAmong.length > 0 && parseFloat(row.amount) > 0 && (
                          <p className="split-info" style={{ margin: '4px 0 0 0', fontSize: 'var(--font-xs)' }}>
                            ₹{rowPerPerson} per person
                          </p>
                        )}
                      </div>

                      {/* Inline row-level error */}
                      {row.error && (
                        <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--danger)', fontWeight: 600 }}>
                          {row.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Math Anchor / Footer */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-md)' }}>
          {mode === 'itemise' && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-sm)',
              background: isRemainingZero ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: isRemainingZero ? '1px solid rgba(0, 206, 201, 0.3)' : '1px solid rgba(255, 107, 107, 0.3)',
              color: isRemainingZero ? 'var(--success)' : 'var(--danger)',
              fontWeight: 600, fontSize: 'var(--font-sm)',
              transition: 'all var(--duration-fast)'
            }}>
              <span>Remaining:</span>
              <span>₹{remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          <button className="btn btn-primary btn-full" disabled={isConfirmDisabled}
            onClick={mode === 'single' ? handleSingleConfirm : handleItemiseConfirm}
            style={{
              padding: 'var(--space-md) 0', fontWeight: 'bold', fontSize: 'var(--font-base)',
              boxShadow: !isConfirmDisabled ? 'var(--shadow-glow)' : 'none'
            }}>
            {loading ? '⏳ Processing...' : '✨ Confirm & Add Expense'}
          </button>
        </div>

      </div>
    </Modal>
  );
}
