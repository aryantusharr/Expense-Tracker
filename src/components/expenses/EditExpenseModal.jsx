import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import ExpenseFormFields from './ExpenseFormFields';
import { useExpenseForm } from '../../hooks/useExpenseForm';
import { updateExpense, updateGroupName } from '../../services/expenseService';
import { validateExpense } from '../../utils/expenseFormHelpers';

export default function EditExpenseModal({ expense, users, categories, roomCode, room, onClose }) {
  const isPersonal = room?.isPersonal === true;
  const { form, setField, toggleSplit, selectAll, perPerson, allGradient, reinitialize } = useExpenseForm({}, users);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!expense) return;
    reinitialize({
      description: expense.description,
      amount: expense.amount,
      paidBy: expense.paidBy,
      splitAmong: expense.splitAmong,
      categoryId: expense.categoryId,
      date: expense.date,
    });
    setGroupName(expense.groupName || '');
    setError('');
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense]);

  const handleSave = async () => {
    if (!expense) return;

    if (expense.isItemised && !groupName.trim()) {
      setError('Expense Name is required');
      return;
    }

    const validationError = validateExpense(form, isPersonal);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    try {
      await updateExpense(roomCode, expense.id, {
        description: form.description.trim() || 'Untitled',
        amount: parseFloat(form.amount),
        paidBy: form.paidBy,
        splitAmong: form.splitAmong,
        categoryId: form.categoryId,
        date: form.date,
        ...(expense.isItemised ? { groupName: groupName.trim() } : {}),
      }, room);

      if (expense.isItemised && groupName.trim() !== expense.groupName) {
        await updateGroupName(roomCode, expense.groupId, groupName.trim(), room);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    }
    setLoading(false);
  };

  return (
    <Modal isOpen={!!expense} onClose={onClose} title="Edit Expense" disableDrag={true}>
      {expense && (
        <div className="expense-form" style={{ paddingBottom: 'var(--space-xl)' }}>
          <div style={{ padding: 'var(--space-lg) 0 0 0' }}>
            {expense.isItemised && (
              <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                <label>Expense Name <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                <input
                  className="input"
                  placeholder="e.g. Zepto, Dinner, Fuel..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  id="input-group-name"
                />
              </div>
            )}
            <ExpenseFormFields
              form={form}
              setField={setField}
              toggleSplit={toggleSplit}
              selectAll={selectAll}
              perPerson={perPerson}
              allGradient={allGradient}
              users={users}
              categories={categories}
              isPersonal={isPersonal}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div style={{ position: 'sticky', bottom: '-24px', background: 'var(--bg-card-solid)', padding: 'var(--space-md) 0 0 0', zIndex: 10, borderTop: '1px solid var(--border-light)', margin: 'var(--space-xl) -24px 0 -24px' }}>
            <div style={{ padding: '0 var(--space-2xl)' }}>
              <button className="btn btn-primary btn-full" onClick={handleSave} disabled={loading}>
                {loading ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
