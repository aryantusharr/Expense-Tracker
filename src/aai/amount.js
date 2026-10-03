/**
 * Amount words in a sentence: ₹450 · 450rs · rs 450 · 4.5k · 1,200 · 120+80.
 * If several numbers are left, a number next to ₹/rs wins, otherwise the largest one,
 * and the result is flagged so the card can ask the user to check it.
 */

const NUM = String.raw`\d+(?:,\d{2,3})*(?:\.\d+)?(?:k(?![a-z]))?`;
const EXPR = `${NUM}(?:\\s*[+*×]\\s*${NUM})*`;
const CUR_BEFORE = String.raw`(?:₹|rs\.?|inr|rupees?)\s*`;
const CUR_AFTER = String.raw`\s*(?:₹|rs\b\.?|inr\b|rupees?\b|rupaye\b|/-)`;
const CAND = new RegExp(String.raw`(?<![\w.,])(${CUR_BEFORE})?(${EXPR})(${CUR_AFTER})?`, 'gi');

function num(s) {
  const k = /k$/i.test(s);
  const v = parseFloat(s.replace(/,/g, '').replace(/k$/i, ''));
  return k ? v * 1000 : v;
}

/** "120+80" / "4.5k" / "2*50" → number (2 decimals), or 0. */
export function evalAmount(expr) {
  let sum = 0;
  for (const term of expr.split('+')) {
    let prod = 1;
    for (const f of term.split(/[*×]/)) {
      const v = num(f.trim());
      if (Number.isNaN(v)) return 0;
      prod *= v;
    }
    sum += prod;
  }
  return Math.round(sum * 100) / 100;
}

/**
 * @returns {{ amount: number, flagged: boolean, rest: string }}  amount 0 = none found.
 */
export function extractAmount(text) {
  const cands = [];
  for (const m of text.matchAll(CAND)) {
    const value = evalAmount(m[2]);
    if (value <= 0) continue;
    cands.push({ value, marked: !!(m[1] || m[3]), start: m.index, end: m.index + m[0].length });
  }
  if (!cands.length) return { amount: 0, flagged: false, rest: text };
  const pool = cands.some(c => c.marked) ? cands.filter(c => c.marked) : cands;
  const pick = pool.reduce((a, b) => (b.value > a.value ? b : a));
  return {
    amount: pick.value,
    flagged: cands.length > 1,
    rest: text.slice(0, pick.start) + ' ' + text.slice(pick.end),
  };
}
