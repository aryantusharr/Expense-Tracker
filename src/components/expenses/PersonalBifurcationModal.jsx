// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useRoomContext } from '../../context/RoomContext';
import { addExpense } from '../../services/expenseService';
import { formatCurrency, getTodayISO } from '../../utils/helpers';
import './Expenses.css';

export default function PersonalBifurcationModal({ isOpen, onClose, transaction, room, onSuccess }) {
  const { categories, roomCode, userIdentity } = useRoomContext();
  
  const [mode, setMode] = useState('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Single mode state
  const [singleDescription, setSingleDescription] = useState('');
  const [singleDate, setSingleDate] = useState(getTodayISO());
  const [singleCategoryId, setSingleCategoryId] = useState('cat-1');

  // Itemise Mode rows state
  const [rows, setRows] = useState([{ categoryId: 'cat-1', description: '', amount: '' }]);

  // Low confidence — rawText expansion
  const [showRawText, setShowRawText] = useState(false);
  const isLowConfidence = transaction?.confidence === 'low';

  // Resolve pre-matched category
  useEffect(() => {
    if (!transaction || !categories || categories.length === 0) return;

    if (isLowConfidence) {
// eslint-disable-next-line react-hooks/set-state-in-effect
      setSingleCategoryId(categories[0]?.id || 'cat-1');
      setSingleDate(transaction.date || getTodayISO());
      setSingleDescription('');
      setRows([{ categoryId: categories[0]?.id || 'cat-1', description: '', amount: '' }]);
    } else {
      const matched = categories.find(
        c => c.name.toLowerCase() === (transaction.suggestedCategoryName || '').toLowerCase()
      );
      const defaultCatId = matched ? matched.id : (categories[0]?.id || 'cat-1');
      setSingleCategoryId(defaultCatId);
      setSingleDate(transaction.date || getTodayISO());
      setSingleDescription('');
      setRows([{ categoryId: defaultCatId, description: '', amount: '' }]);
    }
    setMode('single');
    setError('');
    setShowRawText(false);
  }, [transaction, categories, isLowConfidence]);

  if (!transaction || !room) return null;

  // Single confirm
  const handleSingleConfirm = async () => {
    if (!navigator.onLine) {
      setError('You are offline. Your pending transactions are saved and will be here when you\'re back.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payerId = userIdentity || (room.users?.[0]?.id || '');
      await addExpense(roomCode, {
        description: singleDescription.trim() || transaction.merchant || 'Untitled',
        amount: parseFloat(transaction.amount),
        paidBy: payerId,
        splitAmong: [payerId],
        categoryId: singleCategoryId,
        date: singleDate,
      }, room);

      await onSuccess(transaction.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save expense. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Itemise confirm
  const handleItemiseConfirm = async () => {
    if (!navigator.onLine) {
      setError('You are offline. Your pending transactions are saved and will be here when you\'re back.');
      return;
    }
    setLoading(true);
    setError('');
    
    const payerId = userIdentity || (room.users?.[0]?.id || '');
    const remainingRows = [...rows];
    let failed = false;

    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        await addExpense(roomCode, {
          description: row.description.trim() || transaction.merchant || 'Itemised Expense',
          amount: parseFloat(row.amount),
          paidBy: payerId,
          splitAmong: [payerId],
          categoryId: row.categoryId,
          date: singleDate,
        }, room);
        remainingRows.shift();
      }
// eslint-disable-next-line no-unused-vars
    } catch (err) {
      failed = true;
      const failedAmt = remainingRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      setError(`Partially saved. ₹${failedAmt} still pending.`);
      setRows(remainingRows);
    }

    if (!failed) {
      await onSuccess(transaction.id);
      onClose();
    } else {
      setLoading(false);
    }
  };

  // Itemise Mode Helper Methods
  const addRow = () => {
    const defaultCatId = categories[0]?.id || 'cat-1';
    // Auto-fill remaining amount for rows after the first
    const autoAmount = rows.length > 0 && remaining > 0 ? String(remaining) : '';
    // Insert at top (position 0)
    setRows(prev => [
      { categoryId: defaultCatId, description: '', amount: autoAmount },
      ...prev
    ]);
  };

  const removeRow = (index) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const updateRowField = (index, field, value) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  // Sticky math calculations
  const sumOfRows = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = parseFloat((transaction.amount - sumOfRows).toFixed(2));
  const isRemainingZero = Math.abs(remaining) < 0.01;

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
    <Modal isOpen={isOpen} onClose={onClose} title="Itemise / Split Transaction" disableDrag={true}>
      <div className="bifurcation-container" style={{ paddingBottom: 'calc(var(--space-md) + var(--safe-area-bottom))' }}>
        
        {/* Sticky Header Display */}
        <div className="picker-tx-header card" style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md) var(--space-lg)',
          marginBottom: 'var(--space-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 'var(--space-md)',
          position: 'sticky', top: 0, zIndex: 20
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
            <button type="button" onClick={() => setShowRawText(!showRawText)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--danger-bg)', border: '1px solid rgba(255, 107, 107, 0.3)',
                borderRadius: 'var(--radius-sm)', color: 'var(--danger)',
                fontSize: 'var(--font-xs)', fontWeight: 600, cursor: 'pointer'
              }}>
              <span>⚠️ Original SMS</span>
              <span>{showRawText ? '▲' : '▼'}</span>
            </button>
            {showRawText && (
              <pre style={{
                marginTop: 'var(--space-xs)', padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)',
                color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: '120px', overflowY: 'auto'
              }}>
                {transaction.rawText}
              </pre>
            )}
          </div>
        )}

        {/* Toggle Mode Bar */}
        <div className="toggle-mode-bar" style={{
          display: 'flex', background: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)', padding: '4px',
          marginBottom: 'var(--space-xl)', border: '1px solid var(--border-light)'
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
            Itemise Amount
          </button>
        </div>

        {/* Mode Forms */}
        <div className="bifurcation-content" style={{ maxHeight: '42vh', overflowY: 'auto', paddingRight: '4px', marginBottom: 'var(--space-lg)' }}>
          {error && <p className="error-text" style={{ margin: '0 0 var(--space-md) 0' }}>{error}</p>}

          {mode === 'single' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label>Amount</label>
                <input className="input read-only-input" type="text"
                  value={formatCurrency(transaction.amount)} readOnly
                  style={{ opacity: 0.7, background: 'var(--border-light)' }} />
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
            </div>
          ) : (
            /* Itemise Amount Dynamic List */
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
                {rows.map((row, index) => (
                  <div key={index} className="card" style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
                    position: 'relative'
                  }}>
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(index)}
                        style={{
                          position: 'absolute', top: '6px', right: '6px', border: 'none',
                          background: 'rgba(255, 107, 107, 0.15)', color: 'var(--danger)',
                          width: '24px', height: '24px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold'
                        }} aria-label="Remove item">&times;</button>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
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

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Description</label>
                        <input className="input" placeholder="e.g. Milk, Eggs, Rice..."
                          value={row.description}
                          onChange={(e) => updateRowField(index, 'description', e.target.value)}
                          style={{ padding: '8px var(--space-sm)', fontSize: 'var(--font-sm)' }} />
                      </div>
                    </div>
                  </div>
                ))}
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
              <span>Remaining to Split:</span>
              <span>₹{remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          <button className="btn btn-primary btn-full"
            disabled={loading || (mode === 'itemise' && !isRemainingZero)}
            onClick={mode === 'single' ? handleSingleConfirm : handleItemiseConfirm}
            style={{
              padding: 'var(--space-md) 0', fontWeight: 'bold', fontSize: 'var(--font-base)',
              boxShadow: (mode === 'single' || isRemainingZero) ? 'var(--shadow-glow)' : 'none'
            }}>
            {loading ? '⏳ Processing...' : '✨ Confirm & Add Expense'}
          </button>
        </div>

      </div>
    </Modal>
  );
}
