import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomContext } from '../../context/RoomContext';
import { deleteRoom } from '../../services/roomService';
import Modal from '../common/Modal';
import './Setup.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const { savedRooms, joinRoomSession, forgetRoom } = useRoomContext();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenRoom = (code) => {
    joinRoomSession(code);
    navigate('/dashboard');
  };

  const handleDeleteFromCloud = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRoom(deleteTarget.code);
      forgetRoom(deleteTarget.code);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleRemoveLocal = () => {
    if (!deleteTarget) return;
    forgetRoom(deleteTarget.code);
    setDeleteTarget(null);
  };

  return (
    <div className="setup-page">
      <motion.div
        className="setup-container"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="setup-logo">
          <motion.div
            className="logo-icon"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            💰
          </motion.div>
        </div>

        <motion.h1
          className="setup-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Split<span className="text-accent">Ease</span>
        </motion.h1>

        <motion.p
          className="setup-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Track expenses — solo or with roommates.
        </motion.p>

        {/* Saved rooms */}
        {savedRooms.length > 0 && (
          <motion.div
            className="saved-rooms"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <p className="section-title" style={{ textAlign: 'left' }}>Your Rooms</p>
            <div className="saved-rooms-list">
              <AnimatePresence>
                {savedRooms.map((r, i) => (
                  <motion.div
                    key={r.code}
                    className="saved-room-card card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <button className="saved-room-main" onClick={() => handleOpenRoom(r.code)}>
                      <div className="saved-room-icon">
                        {r.isPersonal ? '👤' : '🏠'}
                      </div>
                      <div className="saved-room-info">
                        <span className="saved-room-name">{r.name}</span>
                        <span className="saved-room-type">
                          {r.isPersonal ? 'Personal' : `Room · ${r.code}`}
                        </span>
                      </div>
                      <span className="saved-room-arrow">→</span>
                    </button>
                    <button
                      className="saved-room-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(r);
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        <motion.div
          className="setup-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button
            className="btn btn-primary btn-full"
            onClick={() => navigate('/create')}
            id="btn-create-room"
          >
            🏠 Create a Room
          </button>

          <button
            className="btn btn-secondary btn-full"
            onClick={() => navigate('/join')}
            id="btn-join-room"
          >
            🔗 Join a Room
          </button>

          <div className="share-divider">or</div>

          <button
            className="btn btn-full personal-btn"
            onClick={() => navigate('/personal')}
            id="btn-personal"
          >
            👤 Track Personal Expenses
          </button>
        </motion.div>

        <motion.p
          className="setup-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Share expenses • Real-time sync • Smart settlements
        </motion.p>
      </motion.div>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Room">
        <div className="delete-room-modal">
          <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            What would you like to do with <strong>"{deleteTarget?.name}"</strong>?
          </p>
          <div className="flex-col gap-sm">
            <button
              className="btn btn-secondary btn-full"
              onClick={handleRemoveLocal}
            >
              📱 Remove from this Device
            </button>
            <p className="text-secondary" style={{ fontSize: 'var(--font-xs)', textAlign: 'center', margin: '0' }}>
              Data stays in the cloud — you can rejoin later
            </p>

            <div className="share-divider" style={{ margin: 'var(--space-sm) 0' }}>or</div>

            <button
              className="btn btn-danger btn-full"
              onClick={handleDeleteFromCloud}
              disabled={deleting}
            >
              {deleting ? '⏳ Deleting...' : '🗑️ Delete Permanently'}
            </button>
            <p className="text-secondary" style={{ fontSize: 'var(--font-xs)', textAlign: 'center', margin: '0', color: 'var(--danger)' }}>
              This will delete the room and all expenses forever
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
