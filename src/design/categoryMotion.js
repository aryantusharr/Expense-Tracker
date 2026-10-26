// Small motion for each category line icon (System · Category icons · motion board).
// Each rule animates part of the icon: `parts` = indexes of the path's sub-paths (split at each "M"),
// or 'all' for the whole icon. `o` = transform origin in the 24×24 grid, `d` = delay in seconds.
// The classes live in styles/categoryMotion.css.

export const CATEGORY_MOTION = {
  food: [{ parts: [0, 1, 2], a: 'rl', o: [7, 21] }, { parts: [3], a: 'rr', o: [16, 21] }],
  groceries: [{ parts: 'all', a: 'bob' }, { parts: [1], a: 'lift' }],
  coffee: [{ parts: [2], a: 'rise' }, { parts: [3], a: 'rise', d: 0.35 }],
  snacks: [{ parts: 'all', a: 'crinkle', o: [12, 12] }],
  transport: [{ parts: [0, 1, 2], a: 'bob' }, { parts: [3], a: 'blink' }, { parts: [4], a: 'blink', d: 0.15 }],
  fuel: [{ parts: [3], a: 'swing', o: [15, 10] }],
  rent: [{ parts: 'all', a: 'turn', o: [8, 11] }],
  electricity: [{ parts: 'all', a: 'flicker', o: [12, 12] }],
  wifi: [{ parts: [2], a: 'pulse' }, { parts: [1], a: 'pulse', d: 0.2 }, { parts: [0], a: 'pulse', d: 0.4 }],
  recharge: [{ parts: [0], a: 'buzz', o: [12, 12] }, { parts: [1], a: 'blink' }],
  water: [{ parts: 'all', a: 'drop', o: [12, 20] }],
  gas: [{ parts: 'all', a: 'shake' }, { parts: [1], a: 'lift' }],
  shopping: [{ parts: 'all', a: 'bob' }, { parts: [1], a: 'lift' }],
  clothes: [{ parts: 'all', a: 'swing', o: [12, 3] }],
  health: [{ parts: 'all', a: 'beat', o: [12, 12] }],
  gym: [{ parts: 'all', a: 'press' }],
  movies: [{ parts: [3], a: 'blink' }, { parts: [4], a: 'blink', d: 0.15 }, { parts: [5], a: 'blink', d: 0.3 }, { parts: [6], a: 'blink', d: 0.45 }],
  party: [{ parts: 'all', a: 'tilt', o: [12, 21] }],
  travel: [{ parts: 'all', a: 'jump', o: [12, 20] }],
  flights: [{ parts: 'all', a: 'fly' }],
  stay: [{ parts: 'all', a: 'bob' }, { parts: [3], a: 'blink' }],
  gifts: [{ parts: [1, 3, 4], a: 'lift' }],
  books: [{ parts: 'all', a: 'tilt', o: [4, 21] }],
  pets: [{ parts: [1], a: 'pop', o: [5, 9.5] }, { parts: [2], a: 'pop', o: [9.5, 5.5], d: 0.12 }, { parts: [3], a: 'pop', o: [14.5, 5.5], d: 0.24 }, { parts: [4], a: 'pop', o: [19, 9.5], d: 0.36 }],
  laundry: [{ parts: [2], a: 'spin', o: [12, 13] }],
  repairs: [{ parts: 'all', a: 'twist', o: [8.5, 18.5] }],
  househelp: [{ parts: 'all', a: 'sweep', o: [12, 21] }],
  salon: [{ parts: [0, 2], a: 'rr', o: [14.2, 12] }, { parts: [1, 3], a: 'rl', o: [14.2, 12] }],
  subscriptions: [{ parts: [3], a: 'beat', o: [12.5, 11] }],
  insurance: [{ parts: [1], a: 'draw' }],
  kids: [{ parts: 'all', a: 'jump', o: [12, 22] }],
  other: [{ parts: [0], a: 'bob' }, { parts: [1], a: 'bob', d: 0.15 }, { parts: [2], a: 'bob', d: 0.3 }],
  smoking: [{ parts: [3], a: 'draw' }, { parts: [1, 2], a: 'blink' }],
  weed: [{ parts: 'all', a: 'sway', o: [12, 22] }],
  saving: [{ parts: 'all', a: 'bob' }, { parts: [2], a: 'blink' }],
  taxes: [{ parts: 'all', a: 'flip', o: [12, 12] }],
  gadgets: [{ parts: [3], a: 'tick', o: [12, 12] }],
};

/** Splits an icon path into its sub-paths (one per "M"). */
export const subPaths = path => path.split(/(?=M)/).filter(Boolean);
