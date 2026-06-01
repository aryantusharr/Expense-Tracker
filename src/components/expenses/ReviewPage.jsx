// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import { useRoomContext } from '../../context/RoomContext';
import { deletePendingTransaction, getAllPending } from '../../utils/indexedDB';
import RoomPickerModal from './RoomPickerModal';
import PersonalBifurcationModal from './PersonalBifurcationModal';
import SharedBifurcationModal from './SharedBifurcationModal';
import { triggerConfetti } from '../../utils/confetti';
import { formatCurrency } from '../../utils/helpers';
import './Expenses.css';

export default function ReviewPage() {
  const navigate = useNavigate();
  const { savedRooms, joinRoomSession, room } = useRoomContext();
  
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTx, setActiveTx] = useState(null);
  
  // Modal controllers
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isBifurcationOpen, setIsBifurcationOpen] = useState(false);
  const [isSharedBifurcationOpen, setIsSharedBifurcationOpen] = useState(false);
// eslint-disable-next-line no-unused-vars
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Delete confirmation overlay controller
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  // Custom toast controller
  const [successToast, setSuccessToast] = useState(null);

  // Fetch pending list on mount
  const fetchPending = async () => {
    try {
      const list = await getAllPending();
      setPendingList(list);
// eslint-disable-next-line no-unused-vars
    } catch (err) {
      // Silently handle pending load errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPending();
  }, []);

  // Format date to "DD MMM"
  const getFormattedDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase();
    } catch {
      return dateStr;
    }
  };

  // Card Tap Handler
  const handleCardTap = (tx) => {
    setActiveTx(tx);
    setIsPickerOpen(true);
  };

  // Ignore / Delete Confirmation YES
  const handleConfirmDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await deletePendingTransaction(id);
      
      // Notify clipboard ingestion hook count subscriber
      window.dispatchEvent(new CustomEvent('pending-transactions-updated'));
      
      // Animate remove from local state list
      const updatedList = pendingList.filter(item => item.id !== id);
      setPendingList(updatedList);
      setDeleteConfirmId(null);

      // Check completion
      if (updatedList.length === 0) {
        triggerCompletionFlow();
      }
