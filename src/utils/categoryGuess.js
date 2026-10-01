/**
 * categoryGuess.js — picks a category from what the user types.
 *
 * Two sources, learned first:
 *  1. Learned from the room's own expenses: the same description saved with the same category
 *     LEARN_MIN+ times in the last LEARN_DAYS days. Computed on the fly — nothing is stored or synced
 *     (the old stored learned_patterns collection mis-picked and fell out of sync).
 *  2. A fixed Hinglish keyword list (KEYWORDS below).
 *
 * Matching is by whole word (so "pan" no longer hits "company") with light spelling
 * normalisation: case, punctuation and doubled letters are ignored (Pyaaz = Pyaz, Cigg = Cig).
 * Pure functions — no side effects on import.
 */

export const LEARN_MIN = 5;
export const LEARN_DAYS = 30;

/** lower-case, letters/digits in any script only, doubled letters collapsed, single spaces. */
export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .replace(/(\p{L})\1+/gu, '$1')
    .trim()
    .replace(/\s+/g, ' ');
}

const words = text => (text ? text.split(' ') : []);

/** Levenshtein distance capped at 2 (enough for "is this a 1-letter typo?"). */
function closeEnough(a, b) {
  if (a === b) return true;
  if (a.length < 6 || b.length < 6 || Math.abs(a.length - b.length) > 1) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length] <= 1;
}

// keyword → category name, or a list of names tried in order (rooms have different category sets).
// Keywords ending in '*' match the start of a word (cig* → cigg, cigs, ciggerete, cigarettes).
const SMOKE = ['Smoking', 'Smoking/Cigarettes'];
const DRINK = ['Drinks & Alcohol', 'Alcohol'];
const KEYWORDS = {
  // Groceries
  sabzi: 'Groceries', sabji: 'Groceries', pyaz: 'Groceries', pyaaz: 'Groceries', onion: 'Groceries',
  aloo: 'Groceries', aaloo: 'Groceries', potato: 'Groceries', tamatar: 'Groceries', tomato: 'Groceries',
  aata: 'Groceries', atta: 'Groceries', dal: 'Groceries', chawal: 'Groceries', rice: 'Groceries',
  doodh: 'Groceries', milk: 'Groceries', dahi: 'Groceries', paneer: 'Groceries', anda: 'Groceries', eggs: 'Groceries',
  bread: 'Groceries', zepto: 'Groceries', blinkit: 'Groceries', bigbasket: 'Groceries', instamart: 'Groceries',
  kirana: 'Groceries', grocery: 'Groceries', groceries: 'Groceries',

  // Snacks (falls back to Food & Dining in rooms without a Snacks category)
  thumbsup: ['Snacks', 'Food & Dining'], thumsup: ['Snacks', 'Food & Dining'],
  chips: ['Snacks', 'Food & Dining'], kurkure: ['Snacks', 'Food & Dining'], namkeen: ['Snacks', 'Food & Dining'],
  biscuit: ['Snacks', 'Food & Dining'], biscuits: ['Snacks', 'Food & Dining'],

  // Food & Dining
  biryani: 'Food & Dining', pizza: 'Food & Dining', burger: 'Food & Dining', zomato: 'Food & Dining', swiggy: 'Food & Dining',
  dhaba: 'Food & Dining', restaurant: 'Food & Dining', khana: 'Food & Dining', lunch: 'Food & Dining',
  dinner: 'Food & Dining', breakfast: 'Food & Dining', maggi: 'Food & Dining', noodles: 'Food & Dining', dominos: 'Food & Dining',

  // Coffee & Tea
  chai: ['Coffee & Tea', 'Food & Dining'], coffee: ['Coffee & Tea', 'Food & Dining'], starbucks: ['Coffee & Tea', 'Food & Dining'],

  // Transport
  petrol: 'Transport', diesel: 'Transport', uber: 'Transport', ola: 'Transport', rapido: 'Transport',
  auto: 'Transport', rickshaw: 'Transport', metro: 'Transport', cab: 'Transport', fuel: 'Transport', toll: 'Transport',

  // Entertainment / Subscriptions
  movie: 'Entertainment', cinema: 'Entertainment', ticket: 'Entertainment',
  netflix: ['Subscriptions', 'Entertainment'], spotify: ['Subscriptions', 'Entertainment'], prime: ['Subscriptions', 'Entertainment'],
  hotstar: ['Subscriptions', 'Entertainment'], youtube: ['Subscriptions', 'Entertainment'],

  // Rent / Utilities
  rent: ['Rent', 'Utilities'], bijli: 'Utilities', electricity: 'Utilities', water: 'Utilities', internet: 'Utilities',
  mobile: 'Utilities', recharge: 'Utilities', wifi: 'Utilities', broadband: 'Utilities',

  // Smoking
  'cig*': SMOKE, 'sigret*': SMOKE, sutta: SMOKE, bidi: SMOKE, hookah: SMOKE,

  // Drinks & Alcohol
  beer: DRINK, wine: DRINK, whiskey: DRINK, whisky: DRINK, vodka: DRINK, rum: DRINK,
  daaru: DRINK, daru: DRINK, drinks: DRINK, alcohol: DRINK, breezer: DRINK,
};

