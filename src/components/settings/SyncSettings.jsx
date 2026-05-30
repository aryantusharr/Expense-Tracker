import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import { syncExistingSharedExpenses, removeSyncedExpensesFromPersonalRooms } from '../../services/expenseService';

/**
 * Profile sync section extracted from SettingsPage.
 * Manages the toggle, setup modal, enable/disable handlers.
 */
export default function SyncSettings({
  room, roomCode, users, userIdentity, setUserIdentity,
  savedRooms, updateRoom,
}) {
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

  const showTimedMessage = (msg) => {
    setSyncMessage(msg);
    setTimeout(() => setSyncMessage(''), 4000);
  };

  const handleToggleSync = () => {
    if (isSyncActive) { setShowDisableWarning(true); return; }
    if (currentPersonalRoom) { setShowEnableWarning(true); return; }
    handleChangeSyncClick();
  };

  const handleConfirmDisable = async () => {
    setSyncLoading(true);
    try {
      const updatedUsers = users.map(u =>
        u.id === userIdentity ? { ...u, personalRoomCode: null } : u
      );
      await updateRoom(roomCode, { users: updatedUsers });
      showTimedMessage('✅ Sync has been turned OFF. New expenses will no longer sync to your personal room.');
    } catch {
      showTimedMessage('❌ Failed to disable sync. Please try again.');
    }
    setSyncLoading(false);
    setShowDisableWarning(false);
  };

  const handleConfirmEnable = async () => {
    if (!currentUser?._lastPersonalRoomCode && !currentPersonalRoom) {
      setShowEnableWarning(false);
      handleChangeSyncClick();
      return;
    }

    setSyncLoading(true);
    const personalCode = currentUser._lastPersonalRoomCode || currentPersonalRoom?.code;
    if (!personalCode) {
      setShowEnableWarning(false);
      handleChangeSyncClick();
      setSyncLoading(false);
      return;
    }

    try {
      const updatedUsers = users.map(u =>
        u.id === userIdentity ? { ...u, personalRoomCode: personalCode } : u
      );
      await updateRoom(roomCode, { users: updatedUsers });
      showTimedMessage('✅ Sync has been turned ON. Your expenses will now sync to your personal room.');
    } catch {
      showTimedMessage('❌ Failed to enable sync. Please try again.');
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
      const allPersonalRoomCodes = savedRooms.filter(r => r.isPersonal).map(r => r.code);
      await removeSyncedExpensesFromPersonalRooms(roomCode, allPersonalRoomCodes);

      const updatedUsers = users.map(u => {
        if (u.id === selectedUser) return { ...u, personalRoomCode: selectedPersonalRoom };
        if (u.personalRoomCode === selectedPersonalRoom || u.id === userIdentity) {
          return { ...u, personalRoomCode: null, _lastPersonalRoomCode: u.personalRoomCode };
        }
        return u;
      });
      await updateRoom(roomCode, { users: updatedUsers });
      setUserIdentity(selectedUser);

      syncExistingSharedExpenses(roomCode, room?.name || 'Shared Room', selectedPersonalRoom, selectedUser).catch(() => {});

      showTimedMessage('✅ Profile sync configured! Existing expenses will sync in the background.');
    } catch {
      showTimedMessage('❌ Failed to configure sync. Please try again.');
    }
    setSyncLoading(false);
    setShowSyncWarning(false);
    setShowSyncSetup(false);
  };

  return (
    <>
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
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--success)' }}>✓ Sync is ON</span>
            </div>
            <button className="btn btn-secondary" onClick={handleChangeSyncClick} style={{ padding: '6px 12px', fontSize: 'var(--font-xs)' }}>Change</button>
          </div>
        ) : currentUser && !isSyncActive ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>Sync is OFF</span>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Turn on to auto-sync expenses</span>
            </div>
            <button className="btn btn-primary" onClick={handleChangeSyncClick} style={{ padding: '6px 12px', fontSize: 'var(--font-xs)' }}>Setup</button>
          </div>
        ) : (
          <button className="btn btn-primary btn-full" onClick={handleChangeSyncClick}>Setup Profile Sync</button>
        )}
      </motion.div>

      {/* Setup Modal */}
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
                <select className="input" value={selectedPersonalRoom} onChange={(e) => setSelectedPersonalRoom(e.target.value)}>
                  <option value="" disabled>Select a room...</option>
                  {personalRooms.map(pr => (<option key={pr.code} value={pr.code}>{pr.name}</option>))}
                </select>
              </div>
              <div className="input-group">
                <label>Which person are you in <strong style={{ color: 'var(--accent)' }}>{room?.name || 'this room'}</strong>?</label>
                <select className="input" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                  <option value="" disabled>Select your profile...</option>
                  {users.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
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

      {/* Confirmation modals */}
      <ConfirmModal isOpen={showSyncWarning} onClose={() => setShowSyncWarning(false)} onConfirm={handleConfirmMapping}
        title="Confirm Profile Sync"
        message="This will automatically sync your share of any future and past expenses in this room to your selected personal room. Synced entries will be read-only in your personal room."
        confirmText="Confirm Sync" isDanger={false}
      />
      <ConfirmModal isOpen={showDisableWarning} onClose={() => setShowDisableWarning(false)} onConfirm={handleConfirmDisable}
        title="Turn Off Sync?"
        message="Turning off sync will stop new shared expenses from being automatically added to your personal room. Previously synced expenses will remain in your personal room."
        confirmText="Turn Off" isDanger={true}
      />
      <ConfirmModal isOpen={showEnableWarning} onClose={() => setShowEnableWarning(false)} onConfirm={handleConfirmEnable}
        title="Turn On Sync?"
        message={`New shared expenses will be automatically synced to ${currentPersonalRoom?.name || 'your personal room'}. Your share will appear as read-only entries.`}
        confirmText="Turn On" isDanger={false}
      />
    </>
  );
}
