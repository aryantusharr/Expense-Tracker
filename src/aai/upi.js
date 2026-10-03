/**
 * Payment text (copied from GPay / PhonePe / Paytm / BHIM, or any UPI message) → amount, payee, UPI ref, date.
 * Regexes are written from the usual shape of these messages — they must be checked against the
 * real copied samples (docs/AAI-Plan.md §4.2) before Chat B relies on them.
 *
 * parsePayment(text, now) → null if it doesn't look like a payment, else
 *   { app, direction: 'paid'|'received', amount, payee, upiRef, date (YYYY-MM-DD|null), time (HH:MM|null) }
 * paymentIntent(text, ctx) → { type:'payback', person, ... } | { type:'payment', ... } | null
 */
import { MONTHS, toDateStr, matchMember, cleanName } from './common.js';
import { guessCategory, learnPatterns } from '../utils/categoryGuess.js';

const AMOUNT = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i;
// Bank reference first (UTR / UPI Ref / UPI transaction ID), the app's own transaction ID last.
const REFS = [
  /\butr(?:\s*no)?\s*[:#.-]?\s*([A-Za-z0-9]{8,})/i,
  /upi\s*(?:ref(?:erence)?(?:\s*(?:no|id|number))?|transaction\s*id)\s*[:#.-]?\s*([A-Za-z0-9]{8,})/i,
  /(?:transaction|txn)\s*id\s*[:#.-]?\s*([A-Za-z0-9]{8,})/i,
  /ref(?:erence)?\s*(?:no|id)\s*[:#.-]?\s*([A-Za-z0-9]{8,})/i,
];
const findRef = t => { for (const re of REFS) { const m = t.match(re); if (m) return m[1]; } return null; };

/** App by name, else by the shape of the text (heuristic until real samples are checked). */
function appOf(t) {
  if (/google\s*pay|gpay|g\s*pay/i.test(t)) return 'gpay';
  if (/phonepe|phone\s*pe/i.test(t)) return 'phonepe';
  if (/paytm/i.test(t)) return 'paytm';
  if (/bhim/i.test(t)) return 'bhim';
  if (/\bUTR\s*No\b|transaction\s*id\s*:?\s*T\d{10,}/i.test(t)) return 'phonepe';
  if (/\border\s*id\b/i.test(t)) return 'paytm';
  if (/upi\s*transaction\s*id/i.test(t)) return 'gpay';
  return 'upi';
}

function parseDate(t, now) {
  // "3 Oct 2026" / "03 Oct, 2026" / "Oct 3, 2026"
  let m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})[,\s]+(\d{4})/);
  let day, mon, year;
  if (m) { day = +m[1]; mon = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)); year = +m[3]; }
  if (mon === undefined || mon < 0) {
    m = t.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})/);
    if (m) { mon = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)); day = +m[2]; year = +m[3]; }
  }
  if (mon === undefined || mon < 0) {
    m = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/); // dd/mm/yyyy (India)
    if (m) { day = +m[1]; mon = +m[2] - 1; year = +m[3] < 100 ? 2000 + +m[3] : +m[3]; }
  }
  if (day && mon >= 0 && year) return toDateStr(new Date(year, mon, day));
  if (/\btoday\b/i.test(t)) return toDateStr(now);
  return null;
}

function parseTime(t) {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1];
  if (m[3]) { const pm = m[3].toLowerCase() === 'pm'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function parsePayee(t) {
  const patterns = [
    /(?:paid|sent|payment|transferred)\s+(?:successfully\s+)?(?:₹|rs\.?|inr)?\s*[\d,.]*\s*to[:\s]+([^\n]+?)(?=\s+(?:on|at|via|using|upi|utr|ref|transaction|₹|rs\b)|\s*[\n(]|$)/i,
    /\bto[:\s]+([^\n]+?)(?=\s+(?:on|at|via|using|upi|utr|ref|transaction|₹|rs\b)|\s*[\n(]|$)/i,
    /(?:paid\s+to|sent\s+to|paying)[:\s]+([^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    const name = m?.[1]?.trim().replace(/[.,:;]+$/, '');
    if (name && !/^(?:₹|rs\b|\d)/i.test(name)) return name;
  }
  return null;
}

export function parsePayment(text, now = new Date()) {
  const t = (text || '').replace(/\r/g, '').trim();
  if (!t) return null;
  const amt = t.match(AMOUNT);
  if (!amt) return null;
  const amount = parseFloat(amt[1].replace(/,/g, ''));
  if (!(amount > 0)) return null;

  const received = /\b(?:received|credited|got|from)\b/i.test(t) && !/\b(?:paid|sent|debited)\b/i.test(t);
  const looksLikePayment = /\b(?:paid|payment|sent|received|credited|debited|transferred|upi|utr|transaction)\b/i.test(t);
  if (!looksLikePayment) return null;

  return {
    app: appOf(t),
    direction: received ? 'received' : 'paid',
    amount,
    payee: received ? null : parsePayee(t),
    upiRef: findRef(t),
    date: parseDate(t, now),
    time: parseTime(t),
  };
}

/** Decide what a pasted payment is: a pay-back to a roommate (not recorded) or an expense to a shop. */
export function paymentIntent(text, ctx) {
  const now = ctx.now || new Date();
  const p = parsePayment(text, now);
  if (!p || p.direction === 'received') return null;
  if (p.payee && !ctx.isPersonal) {
    const m = matchMember(p.payee.split(/\s+/)[0], ctx.users || []);
    const full = (ctx.users || []).find(u => cleanName(u.name).toLowerCase() === p.payee.toLowerCase());
    const person = full || (m.status === 'one' ? m.user : null);
    if (person && person.id !== ctx.me) return { type: 'payback', person: person.id, personName: cleanName(person.name), ...p };
  }
  const learned = ctx.learned || learnPatterns(ctx.expenses || [], ctx.categories || [], now.getTime());
  const description = p.payee ? p.payee.replace(/\s+/g, ' ') : '';
  return {
    type: 'payment',
    ...p,
    description,
    categoryId: description ? guessCategory(description, learned, ctx.categories) : null,
    date: p.date || toDateStr(now),
  };
}
