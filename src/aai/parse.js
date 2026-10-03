/**
 * AAI sentence parser: one typed sentence → an Intent (no network, no React).
 *
 * parse(text, ctx) → one of
 *   { type: 'empty' }
 *   { type: 'expense', amount, amountFlagged, description, categoryId, date, paidBy, needsIdentity,
 *     splitAmong, splitNote, personal, questions[] }
 *   { type: 'many', expenses[], total, count, billAlt }       "3 expenses or 1 bill?"
 *   { type: 'bill', merchant, total, date, paidBy, lines[], rest, mismatch }
 *   { type: 'command', cmd: 'undo'|'change'|'remove'|'remind'|'settle'|'balance'|'spend', ... }
 *   { type: 'unknown', text, description }                    "Add as expense ₹—?"
 *
 * ctx = { users, me (userId|null), categories, expenses, isPersonal, now (Date), learned (Map, optional) }
 *
 * Order of work (each step removes the words it used). Ratio is read before the date so that
 * "2/10" (a date) and "60/40" (a ratio) are told apart, and before the amount so "60/40" isn't a number.
 */
import { guessCategory, learnPatterns, normalize, findMatchingCategory } from '../utils/categoryGuess.js';
import { extractDate } from './dates.js';
import { extractAmount, evalAmount } from './amount.js';
import { extractPeople } from './people.js';
import { extractRatio, resolveSplit } from './split.js';
import { matchMember, isSelfWord, lower } from './common.js';

const FILLER = new Set(['for', 'ka', 'ki', 'ke', 'on', 'the', 'paid', 'diya', 'di', 'rupees', 'rupee', 'rupaye',
  'rs', 'ne', 'to', 'by', 'with', 'me', 'i', 'maine', 'a']);

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

function cleanDescription(text) {
  const words = text
    .replace(/[:;,.₹]+/g, ' ')
    .split(/\s+/)
    .filter(w => w && !FILLER.has(lower(w)) && !/^[+\-*/&|]+$/.test(w));
  return cap(words.join(' ').trim());
}

const AMT = String.raw`(\d[\d,]*(?:\.\d+)?k?)`;

function resolvePersonWord(word, ctx) {
  const m = matchMember(word, ctx.users);
  if (m.status === 'one') return { id: m.user.id };
  if (m.status === 'many') return { candidates: m.candidates.map(c => c.id), name: word };
  return { unknown: true, name: word };
}