// Normalised once: [{ kw, prefix, names }]
const KEYWORD_LIST = Object.entries(KEYWORDS).map(([k, v]) => ({
  kw: normalize(k.replace('*', '')),
  prefix: k.endsWith('*'),
  names: Array.isArray(v) ? v : [v],
}));

/** Room category matching a standard name (exact, then partial; null if none). */
export function findMatchingCategory(targetName, categories) {
  if (!categories?.length) return null;
  const t = targetName.toLowerCase();
  return categories.find(c => c.name.toLowerCase() === t)
    || categories.find(c => { const n = c.name.toLowerCase(); return n.includes(t) || t.includes(n); })
    || null;
}

/** Category id from the fixed keyword list, or null. */
export function keywordCategory(text, categories) {
  const ws = words(normalize(text));
  for (const w of ws) {
    for (const { kw, prefix, names } of KEYWORD_LIST) {
      const hit = prefix ? w.startsWith(kw) : (w === kw || w === kw + 's');
      if (!hit) continue;
      for (const name of names) {
        const cat = findMatchingCategory(name, categories);
        if (cat) return cat.id;
      }
    }
  }
  return null;
}

const expenseTime = e => {
  const t = new Date(e.date || e.createdAt || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Learned patterns: Map(normalised description → categoryId) for descriptions saved with the
 * same category LEARN_MIN+ times in the last LEARN_DAYS days. When one description was saved
 * with several categories, the most-used one wins (ties: the most recent).
 */
export function learnPatterns(expenses, categories, now = Date.now()) {
  const since = now - LEARN_DAYS * 24 * 60 * 60 * 1000;
  const valid = new Set((categories || []).map(c => c.id));
  const counts = new Map(); // key → Map(categoryId → { n, last })
  for (const e of expenses || []) {
    if (!e?.categoryId || !valid.has(e.categoryId)) continue;
    const t = expenseTime(e);
    if (t < since) continue;
    const key = normalize(e.description);
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, new Map());
    const byCat = counts.get(key);
    const cur = byCat.get(e.categoryId) || { n: 0, last: 0 };
    byCat.set(e.categoryId, { n: cur.n + 1, last: Math.max(cur.last, t) });
  }
  const learned = new Map();
  for (const [key, byCat] of counts) {
    let best = null;
    for (const [id, s] of byCat) {
      if (!best || s.n > best.n || (s.n === best.n && s.last > best.last)) best = { id, ...s };
    }
    if (best.n >= LEARN_MIN) learned.set(key, best.id);
  }
  return learned;
}

/** Category id from learned patterns: whole description, then any single learned word in it. */
export function learnedCategory(text, learned) {
  if (!learned?.size) return null;
  const key = normalize(text);
  if (!key) return null;
  if (learned.has(key)) return learned.get(key);
  const ws = words(key);
  for (const [k, id] of learned) {
    if (k.includes(' ')) continue;
    if (ws.some(w => closeEnough(w, k))) return id;
  }
  return null;
}

/** Best guess for a description: learned first, then the keyword list. null = leave as is. */
export function guessCategory(text, learned, categories) {
  return learnedCategory(text, learned) || keywordCategory(text, categories);
}
