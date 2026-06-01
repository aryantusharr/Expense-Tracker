import React from 'react';
import Modal from '../common/Modal';
import { formatCurrency } from '../../utils/helpers';
import './Expenses.css';

export default function RoomPickerModal({ isOpen, onClose, transaction, rooms, onSelectRoom }) {

  if (!transaction) return null;

  const handleSelectRoom = (room) => {
    onSelectRoom(room);
  };

  const personalRooms = rooms.filter(r => r.isPersonal);
  const sharedRooms = rooms.filter(r => !r.isPersonal);

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
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Where does this expense belong?" disableDrag={true}>
        <div className="room-picker-container" style={{ paddingBottom: 'calc(var(--space-2xl) + var(--safe-area-bottom))' }}>
          
          {/* Active Transaction Display */}
          <div className="picker-tx-header card" style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md) var(--space-lg)',
            marginBottom: 'var(--space-xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-md)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Transaction
              </span>
              <span className="picker-merchant" style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {transaction.merchant || 'Unknown'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-xs)' }}>
              <span className="picker-amount" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--accent-light)' }}>
                {formatCurrency(transaction.amount)}
              </span>
              <span className="picker-meta" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                {getFormattedDate(transaction.date)} {transaction.time ? `• ${transaction.time}` : ''}
              </span>
            </div>
          </div>

          {/* List of Personal Rooms */}
          {personalRooms.length > 0 && (
            <div className="room-group-section" style={{ marginBottom: 'var(--space-xl)' }}>
              <h4 style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)' }}>
                Personal Workspace
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {personalRooms.map(room => (
                  <button
                    key={room.code}
                    className="picker-room-row card clickable"
                    onClick={() => handleSelectRoom(room)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-md) var(--space-lg)',
                      background: 'rgba(108, 92, 231, 0.08)',
                      border: '1px solid rgba(108, 92, 231, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'transform var(--duration-fast), background var(--duration-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <div className="picker-avatar" style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-gradient)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                      }}>
                        👤
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-base)' }}>{room.name}</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Personal Tracker</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: 'var(--text-tertiary)' }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* List of Shared Rooms */}
          <div className="room-group-section">
            <h4 style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)' }}>
              Shared Rooms
            </h4>
            {sharedRooms.length === 0 ? (
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', textAlign: 'center', margin: 'var(--space-md) 0' }}>
                No shared rooms saved.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {sharedRooms.map(room => {
                  const mCount = room.memberCount || 2;
                  return (
                    <button
                      key={room.code}
                      className="picker-room-row card clickable"
                      onClick={() => handleSelectRoom(room)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-md) var(--space-lg)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'transform var(--duration-fast), background var(--duration-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <div className="picker-avatar" style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          border: '1px solid var(--border-color)'
                        }}>
                          👥
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-base)' }}>{room.name}</p>
                          <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{mCount} roommates</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '1.2rem', color: 'var(--text-tertiary)' }}>→</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </Modal>

    </>
  );
}