/** "undo", "change last to 500", "kitna dena hai", "food this month" … → command intent or null. */
function parseCommand(raw, ctx) {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
  if (!t) return null;

  if (/^undo(?: last)?$/.test(t)) return { type: 'command', cmd: 'undo' };

  let m = t.match(new RegExp(`^(?:change|edit|make|update|fix)\\s+(?:the\\s+)?last(?:\\s+one)?\\s*(?:to|=|:)?\\s*(?:₹|rs\\.?\\s*)?${AMT}$`));
  if (m) return { type: 'command', cmd: 'change', amount: evalAmount(m[1]) };

  m = t.match(/^(?:remove|hata(?:o)?|delete)\s+(\S+)\s+(?:from|se)\s+(.+)$/);
  if (m) return { type: 'command', cmd: 'remove', person: resolvePersonWord(m[1], ctx), description: m[2].trim() };

  m = t.match(/^remind(?:er)?(?:\s+(\S+))?$/);
  if (m) return { type: 'command', cmd: 'remind', person: m[1] ? resolvePersonWord(m[1], ctx) : null };

  if (/^(?:settle(?:\s+(?:all|up|karo))?|hisaab(?:\s+karo)?|who owes whom|kisko kitna dena)$/.test(t)) {
    return { type: 'command', cmd: 'settle' };
  }
  if (/^(?:kitna dena(?: hai)?|kitna lena(?: hai)?|how much (?:do )?i owe|how much (?:am i|do i) (?:owed|owe)|balance|balances|who owes me|kisko dena hai)$/.test(t)) {
    return { type: 'command', cmd: 'balance' };
  }

  // spend questions: "food this month", "last month", "biggest spend", "vs last month"
  if (!/\d/.test(t)) {
    const period =
      /\b(?:biggest|sabse bada|largest|highest)\b/.test(t) ? 'biggest'
      : /\bvs\b|\bcompare\b|\bcompared\b/.test(t) ? 'compare'
      : /\b(?:last|pichle|previous)\s+(?:month|mahine)\b/.test(t) ? 'last'
      : /\b(?:this|is|current)\s+(?:month|mahine)\b/.test(t) ? 'this'
      : null;
    if (period) {
      const left = t.replace(/\b(?:biggest|sabse bada|largest|highest|vs|compare[d]?|last|pichle|previous|this|is|current|month|mahine|spend|spending|expense|kharcha|kharch|kitna|how much|did i|do i|spent)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
      let categoryId = null;
      if (left) {
        const w = normalize(left).split(' ');
        const hit = (ctx.categories || []).find(c => w.some(x => x.length >= 3 && normalize(c.name).split(' ').some(n => n.startsWith(x))));
        categoryId = hit?.id || guessCategory(left, ctx.learned, ctx.categories) || null;
        if (!categoryId) {
          const f = findMatchingCategory(left, ctx.categories);
          categoryId = f?.id || null;
        }
      }
      return { type: 'command', cmd: 'spend', period, categoryId };
    }
  }
  return null;
}

/** Split into several expenses when each part has its own amount. */
function splitMany(text) {
  const parts = text.split(/\n|(?<!\d),|,(?!\d)|\s+(?:and|aur)\s+/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  if (!parts.every(p => extractAmount(p).amount > 0)) return null;
  return parts;
}

/** Parse one expense sentence (no splitting into several). */
function parseExpense(text, ctx) {
  const { users, me, categories, isPersonal, now } = ctx;
  const { ratio, rest: r1 } = extractRatio(text);
  const { date, rest: r2 } = extractDate(r1, now);
  const people = extractPeople(r2, users);
  const { amount, flagged, rest: r3 } = extractAmount(people.rest);

  if (!(amount > 0)) return null;

  const description = cleanDescription(r3);
  const categoryId = description ? guessCategory(description, ctx.learned, categories) : null;

  // payer: named → that person, else the phone owner
  let paidBy = null;
  let needsIdentity = false;
  if (people.payer?.id) paidBy = people.payer.id;
  else if (me && users.some(u => u.id === me)) paidBy = me;
  else needsIdentity = true;

  const split = resolveSplit({ users, meId: me, payerId: paidBy, people, ratio, isPersonal });
  const questions = isPersonal ? [] : split.questions;

  return {
    type: 'expense',
    amount,
    amountFlagged: flagged,
    description,
    categoryId,
    date: date || ctx.todayStr,
    dateGiven: !!date,
    paidBy,
    needsIdentity: needsIdentity && !isPersonal,
    splitAmong: split.splitAmong,
    splitNote: split.note,
    personal: !!isPersonal,
    ratio: ratio ? ratio.text : null,
    questions,
  };
}

/** "dmart 1240: atta 320 all, chips 90 me+ravi, rest all" → bill intent. */
function parseBill(text, ctx) {
  const m = text.match(/^([^:]+?)\s*:\s*(.+)$/s);
  if (!m) return null;
  const head = extractAmount(m[1]);
  if (!(head.amount > 0)) return null;

  const { date, rest: headRest } = extractDate(head.rest, ctx.now);
  const headPeople = extractPeople(headRest, ctx.users);
  const merchant = cleanDescription(headPeople.rest);
  const payerId = headPeople.payer?.id || (ctx.me && ctx.users.some(u => u.id === ctx.me) ? ctx.me : null);

  const lines = [];
  let rest = null;
  const questions = [...headPeople.questions];
  const parts = m[2].split(/\n|(?<!\d),|,(?!\d)/).map(s => s.trim()).filter(Boolean);

  const peopleFor = part => {
    const pe = extractPeople(part, ctx.users);
    const sp = resolveSplit({ users: ctx.users, meId: ctx.me, payerId, people: pe, ratio: null, isPersonal: ctx.isPersonal });
    questions.push(...pe.questions);
    return { pe, sp };
  };

  for (const part of parts) {
    const isRest = /^(?:rest|baaki|baki|remaining)\b/i.test(part);
    if (isRest) {
      const { sp } = peopleFor(part.replace(/^\S+\s*/, ''));
      rest = { splitAmong: sp.splitAmong, note: sp.note };
      continue;
    }
    const a = extractAmount(part);
    if (!(a.amount > 0)) continue;
    const { sp, pe } = peopleFor(a.rest);
    const name = cleanDescription(pe.rest);
    lines.push({
      description: name,
      amount: a.amount,
      categoryId: name ? guessCategory(name, ctx.learned, ctx.categories) : null,
      splitAmong: sp.splitAmong,
      splitNote: sp.note,
    });
  }
  if (!lines.length && !rest) return null;

  const itemsSum = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const left = Math.round((head.amount - itemsSum) * 100) / 100;
  if (rest) rest.amount = Math.max(left, 0);
  return {
    type: 'bill',
    merchant,
    total: head.amount,
    date: date || ctx.todayStr,
    paidBy: payerId,
    needsIdentity: !payerId && !ctx.isPersonal,
    categoryId: merchant ? guessCategory(merchant, ctx.learned, ctx.categories) : null,
    lines,
    rest,
    restAmount: left,
    mismatch: left < 0 || (!rest && left !== 0),
    questions,
  };
}

export function parse(text, ctx) {
  const raw = (text || '').trim();
  if (!raw) return { type: 'empty' };

  const full = {
    users: [], categories: [], expenses: [], now: new Date(), me: null, isPersonal: false, ...ctx,
  };
  const d = full.now;
  full.todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!full.learned) full.learned = learnPatterns(full.expenses, full.categories, d.getTime());

  const lowered = raw.replace(/\s+/g, ' ');

  // 1 · bill: "name total: item amt who, …, rest who"
  if (lowered.includes(':')) {
    const bill = parseBill(lowered, full);
    if (bill) return bill;
  }

  // 2 · commands (only when the sentence isn't an expense)
  const cmd = parseCommand(raw, full);
  if (cmd) return cmd;

  // 3 · several expenses?
  const parts = splitMany(raw);
  if (parts) {
    const expenses = parts.map(p => parseExpense(p.toLowerCase(), full)).filter(Boolean);
    if (expenses.length >= 2) {
      const total = Math.round(expenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;
      return {
        type: 'many',
        expenses,
        count: expenses.length,
        total,
        billAlt: { total, lines: expenses.map(e => ({ description: e.description, amount: e.amount, categoryId: e.categoryId })) },
      };
    }
  }

  // 4 · one expense
  const one = parseExpense(raw.toLowerCase(), full);
  if (one) return one;

  const { rest } = extractDate(raw.toLowerCase(), full.now);
  return { type: 'unknown', text: raw, description: cleanDescription(rest) };
}

export { isSelfWord };
