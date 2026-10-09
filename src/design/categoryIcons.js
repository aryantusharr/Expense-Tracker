// The 36 "A · line" category icons from the canvas (System · Category icons board).
// 24×24 viewBox, stroke 1.75, round caps/joins. Colours cycle through the 8 category hues.
//
// Firestore keeps each category's `icon` as an emoji (unchanged data model). The redesign
// shows a line icon instead: resolveCategoryIcon() picks one from the category's name
// (then its emoji), falling back to "other". New categories may store `line:<key>`.

export const CATEGORY_ICONS = [
  ['food', 'Food & Dining', 'M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 0-3 2-3 5s1 4 3 4v9', '#8B7CFF'],
  ['groceries', 'Groceries', 'M4 9h16l-2 11H6zM8 9l4-6 4 6M9 13v4M15 13v4', '#5FD4C4'],
  ['coffee', 'Coffee & Tea', 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3c0 2 2 2 2 4M12 3c0 2 2 2 2 4', '#FF8FB5'],
  ['snacks', 'Snacks', 'M6 3h12l-1 3 1 3-1 3 1 3-1 3 1 3H6l1-3-1-3 1-3-1-3 1-3z', '#F5C26B'],
  ['transport', 'Transport', 'M3 16v-4l2-5h14l2 5v4zM3 16v3h3v-3M18 16v3h3v-3M7 13h.01M17 13h.01', '#6EC1FF'],
  ['fuel', 'Fuel', 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M7 8h6M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3', '#A8E06B'],
  ['rent', 'Rent', 'M8 15a4 4 0 1 1 3.5-6H21v3h-2v3h-3v-3h-4.5A4 4 0 0 1 8 15z', '#FF9A76'],
  ['electricity', 'Electricity', 'M13 2 4 14h7l-1 8 9-12h-7z', '#C9A7FF'],
  ['wifi', 'Wifi', 'M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01', '#8B7CFF'],
  ['recharge', 'Recharge', 'M7 2h10v20H7zM11 18h2', '#5FD4C4'],
  ['water', 'Water', 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z', '#FF8FB5'],
  ['gas', 'Gas', 'M8 6h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM10 6V3h4v3M6 12h12', '#F5C26B'],
  ['shopping', 'Shopping', 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2', '#6EC1FF'],
  ['clothes', 'Clothes', 'M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z', '#A8E06B'],
  ['health', 'Health', 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11zM9 11h6M12 8v6', '#FF9A76'],
  ['gym', 'Gym', 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12', '#C9A7FF'],
  ['movies', 'Movies', 'M3 5h18v14H3zM7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4', '#8B7CFF'],
  ['party', 'Party', 'M6 3h12l-6 8zM12 11v8M8 21h8', '#5FD4C4'],
  ['travel', 'Travel', 'M4 8h16v12H4zM9 8V5h6v3M4 13h16', '#FF8FB5'],
  ['flights', 'Flights', 'M10.5 13.5 3 11l1.5-1.5 8 1 5-5a2 2 0 0 1 3 3l-5 5 1 8L15 23l-2.5-7.5L9 19v3l-1.5 1-1-3.5L3 18.5 4 17h3z', '#F5C26B'],
  ['stay', 'Stay', 'M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6M7 11h.01', '#6EC1FF'],
  ['gifts', 'Gifts', 'M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0', '#A8E06B'],
  ['books', 'Books', 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 1 2-2h13v2', '#FF9A76'],
  ['pets', 'Pets', 'M8 14c-3 2-2 6 1 6 1 0 2-1 3-1s2 1 3 1c3 0 4-4 1-6-1-1-3-3-4-3s-3 2-4 3zM5 9.5h.01M9.5 5.5h.01M14.5 5.5h.01M19 9.5h.01', '#C9A7FF'],
  ['laundry', 'Laundry', 'M4 3h16v18H4zM4 7h16M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM7 5h.01', '#8B7CFF'],
  ['repairs', 'Repairs', 'M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2z', '#5FD4C4'],
  ['househelp', 'House help', 'M14 3 9 13M6 13h8l3 8H3z', '#FF8FB5'],
  ['salon', 'Salon', 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.5 7.5 20 20M8.5 16.5 20 4', '#F5C26B'],
  ['subscriptions', 'Subscriptions', 'M4 5h16v12H4zM8 21h8M12 17v4M10 9l5 2-5 2z', '#6EC1FF'],
  ['insurance', 'Insurance', 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4', '#A8E06B'],
  ['kids', 'Kids', 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 22v-6l-3-2 3-4h8l3 4-3 2v6', '#FF9A76'],
  ['other', 'Other', 'M5 12h.01M12 12h.01M19 12h.01', '#C9A7FF'],
  ['smoking', 'Smoking', 'M2 14h15v4H2zM12 14v4M20 14v4M19 11c0-2 2-2 2-4s-2-2-2-4', '#8B7CFF'],
  ['weed', 'Weed', 'M12 15C10 10 10.5 6 12 2c1.5 4 2 8 0 13zM12 15C8.5 13 6 10 5 6c3.5 1.5 6 4.5 7 9zM12 15c1-4.5 3.5-7.5 7-9-1 4-3.5 7-7 9zM12 15c-3 .5-6.5-.5-9-2 3-1.5 6.5-1.5 9 2zM12 15c2.5-3.5 6-3.5 9-2-2.5 1.5-6 2.5-9 2zM12 15v7', '#5FD4C4'],
  ['saving', 'Saving', 'M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2zM2 9v1a2 2 0 0 0 2 2h1M16 11h.01', '#FF8FB5'],
  ['taxes', 'Taxes & charges', 'M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', '#F5C26B'],
  ['gadgets', 'Gadgets', 'M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM9 6l1-4h4l1 4M9 18l1 4h4l1-4M12 10v2l1.5 1.5M18 11h1v2h-1', '#F5C26B'],
].map(([key, label, path, color]) => ({ key, label, path, color }))

const BY_KEY = Object.fromEntries(CATEGORY_ICONS.map(i => [i.key, i]))

// Name keywords → icon (first match wins; checked against the lower-cased category name).
const NAME_RULES = [
  [/\btax(es)?\b|taxes & charges|gst/, 'taxes'],
  [/smok|cigar|cig\b|tobacco|vape|hookah/, 'smoking'],
  [/weed|ganja|cannabis|\bmaal\b|joint/, 'weed'],
  [/saving|invest|\bsip\b|deposit|piggy/, 'saving'],
  [/gadget|watch|electronic|laptop|headphone|airpod|\bipad\b|\biphone\b|apple/, 'gadgets'],
  [/grocer|kirana|vegetable|fruit|supermarket/, 'groceries'],
  [/coffee|tea|chai|cafe/, 'coffee'],
  [/snack|chips|sweet/, 'snacks'],
  [/drink|alcohol|beer|wine|\bbar\b|party|nightlife|club/, 'party'],
  [/food|dining|restaurant|meal|lunch|dinner|breakfast|swiggy|zomato/, 'food'],
  [/fuel|petrol|diesel/, 'fuel'],
  [/flight|airline|airfare/, 'flights'],
  [/transport|cab|taxi|uber|ola|auto|metro|bus|train|commute/, 'transport'],
  [/rent|lease/, 'rent'],
  [/electric|utilit|power|bill/, 'electricity'],
  [/wifi|wi-fi|internet|broadband/, 'wifi'],
  [/recharge|mobile|phone/, 'recharge'],
  [/water/, 'water'],
  [/gas|cylinder|lpg/, 'gas'],
  [/cloth|apparel|fashion/, 'clothes'],
  [/shop/, 'shopping'],
  [/health|medic|doctor|pharma|hospital/, 'health'],
  [/gym|fitness|sport|yoga/, 'gym'],
  [/movie|cinema|entertain|netflix|show|concert/, 'movies'],
  [/stay|hotel|airbnb|hostel/, 'stay'],
  [/travel|trip|holiday|vacation/, 'travel'],
  [/gift/, 'gifts'],
  [/book|stationery|study|course/, 'books'],
  [/\bpets?\b|dog|\bcats?\b/, 'pets'],
  [/laundry|dry ?clean|iron/, 'laundry'],
  [/repair|maintenance|plumb/, 'repairs'],
  [/home|house|maid|clean|help/, 'househelp'],
  [/salon|hair|spa|groom|beauty/, 'salon'],
  [/subscri|\bott\b|spotify|prime/, 'subscriptions'],
  [/insur/, 'insurance'],
  [/kid|child|baby|school/, 'kids'],
  [/other|misc/, 'other'],
]

// Emoji used by the old default categories → icon (only when the name didn't match).
const EMOJI_RULES = {
  '🛒': 'groceries', '🏡': 'rent', '🏠': 'rent', '⚡': 'electricity', '🍽️': 'food', '🍽': 'food',
  '🚕': 'transport', '🎭': 'movies', '🛍️': 'shopping', '🛍': 'shopping', '💊': 'health',
  '🍻': 'party', '☕': 'coffee', '🪩': 'party', '📦': 'other', '🧹': 'househelp', '🏋️': 'gym',
  '🚬': 'smoking', '🌿': 'weed', '💰': 'saving', '⌚': 'gadgets', '💻': 'subscriptions',
}

export function resolveCategoryIcon(category) {
  if (!category) return BY_KEY.other
  const icon = category.icon || ''
  if (icon.startsWith('line:') && BY_KEY[icon.slice(5)]) return BY_KEY[icon.slice(5)]
  const name = (category.name || '').toLowerCase()
  for (const [re, key] of NAME_RULES) if (re.test(name)) return BY_KEY[key]
  if (EMOJI_RULES[icon]) return BY_KEY[EMOJI_RULES[icon]]
  return BY_KEY.other
}

export function getCategoryIcon(key) {
  return BY_KEY[key] || BY_KEY.other
}
