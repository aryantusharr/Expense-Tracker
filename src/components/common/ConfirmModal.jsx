import Modal from './Modal';
import '../expenses/Expenses.css'; // For button styles

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDanger = true }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{ textAlign: 'center', paddingBottom: 'var(--space-lg)' }}>
        <p style={{ fontSize: 'var(--font-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2xl)' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button 
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} 
            style={{ flex: 1 }} 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
