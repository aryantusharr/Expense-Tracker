/**
 * AAI chat greetings — pure (no React). Six contexts, ≥5 two-line greetings each.
 * Line 1 is the headline, line 2 the muted follow-up. Tokens: {name} {h} (12-hour clock) {n} (days).
 * pickGreeting never returns the same line twice in a row for a context (pass the last index back in).
 */
import { toDateStr, addDays, fromDateStr } from './common.js';

export const GREETINGS = {
  lateNight: [
    ['Raat ke {h} baje?', 'Kya mangaya, {name}?'],
    ['Neend nahi aa rahi?', 'Chalo, kharcha likhte hain.'],
    ['{h} baje bhi hisaab?', 'Respect, {name}.'],
    ['Sab so gaye.', 'Tum aur tumhara kharcha jaag rahe ho.'],
    ['Midnight snack ka bill?', 'Bolo, {name}.'],
    ['Itni raat ko UPI?', 'Chalo, add kar dete hain.'],
  ],
  morning: [
    ['Good morning, {name}.', 'Chai ka hisaab?'],
    ['Subah subah kharcha?', 'Bolo, kya hua?'],
    ['Utha gaya {name}?', 'Aaj kya likhna hai?'],
    ['Naya din, naya hisaab.', 'Kal ka kuch reh gaya?'],
    ['Chai pi li?', 'Toh likh bhi do, {name}.'],
    ['Morning, {name}.', 'Nashta kitne ka tha?'],
  ],
  day: [
    ['Lunch ho gaya?', 'Kitne ka, {name}?'],
    ['Kya mangaya, {name}?', 'Bolo, main likh deta hoon.'],
    ['Aaj ka kharcha?', 'Type karo, baaki main dekh lunga.'],
    ['Shaam ho gayi.', 'Kuch add karna hai, {name}?'],
    ['Dinner kya tha?', 'Bill bhi bhej sakte ho.'],
    ['Hello, {name}.', 'Kya add karein?'],
  ],
  noLog: [
    ['{n} din se khaali hai.', 'Catch up, {name}?'],
    ['{n} din ka kharcha kahan gaya?', 'Bolo, likhte hain.'],
    ['Kuch toh kharch hua hoga.', '{n} din se kuch nahi likha.'],
    ['Sab theek? {n} din se silence.', 'Chalo, ek ek karke.'],
    ['Hisaab {n} din peeche hai.', 'Pehle sabse bada kya tha?'],
  ],
  comingBack: [
    ['Arre, {name}!', 'Itne din baad. Sab theek?'],
    ['Wapas aa gaye.', 'Pending kharcha batao.'],
    ['Kahan the {name}?', 'App ne miss kiya.'],
    ['Long time, {name}.', 'Chalo, catch up karte hain.'],
    ['Welcome back.', 'Kya kya reh gaya?'],
  ],
  monthEnd: [
    ['Mahina khatam.', 'Sab likha hai?'],
    ['Month-end aa gaya.', 'Kuch chhoota toh nahi, {name}?'],
    ['Hisaab ka din.', 'Last-minute kharcha batao.'],
    ['Aakhri din, {name}.', 'Sab add kar diya?'],
    ['Mahina khatam, jeb bhi.', 'Bacha kuch likhne ko?'],
  ],
  bigDay: [
    ['Kal toh bada din tha.', 'Kuch aur reh gaya, {name}?'],
    ['Kal toh paisa udd gaya.', 'Aaj kya, {name}?'],
    ['Kal ka kharcha dekha.', 'Wallet theek hai, {name}?'],
    ['Bade din ke baad.', 'Aaj kya, {name}?'],
    ['Kal ki party ka hisaab.', 'Sab likh liya?'],
  ],
};

const num = e => parseFloat(e.amount) || 0;

/**
 * Which context fits right now?
 * ctx = { now, expenses, lastSeen (ms, this phone's previous app open, or null) }
 * Order: late night · nothing logged 2+ days · coming back · month-end · after a big day · morning · day.
 */
export function greetingContext({ now, expenses = [], lastSeen = null }) {
  const hour = now.getHours();
  const today = toDateStr(now);
  if (hour < 5) return { key: 'lateNight' };

  const dates = expenses.map(e => (e.date || '').slice(0, 10)).filter(Boolean).sort();
  const lastDate = dates[dates.length - 1];
  if (lastDate) {
    const gap = Math.round((fromDateStr(today) - fromDateStr(lastDate)) / 86400000);
    if (gap >= 2) return { key: 'noLog', n: gap };
  }
  if (lastSeen && now.getTime() - lastSeen > 3 * 86400000) return { key: 'comingBack' };

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() >= lastDay - 1) return { key: 'monthEnd' };

  const yest = toDateStr(addDays(now, -1));
  const perDay = {};
  for (const e of expenses) perDay[e.date] = (perDay[e.date] || 0) + num(e);
  const days = Object.keys(perDay).filter(d => d !== today);
  if (days.length >= 5 && perDay[yest]) {
    const avg = days.reduce((s, d) => s + perDay[d], 0) / days.length;
    if (perDay[yest] >= 500 && perDay[yest] >= avg * 2) return { key: 'bigDay' };
  }

  if (hour < 12) return { key: 'morning' };
  return { key: 'day' };
}

const fill = (s, { name, h, n }) => s
  .replace(/, \{name\}/g, name ? `, ${name}` : '')
  .replace(/ \{name\}/g, name ? ` ${name}` : '')
  .replace(/\{name\}/g, name || 'there')
  .replace(/\{h\}/g, String(h))
  .replace(/\{n\}/g, String(n ?? ''));

/** → { key, idx, line1, line2 }. lastIdx = the index shown last time for this key (or undefined). */
export function pickGreeting(context, { now, name = '', rand = Math.random, lastIdx } = {}) {
  const bank = GREETINGS[context.key] || GREETINGS.day;
  let idx = Math.floor(rand() * bank.length);
  if (bank.length > 1 && idx === lastIdx) idx = (idx + 1) % bank.length;
  const h = now.getHours() % 12 || 12;
  const vars = { name, h, n: context.n };
  const [a, b] = bank[idx];
  return { key: context.key, idx, line1: fill(a, vars), line2: fill(b, vars) };
}
