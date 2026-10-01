// Moved unchanged from expenses/AddExpense.jsx — category auto-pick + math helpers.
// Hinglish keyword category mapping
export const HINGLISH_MAP = {
  // Groceries
  sabzi: 'Groceries', pyaaz: 'Groceries', aata: 'Groceries', dal: 'Groceries', chawal: 'Groceries',
  zepto: 'Groceries', blinkit: 'Groceries', bigbasket: 'Groceries', kirana: 'Groceries', doodh: 'Groceries',
  anda: 'Groceries', bread: 'Groceries',

  // Food & Dining
  biryani: 'Food & Dining', pizza: 'Food & Dining', burger: 'Food & Dining', zomato: 'Food & Dining', swiggy: 'Food & Dining',
  chai: 'Food & Dining', dhaba: 'Food & Dining', restaurant: 'Food & Dining', khana: 'Food & Dining', lunch: 'Food & Dining',
  dinner: 'Food & Dining', breakfast: 'Food & Dining', maggi: 'Food & Dining', noodles: 'Food & Dining', dominos: 'Food & Dining',

  // Transportation
  petrol: 'Transportation', diesel: 'Transportation', uber: 'Transportation', ola: 'Transportation', rapido: 'Transportation',
  auto: 'Transportation', rickshaw: 'Transportation', metro: 'Transportation', cab: 'Transportation', fuel: 'Transportation',
  toll: 'Transportation',

  // Entertainment
  netflix: 'Entertainment', spotify: 'Entertainment', prime: 'Entertainment', movie: 'Entertainment', ticket: 'Entertainment',
  cinema: 'Entertainment', hotstar: 'Entertainment', youtube: 'Entertainment',

  // Utilities
  rent: 'Utilities', bijli: 'Utilities', electricity: 'Utilities', water: 'Utilities', internet: 'Utilities',
  mobile: 'Utilities', recharge: 'Utilities', wifi: 'Utilities', broadband: 'Utilities',

  // Smoking/Cigarettes
  cig: 'Smoking/Cigarettes', cigs: 'Smoking/Cigarettes', cigarette: 'Smoking/Cigarettes', cigarettes: 'Smoking/Cigarettes', sutta: 'Smoking/Cigarettes', bidi: 'Smoking/Cigarettes', hookah: 'Smoking/Cigarettes',
  beer: 'Alcohol', wine: 'Alcohol', whiskey: 'Alcohol', vodka: 'Alcohol', rum: 'Alcohol',
  daaru: 'Alcohol', drinks: 'Alcohol', alcohol: 'Alcohol', breezer: 'Alcohol'
};

// Category Merchant regex patterns mapping
// eslint-disable-next-line no-unused-vars
const CATEGORY_REGEX_MAP = {
  'Groceries': /zepto|blinkit|bigbasket|kirana|doodh|milk|instamart|reliance|safal|grofers|supermarket|grocery|groceries|sabzi|aata|dal|rice/i,
  'Food & Dining': /zomato|swiggy|biryani|pizza|burger|chai|coffee|starbucks|restaurant|cafe|dhaba|dominos|mcdonald|kfc|pizza\s*hut|food|dinner|lunch|breakfast|tea|canteen/i,
  'Transportation': /uber|ola|rapido|metro|rickshaw|cab|taxi|auto|petrol|diesel|fuel|toll|cng|fastag|train|flight|bus/i,
  'Entertainment': /netflix|spotify|prime|movie|cinema|theater|ticket|concert|hotstar|youtube|game|bookmyshow|playstation|xbox|nintendo|steam/i,
  'Utilities': /rent|electricity|bijli|water|gas|internet|wifi|wi-fi|broadband|recharge|mobile|phone|dth|bill|insurance|maintenance/i,
  'Smoking/Cigarettes': /cig|cigarette|cigarettes|sutta|bidi|pan|hookah/i,
  'Alcohol': /beer|wine|whiskey|vodka|rum|daaru|drinks|alcohol|breezer|bar|pub|club|liquor/i
};

/**
 * Searches the room's category list for a target standard name (exact, then partial; null if none).
 */
export function findMatchingCategory(targetName, categories) {
  if (!categories || categories.length === 0) return null;
  const targetLower = targetName.toLowerCase();

  // 1. Exact match (case-insensitive)
  let matched = categories.find(c => c.name.toLowerCase() === targetLower);
  if (matched) return matched;

  // 2. Partial match (case-insensitive)
  matched = categories.find(c => {
    const nameLower = c.name.toLowerCase();
    return nameLower.includes(targetLower) || targetLower.includes(nameLower);
  });

  return matched || null;
}
/**
 * Sorts room categories as Recent (used in last 5 entries) first,
 * then Frequent (used in 60%+ of room's entries), then remaining alphabetically.
 */
export function getSortedCategories(categories, expenses) {
  if (!categories || categories.length === 0) return [];
  if (!expenses || expenses.length === 0) {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Sort expenses by date descending to get recent entries
  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Recent: categories used in the last 5 entries (up to 5 unique)
  const recentIds = [];
  for (const exp of sortedExpenses) {
    if (exp.categoryId && !recentIds.includes(exp.categoryId)) {
      recentIds.push(exp.categoryId);
      if (recentIds.length === 5) break;
    }
  }

  // Frequent: categories used in 60%+ of this room's entries
  const frequentIds = [];
  const counts = {};
  for (const exp of expenses) {
    if (exp.categoryId) {
      counts[exp.categoryId] = (counts[exp.categoryId] || 0) + 1;
    }
  }
  const totalCount = expenses.length;
  for (const catId in counts) {
    if (counts[catId] / totalCount >= 0.6) {
      frequentIds.push(catId);
    }
  }

  const recentCats = [];
  const frequentCats = [];
  const remainingCats = [];

  for (const cat of categories) {
    if (recentIds.includes(cat.id)) {
      continue;
    } else if (frequentIds.includes(cat.id)) {
      frequentCats.push(cat);
    } else {
      remainingCats.push(cat);
    }
  }

  // Preserve the exact chronological order of recency
  for (const id of recentIds) {
    const cat = categories.find(c => c.id === id);
    if (cat) recentCats.push(cat);
  }

  remainingCats.sort((a, b) => a.name.localeCompare(b.name));
  frequentCats.sort((a, b) => a.name.localeCompare(b.name));

  return [...recentCats, ...frequentCats, ...remainingCats];
}
// Safely evaluates basic math expressions containing + - * /
export const evaluateMathExpression = (str) => {
  if (!str) return null;
  // strip out anything that isn't a digit, decimal point, space, or +, -, *, /
  const sanitized = str.replace(/[^0-9.\s+\-*/()]/g, '');
  try {
    const result = new Function(`return (${sanitized})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return parseFloat(result.toFixed(2));
    }
  } catch {
    // Ignore evaluation errors
  }
  return null;
};