// eslint-disable-next-line no-unused-vars
    } catch (err) {
      // Silently handle delete errors
    }
  };

  // Room selected from Picker
  const handleSelectRoom = (selected) => {
    setSelectedRoom(selected);
    
    // Switch active RoomContext to this room so categories and users update in sync!
    joinRoomSession(selected.code);
    
    setIsPickerOpen(false);
    if (selected.isPersonal) {
      setIsBifurcationOpen(true);
    } else {
      setIsSharedBifurcationOpen(true);
    }
  };

  // Bifurcation / Split Success Handler
  const handleReviewSuccess = async (id) => {
    try {
      await deletePendingTransaction(id);
      
      // Notify clipboard ingestion hook count subscriber
      window.dispatchEvent(new CustomEvent('pending-transactions-updated'));
      
      // Remove from list
      const updatedList = pendingList.filter(item => item.id !== id);
      setPendingList(updatedList);
      setIsBifurcationOpen(false);
      setIsSharedBifurcationOpen(false);
      setActiveTx(null);
      setSelectedRoom(null);

      // Check completion
      if (updatedList.length === 0) {
        triggerCompletionFlow();
      }
// eslint-disable-next-line no-unused-vars
    } catch (err) {
      // Silently handle review success errors
    }
  };

  // Completion (confetti + success toast + redirect)
  const triggerCompletionFlow = () => {
    triggerConfetti();
    setSuccessToast('Congratulations! All Pending Transactions reviewed.');
    setTimeout(() => {
      setSuccessToast(null);
      navigate('/dashboard');
    }, 4500);
  };

  return (
    <>
      <Header title="Inbox" subtitle={pendingList.length > 0 ? `${pendingList.length} pending` : 'All caught up'} />

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        
        {loading ? (
          /* Loading Skeletons */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="card skeleton-card" style={{ height: '78px', opacity: 0.5, background: 'var(--bg-elevated)' }} />
            ))}
          </div>
        ) : pendingList.length === 0 ? (
          /* Stunning Empty State */
          <div className="empty-state" style={{ marginTop: '12vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-md)' }}>
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ fontSize: '4.5rem', marginBottom: 'var(--space-sm)' }}
            >
              📬
            </motion.div>
            <p className="empty-state-title" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              All Caught Up!
            </p>
            <p className="empty-state-text" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '280px', margin: 0 }}>
              No pending transactions. Copy a bank SMS to get started.
            </p>
          </div>
        ) : (
          /* Scrollable Pending Cards List */
          <div className="review-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <AnimatePresence mode="popLayout">
              {pendingList.map((tx) => {
                const isConfirming = deleteConfirmId === tx.id;
                
                return (
                  <motion.div
                    key={tx.id}
                    layout
                    initial={{ opacity: 0, y: 15, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 100, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    className="card clickable pending-tx-card"
                    onClick={() => !isConfirming && handleCardTap(tx)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-md) var(--space-lg)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      cursor: isConfirming ? 'default' : 'pointer',
                      overflow: 'hidden'
                    }}
                  >
                    
                    {/* Inline Delete Warning Overlay */}
                    <AnimatePresence>
                      {isConfirming && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: 'var(--bg-card-solid)',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 var(--space-lg)',
                            gap: 'var(--space-sm)'
                          }}
                        >
                          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
                            Delete this transaction?
                          </span>
                          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <button
                              className="btn btn-sm"
                              onClick={(e) => handleConfirmDelete(tx.id, e)}
                              style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer' }}
                            >
                              YES
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                              style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', border: 'none', padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer' }}
                            >
                              NO
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Left: Amount & Merchant */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                      <span className="tx-amount" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(tx.amount)}
                      </span>
                      <span className="tx-merchant" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {tx.merchant || 'Unknown'}
                      </span>
                      {tx.confidence === 'low' && (
                        <span style={{
                          fontSize: 'var(--font-xs)', color: 'var(--danger)', fontWeight: 600,
                          background: 'var(--danger-bg)', padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)', display: 'inline-block', marginTop: '2px', width: 'fit-content'
                        }}>
                          ⚠️ Could not fully read this SMS
                        </span>
                      )}
                    </div>

                    {/* Right: Date, Time & Ignore (X) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-xs)' }}>
                        <span className="tx-date" style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {getFormattedDate(tx.date)}
                        </span>
                        {tx.time && (
                          <span className="tx-time" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                            {tx.time}
                          </span>
                        )}
                      </div>

                      {/* Ignore Action Button */}
                      <button
                        type="button"
                        className="btn-icon ignore-card-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(tx.id);
                        }}
                        style={{
                          fontSize: '1.25rem',
                          color: 'var(--text-tertiary)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 'var(--space-xs)',
                          opacity: 0.6,
                          transition: 'opacity var(--duration-fast)'
                        }}
                        aria-label="Delete transaction"
                      >
                        &times;
                      </button>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

      </div>

      {/* Step 1: Room Picker Modal */}
      {isPickerOpen && (
        <RoomPickerModal
          isOpen={isPickerOpen}
          onClose={() => { setIsPickerOpen(false); setActiveTx(null); }}
          transaction={activeTx}
          rooms={savedRooms}
          onSelectRoom={handleSelectRoom}
        />
      )}

      {/* Step 2A: Personal Room Bifurcation Modal */}
      {isBifurcationOpen && (
        <PersonalBifurcationModal
          isOpen={isBifurcationOpen}
          onClose={() => { setIsBifurcationOpen(false); setActiveTx(null); setSelectedRoom(null); }}
          transaction={activeTx}
          room={room}
          onSuccess={handleReviewSuccess}
        />
      )}

      {/* Step 2B: Shared Room Bifurcation Modal */}
      {isSharedBifurcationOpen && (
        <SharedBifurcationModal
          isOpen={isSharedBifurcationOpen}
          onClose={() => { setIsSharedBifurcationOpen(false); setActiveTx(null); setSelectedRoom(null); }}
          transaction={activeTx}
          room={room}
          onSuccess={handleReviewSuccess}
        />
      )}

      {/* Completion Overlay Toast */}
      {successToast && (
        <div className="toast-container">
          <div className="toast" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <span style={{ fontSize: '1.2rem' }}>🎉</span>
            <span>{successToast}</span>
          </div>
        </div>
      )}
    </>
  );
}
