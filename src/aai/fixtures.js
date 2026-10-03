/** Fake room used by the AAI tests: You / Ravi / Meera, today = Sat 3 Oct 2026, 21:00. */
export const NOW = new Date(2026, 9, 3, 21, 0, 0);

export const USERS = [
  { id: 'u-me', name: 'You' },
  { id: 'u-ravi', name: 'Ravi' },
  { id: 'u-meera', name: 'Meera' },
];

export const CATEGORIES = [
  { id: 'cat-1', name: 'Groceries' }, { id: 'cat-2', name: 'Rent' }, { id: 'cat-3', name: 'Utilities' },
  { id: 'cat-4', name: 'Food & Dining' }, { id: 'cat-5', name: 'Transport' }, { id: 'cat-6', name: 'Entertainment' },
  { id: 'cat-7', name: 'Shopping' }, { id: 'cat-8', name: 'Health' }, { id: 'cat-9', name: 'Drinks & Alcohol' },
  { id: 'cat-10', name: 'Smoking' }, { id: 'cat-11', name: 'Subscriptions' }, { id: 'cat-12', name: 'Coffee & Tea' },
  { id: 'cat-13', name: 'Party & Nightlife' }, { id: 'cat-14', name: 'Others' },
];

export const ctx = (over = {}) => ({
  users: USERS, me: 'u-me', categories: CATEGORIES, expenses: [], isPersonal: false, now: NOW, ...over,
});

let n = 0;
/** Quick expense factory for answers/commands/chips tests. */
export const exp = (over = {}) => ({
  id: `e${++n}`, description: 'Dinner', amount: 300, categoryId: 'cat-4', paidBy: 'u-me',
  splitAmong: ['u-me', 'u-ravi', 'u-meera'], date: '2026-10-01', createdAt: '2026-10-01T13:00:00.000Z', ...over,
});
