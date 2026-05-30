import { motion } from 'framer-motion';
import { adjustAmount, adjustDate } from '../../utils/expenseFormHelpers';

/**
 * Shared form fields used by both AddExpense and EditExpenseModal.
 * All state is managed externally via useExpenseForm and passed as props.
 */
export default function ExpenseFormFields({
  form,
  setField,
  toggleSplit,
  selectAll,
  perPerson,
  allGradient,
  users,
  categories,
  isPersonal,
}) {
  const { description, amount, paidBy, splitAmong, categoryId, date } = form;

  return (
    <>
      {/* Amount with +/- steppers */}
      <div className="amount-input-wrapper">
        <button type="button" className="amount-adj-btn" onClick={() => setField.amount(adjustAmount(amount, -1))}>−</button>
        <div className="amount-center">
          <span className="currency-symbol">₹</span>
          <input
            className="amount-input"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setField.amount(e.target.value)}
            id="input-amount"
          />
        </div>
        <button type="button" className="amount-adj-btn" onClick={() => setField.amount(adjustAmount(amount, 1))}>+</button>
      </div>

      {/* Description */}
      <div className="input-group">
        <label>Description <span className="optional-tag">(optional)</span></label>
        <input
          className="input"
          placeholder="e.g. Groceries, Electricity bill..."
          value={description}
          onChange={(e) => setField.description(e.target.value)}
          id="input-description"
        />
      </div>

      {/* Date with +/- steppers */}
      <div className="input-group">
        <label>Date</label>
        <div className="date-stepper">
          <button type="button" className="stepper-btn" onClick={() => setField.date(adjustDate(date, -1))}>−</button>
          <input
            className="input date-input"
            type="date"
            value={date}
            onChange={(e) => setField.date(e.target.value)}
            id="input-date"
          />
          <button type="button" className="stepper-btn" onClick={() => setField.date(adjustDate(date, 1))}>+</button>
        </div>
      </div>

      {/* Category pills */}
      <div className="input-group">
        <label>Category</label>
        <div className="category-scroll-strip">
          {categories.map(cat => {
            const isSelected = categoryId === cat.id;
            return (
              <motion.button
                key={cat.id}
                type="button"
                className={`category-pill ${isSelected ? 'selected' : ''}`}
                onClick={() => setField.categoryId(cat.id)}
                whileTap={{ scale: 0.92 }}
                layout
              >
                <motion.span
                  className="category-pill-icon"
                  animate={{ scale: isSelected ? 1.4 : 1, y: isSelected ? -4 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  {cat.icon}
                </motion.span>
                <span className="category-pill-label">{cat.name}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Paid By — hidden in personal mode */}
      {!isPersonal && (
        <div className="input-group">
          <label>Paid By</label>
          <div className="user-select-row">
            {users.map(user => (
              <button
                key={user.id}
                type="button"
                className={`user-select-btn ${paidBy === user.id ? 'active' : ''}`}
                onClick={() => setField.paidBy(user.id)}
                style={{ '--user-color': user.color }}
              >
                <div className="avatar avatar-sm" style={{ background: user.color }}>{user.name[0]}</div>
                <span>{user.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Split Among — hidden in personal mode */}
      {!isPersonal && (
        <div className="input-group">
          <div className="flex items-center justify-between">
            <label>Split Among</label>
            <button
              type="button"
              className="btn btn-sm all-members-btn"
              style={{ background: allGradient, color: 'white', border: 'none' }}
              onClick={selectAll}
            >
              All
            </button>
          </div>
          <div className="user-select-row">
            {users.map(user => (
              <button
                key={user.id}
                type="button"
                className={`user-select-btn ${splitAmong.includes(user.id) ? 'active' : ''}`}
                onClick={() => toggleSplit(user.id)}
                style={{ '--user-color': user.color }}
              >
                <div className="avatar avatar-sm" style={{ background: user.color }}>
                  {splitAmong.includes(user.id) ? '✓' : user.name[0]}
                </div>
                <span>{user.name}</span>
              </button>
            ))}
          </div>
          {splitAmong.length > 0 && amount && (
            <p className="split-info">₹{perPerson} per person</p>
          )}
        </div>
      )}
    </>
  );
}
