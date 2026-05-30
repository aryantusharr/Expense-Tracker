import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import ExpenseFormFields from './ExpenseFormFields';
import { useRoomContext } from '../../context/RoomContext';
import { useExpenseForm } from '../../hooks/useExpenseForm';
import { useSuccessState } from '../../hooks/useSuccessState';
import { addExpense } from '../../services/expenseService';
import { validateExpense } from '../../utils/expenseFormHelpers';
import './Expenses.css';

export default function AddExpense() {
  const { roomCode, room, users, categories } = useRoomContext();
  const isPersonal = room?.isPersonal === true;
  const { form, setField, resetForm, toggleSplit, selectAll, perPerson, allGradient } = useExpenseForm({}, users);
  const { showSuccess, triggerSuccess } = useSuccessState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateExpense(form, isPersonal);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    try {
      await addExpense(roomCode, {
        description: form.description.trim() || 'Untitled',
        amount: parseFloat(form.amount),
        paidBy: form.paidBy,
        splitAmong: form.splitAmong,
        categoryId: form.categoryId,
        date: form.date,
      }, room);
      triggerSuccess();
      resetForm();
    } catch (err) {
      setError(err.message || 'Failed to add expense');
    }
    setLoading(false);
  };

  return (
    <>
      <Header title="Add Expense" />
      <div className="page-content">
        <motion.form
          className="expense-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
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

          {error && <p className="error-text">{error}</p>}

          {/* Success Animation */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                className="premium-success-overlay"
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
                exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              >
                <motion.div
                  className="success-card"
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                >
                  <div className="success-icon-wrapper">
                    <motion.svg width="60" height="60" viewBox="0 0 60 60" initial="hidden" animate="visible">
                      <motion.circle
                        cx="30" cy="30" r="28" stroke="var(--success)" strokeWidth="4" fill="none"
                        variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5 } } }}
                      />
                      <motion.path
                        d="M18 30L26 38L42 22" stroke="var(--success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"
                        variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.3, delay: 0.4 } } }}
                      />
                    </motion.svg>
                  </div>
                  <h3>Saved Successfully</h3>
                  <p>Your expense has been added to the room.</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            className={`btn btn-primary btn-full add-expense-btn ${showSuccess ? 'btn-success-state' : ''}`}
            type="submit"
            disabled={loading || showSuccess}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            {loading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-block' }}
              >
                ⏳
              </motion.span>
            ) : showSuccess ? '✅ Added!' : '💰 Add Expense'}
          </motion.button>
        </motion.form>
      </div>
    </>
  );
}
