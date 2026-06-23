/**
 * categoryRegex.js
 *
 * Houses the base category regex map for Hinglish keyword → category matching.
 * IMPORTANT: This module is purely functional — no side effects on import.
 *
 * NOTE: The compileCombinedRegex / learned-patterns system has been deprecated.
 * No code should reference 'learned' or 'regex' pattern storage.
 * Category auto-select uses Hinglish keyword mapping only.
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
