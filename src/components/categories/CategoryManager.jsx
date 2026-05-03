import { useState } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { useRoomContext } from '../../context/RoomContext';
import { updateCategories } from '../../services/roomService';
import { generateId } from '../../utils/helpers';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import './Categories.css';

const EMOJI_OPTIONS = [
  '🛒','🏡','⚡','🍽️','🚕','🎭','🛍️','💊',
  '🍻','🚬','📱','☕','🪩','📦','🎮','🍺',
  '🥃','🍷','🌿','💨','🎵','✈️','🎓','💈',
  '🧹','👕','🎁','🐕','💻','🏋️','🎪','💰'
];

export default function CategoryManager() {
  const { roomCode, categories } = useRoomContext();
  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catToDelete, setCatToDelete] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');

  const handleAdd = async () => {
    if (!name.trim()) return;
    const updated = [...categories, { id: generateId(), name: name.trim(), icon }];
    await updateCategories(roomCode, updated);
    setName('');
    setIcon('📦');
    setShowAdd(false);
  };

  const handleEdit = async () => {
    if (!name.trim() || !editCat) return;
    const updated = categories.map(c =>
      c.id === editCat.id ? { ...c, name: name.trim(), icon } : c
    );
    await updateCategories(roomCode, updated);
    setEditCat(null);
    setName('');
  };

  const handleDeleteClick = (cat) => {
    setCatToDelete(cat);
  };

  const confirmDelete = async () => {
    if (!catToDelete) return;
    const updated = categories.filter(c => c.id !== catToDelete.id);
    await updateCategories(roomCode, updated);
    setCatToDelete(null);
  };

  const openEdit = (cat) => {
    setEditCat(cat);
    setName(cat.name);
    setIcon(cat.icon);
  };

  // Handle drag-and-drop reorder
  const handleReorder = async (newOrder) => {
    await updateCategories(roomCode, newOrder);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <h3 className="section-title" style={{ margin: 0 }}>Categories</h3>
        <button className="btn btn-sm btn-primary" onClick={() => { setShowAdd(true); setName(''); setIcon('📦'); }}>
          + Add
        </button>
      </div>

      <p className="drag-hint">Hold & drag to reorder</p>


      <div className="category-list-scroll-container">
        <Reorder.Group axis="y" values={categories} onReorder={handleReorder} className="category-list">
          {categories.map((cat) => (
            <CategoryDragItem
              key={cat.id}
              cat={cat}
              openEdit={openEdit}
              handleDelete={handleDeleteClick}
            />
          ))}
        </Reorder.Group>
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Category">
        <CategoryForm name={name} setName={setName} icon={icon} setIcon={setIcon} onSubmit={handleAdd} buttonLabel="Add Category" />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editCat} onClose={() => setEditCat(null)} title="Edit Category">
        <CategoryForm name={name} setName={setName} icon={icon} setIcon={setIcon} onSubmit={handleEdit} buttonLabel="Save Changes" />
      </Modal>

      <ConfirmModal
        isOpen={!!catToDelete}
        onClose={() => setCatToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Category"
        message={`Delete category "${catToDelete?.name}"? Expenses in this category will stay but their category icon might disappear.`}
        confirmText="Delete"
        isDanger={true}
      />
    </div>
  );
}

function CategoryDragItem({ cat, openEdit, handleDelete }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={cat}
      className="category-item card"
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 30px rgba(108, 92, 231, 0.3)', zIndex: 10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <span
        className="drag-handle"
        onPointerDown={(e) => controls.start(e)}
      >
        ⠿
      </span>
      <span className="category-item-icon">{cat.icon}</span>
      <span className="category-item-name">{cat.name}</span>
      <div className="category-actions">
        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(cat)} style={{ padding: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(cat)}>🗑️</button>
      </div>
    </Reorder.Item>
  );
}

function CategoryForm({ name, setName, icon, setIcon, onSubmit, buttonLabel }) {
  return (
    <div className="expense-form">
      <div className="input-group">
        <label>Icon</label>
        <div className="emoji-grid">
          {EMOJI_OPTIONS.map(e => (
            <button
              key={e}
              type="button"
              className={`emoji-btn ${icon === e ? 'active' : ''}`}
              onClick={() => setIcon(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="input-group">
        <label>Name</label>
        <input className="input" placeholder="Category name" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-full" onClick={onSubmit}>{buttonLabel}</button>
    </div>
  );
}
