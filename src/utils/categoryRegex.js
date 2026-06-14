/**
 * categoryRegex.js
 *
 * Houses the base category regex map and a dynamic compiler that merges
 * learned descriptions from Firestore into combined RegExp objects.
 *
 * IMPORTANT: This module is purely functional — no side effects on import.
 * All regex compilation is non-blocking (synchronous in-memory operations only).
 */

/**
 * Base category regex patterns. These mirror the CATEGORY_REGEX_MAP in AddExpense.jsx
 * and serve as the ground-truth source for app-wide regex matching.
 */
export const BASE_CATEGORY_REGEX = {
  'Groceries': /zepto|blinkit|bigbasket|kirana|doodh|milk|instamart|reliance|safal|grofers|supermarket|grocery|groceries|sabzi|aata|dal|rice/i,
  'Food & Dining': /zomato|swiggy|biryani|pizza|burger|chai|coffee|starbucks|restaurant|cafe|dhaba|dominos|mcdonald|kfc|pizza\s*hut|food|dinner|lunch|breakfast|tea|canteen/i,
  'Transportation': /uber|ola|rapido|metro|rickshaw|cab|taxi|auto|petrol|diesel|fuel|toll|cng|fastag|train|flight|bus/i,
  'Entertainment': /netflix|spotify|prime|movie|cinema|theater|ticket|concert|hotstar|youtube|game|bookmyshow|playstation|xbox|nintendo|steam/i,
  'Utilities': /rent|electricity|bijli|water|gas|internet|wifi|wi-fi|broadband|recharge|mobile|phone|dth|bill|insurance|maintenance/i,
  'Smoking/Cigarettes': /cig|cigarette|cigarettes|sutta|bidi|pan|hookah/i,
  'Alcohol': /beer|wine|whiskey|vodka|rum|daaru|drinks|alcohol|breezer|bar|pub|club|liquor/i,
};

/**
 * Escapes a string for safe use inside a RegExp pattern.
 * Prevents learned descriptions from breaking the regex engine.
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles a combined category → RegExp map by merging base patterns
 * with learned descriptions from Firestore.
 *
 * @param {Array<{normalizedDescription: string, categoryId: string}>} learnedPatterns
 *   Array of learned pattern documents (must have `learned: true`).
 * @param {Array<{id: string, name: string}>} categories
 *   The room's category list (used to resolve categoryId → category name).
 * @returns {Object.<string, RegExp>} A map of category name → combined RegExp.
 */
export function compileCombinedRegex(learnedPatterns = [], categories = []) {
  // Build a reverse map: categoryId → category name
  const idToName = {};
  categories.forEach(cat => {
    idToName[cat.id] = cat.name;
  });

  // Group learned descriptions by their resolved category name
  const learnedByCategory = {};
  learnedPatterns.forEach(pattern => {
    if (!pattern.normalizedDescription) return;

    // Resolve category name: try categoryId first, fallback to direct name match
    let categoryName = idToName[pattern.categoryId] || pattern.categoryId;

    // Fuzzy-match against BASE keys if the resolved name isn't in BASE
    if (!BASE_CATEGORY_REGEX[categoryName]) {
      const baseKey = Object.keys(BASE_CATEGORY_REGEX).find(key =>
        key.toLowerCase() === categoryName.toLowerCase() ||
        key.toLowerCase().includes(categoryName.toLowerCase()) ||
        categoryName.toLowerCase().includes(key.toLowerCase())
      );
      if (baseKey) categoryName = baseKey;
    }

    if (!learnedByCategory[categoryName]) {
      learnedByCategory[categoryName] = [];
    }
    learnedByCategory[categoryName].push(escapeRegExp(pattern.normalizedDescription));
  });

  // Merge base + learned for each category
  const combined = {};
  const allCategories = new Set([
    ...Object.keys(BASE_CATEGORY_REGEX),
    ...Object.keys(learnedByCategory),
  ]);

  allCategories.forEach(categoryName => {
    const baseRegex = BASE_CATEGORY_REGEX[categoryName];
    const learnedTerms = learnedByCategory[categoryName] || [];

    if (learnedTerms.length === 0) {
      // No learned terms — just use the base regex as-is
      combined[categoryName] = baseRegex || null;
    } else if (!baseRegex) {
      // Only learned terms (custom category not in base)
      combined[categoryName] = new RegExp(learnedTerms.join('|'), 'i');
    } else {
      // Merge: base.source | learned1 | learned2 ...
      const mergedSource = baseRegex.source + '|' + learnedTerms.join('|');
      combined[categoryName] = new RegExp(mergedSource, 'i');
    }
  });

  console.log(
    `[CategoryRegex] Compiled ${Object.keys(combined).length} category patterns.`,
    `Base: ${Object.keys(BASE_CATEGORY_REGEX).length},`,
    `Learned additions: ${learnedPatterns.length}.`
  );

  return combined;
}
