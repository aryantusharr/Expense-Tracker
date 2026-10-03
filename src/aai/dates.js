/**
 * Date words in a sentence → YYYY-MM-DD.
 * today/aaj · yesterday/kal · parso · "2 oct" / "oct 2" · "2/10" (day/month) · "last friday" / "friday".
 * Expenses are in the past, so "kal" is always yesterday and a future date is pushed back
 * (a week for weekdays, a year for day+month).
 */
import { MONTHS, toDateStr, addDays } from './common.js';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const monthIdx = w => MONTHS.indexOf(w.slice(0, 3));

/** Day+month → most recent past occurrence (this year, else last year). */
function pastDayMonth(day, month, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let d = new Date(now.getFullYear(), month, day);
  if (d.getMonth() !== month) return null; // 31 Feb etc.
  if (d > today) d = new Date(now.getFullYear() - 1, month, day);
  return d;
}

/**
 * @returns {{ date: string|null, rest: string }}  date null = no date words found.
 */
export function extractDate(text, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cut = (re, fn) => {
    const m = text.match(re);
    if (!m) return null;
    const date = fn(m);
    if (!date) return null;
    return { date: toDateStr(date), rest: text.replace(m[0], ' ') };
  };

  return (
    cut(/\b(?:today|aaj)\b/i, () => today) ||
    cut(/\bparso\b/i, () => addDays(today, -2)) ||
    cut(/\b(?:yesterday|kal)\b/i, () => addDays(today, -1)) ||
    cut(new RegExp(`(?<![\\d.,])(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON_RE}\\b`, 'i'), m =>
      pastDayMonth(+m[1], monthIdx(m[2].toLowerCase()), now)) ||
    cut(new RegExp(`\\b${MON_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?![\\d.,])`, 'i'), m =>
      pastDayMonth(+m[2], monthIdx(m[1].toLowerCase()), now)) ||
    cut(/(?<![\d.,/])(\d{1,2})\/(\d{1,2})(?!\d|\/)/, m => {
      const day = +m[1], month = +m[2] - 1;
      if (day < 1 || day > 31 || month < 0 || month > 11) return null;
      return pastDayMonth(day, month, now);
    }) ||
    cut(new RegExp(`\\b(last\\s+)?${DAY_RE}\\b`, 'i'), m => {
      const target = DAYS.indexOf(m[2].toLowerCase().slice(0, 3));
      let back = (today.getDay() - target + 7) % 7;
      if (back === 0 && m[1]) back = 7; // "last friday" on a friday = a week ago
      return addDays(today, -back);
    }) ||
    { date: null, rest: text }
  );
}
