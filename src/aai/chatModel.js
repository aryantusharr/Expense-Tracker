/**
 * AAI chat model — turns a parsed sentence into what the chat shows. Pure (no React, no Firebase).
 *
 *   respond(text, session) → { steps[], reply, card, error?, chips? }   (error = an errors.js reply instead of a card)
 *
 * card is plain data (so a chat can be stored on the phone later):
 *   { kind: 'quick', draft, dots }
 *   { kind: 'bill',  bill: { name, nameUnsure, date, paidBy, total, totalTyped, items[] }, dots }
 * dots = Set-like array of field keys that get the dotted "tap me" underline (or 'all' for the first card in a chat).
 * Everything is typed → one itemised bill by default; "Add as N separate expenses" is the second button.
 * AAI only ADDS expenses, so commands (undo / balance / remind …) get a short plain reply and no card.
 */
import { parse } from './parse.js';
import { unclearTyped } from './errors.js';
import { fmtINR, cleanName, MONTH_NAMES, fromDateStr, toDateStr, addDays } from './common.js';

const r2 = n => Math.round(n * 100) / 100;
let seq = 0;
export const uid = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Item amounts sum + the "Rest of the bill" line. total is what was typed (or the sum when none was). */
export function billTotals(bill) {
  const real = bill.items.filter(i => !i.rest);
  const sum = r2(real.reduce((s, i) => s + (i.amount || 0), 0));
  const rest = bill.items.find(i => i.rest);
  if (!bill.totalTyped) return { sum, total: r2(bill.items.reduce((s, i) => s + (i.amount || 0), 0)), restAmount: 0, over: 0 };
  const left = r2(bill.total - sum);
  return { sum, total: bill.total, restAmount: rest ? Math.max(left, 0) : 0, over: left < -0.004 ? -left : 0, left };
}

/** Rest line follows the typed total unless someone typed its amount by hand. */
export function syncRest(bill) {
  if (!bill.totalTyped) return bill;
  const { restAmount } = billTotals(bill);
  const items = bill.items.map(i => (i.rest && !i.manual ? { ...i, amount: restAmount } : i));
  return { ...bill, items };
}

/** Rows that actually count (the rest line drops out at ₹0). */
export const liveItems = bill => bill.items.filter(i => !(i.rest && !(i.amount > 0)));

const first = (arr, fb) => (arr && arr.length ? arr[0] : fb);

function quickCard(intent, session, firstCard) {
  const unknown = intent.type === 'unknown';
  const draft = {
    amount: unknown ? 0 : intent.amount,
    description: unknown ? (intent.description || '') : intent.description,
    categoryId: unknown ? null : intent.categoryId,
    date: !intent.dateGiven && session.date ? session.date : (intent.date || session.today),
    dateGiven: !!intent.dateGiven,
    paidBy: unknown ? (session.me || null) : intent.paidBy,
    splitAmong: unknown ? (session.isPersonal ? [] : session.users.map(u => u.id)) : intent.splitAmong,
  };
  const unsure = [];
  if (unknown || intent.amountFlagged) unsure.push('amount');
  if (!draft.description) unsure.push('description');
  if (!draft.categoryId) unsure.push('category');
  if (!draft.paidBy && !session.isPersonal) unsure.push('paidBy');
  if (intent.questions?.length) unsure.push('split');
  return { kind: 'quick', draft, dots: firstCard ? ['all'] : unsure };
}

function billCard(bill, unsure, firstCard) {
  return { kind: 'bill', bill: syncRest(bill), dots: firstCard ? ['all'] : unsure };
}

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const spoken = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const Spoken = (n, one, many) => `${WORDS[n] || n} ${n === 1 ? one : many}`;

/**
 * session = { users, me, categories, expenses, isPersonal, now, date (the "Adding for" date or null),
 *             firstCard (no card yet in this chat) }
 */
function respondInner(text, session) {
  const { users, me, categories, expenses, isPersonal, now } = session;
  const today = session.today || toStr(now);
  const sess = { ...session, today };
  const intent = parse(text, { users, me, categories, expenses, isPersonal, now });
  const steps = buildStepsFor(intent, text, sess);

  if (intent.type === 'empty') return { steps: [], reply: null, card: null };

  if (intent.type === 'command') {
    return {
      steps,
      reply: 'I only add expenses now. Try “chai 40, auto 120” — or add a bill. Balances live on the Dashboard.',
      card: null,
    };
  }

  const n = users.length;
  const allIds = users.map(u => u.id);
  const dateFor = it => (!it.dateGiven && sess.date ? sess.date : it.date || today);

  if (intent.type === 'many') {
    const exps = intent.expenses;
    const items = exps.map(e => ({
      id: uid(), name: e.description || 'Item', amount: e.amount, categoryId: e.categoryId,
      splitAmong: e.splitAmong, unsure: !e.categoryId,
    }));
    const bill = {
      name: 'Untitled bill', nameUnsure: true, date: dateFor(exps[0]), paidBy: first(exps).paidBy,
      total: intent.total, totalTyped: false, items,
    };
    const payerBy = users.find(u => u.id === bill.paidBy);
    const who = !bill.paidBy ? '' : bill.paidBy === me ? '' : ` ${cleanName(payerBy?.name)} paid.`;
    return {
      steps,
      reply: `${Spoken(intent.count, 'thing', 'things')}, ${fmtINR(intent.total)}. I've made it one bill.${who} Name it?`,
      card: billCard(bill, ['name', ...(bill.paidBy ? [] : ['paidBy'])], session.firstCard),
    };
  }

  if (intent.type === 'bill') {
    const items = intent.lines.map(l => ({
      id: uid(), name: l.description || 'Item', amount: l.amount, categoryId: l.categoryId || intent.categoryId,
      splitAmong: l.splitAmong, unsure: !(l.categoryId || intent.categoryId),
    }));
    // a "rest" line — typed, or made up when the items don't reach the total
    const left = intent.restAmount;
    if (intent.rest || left > 0.004) {
      items.push({
        id: uid(), name: 'Rest of the bill', rest: true, amount: Math.max(left, 0),
        categoryId: intent.categoryId || items[0]?.categoryId || null,
        splitAmong: intent.rest ? intent.rest.splitAmong : (isPersonal ? [me || users[0]?.id] : allIds),
      });
    }
    const bill = {
      name: intent.merchant || 'Untitled bill', nameUnsure: !intent.merchant, date: dateFor(intent), paidBy: intent.paidBy,
      total: intent.total, totalTyped: true, items,
    };
    const rest = items.find(i => i.rest);
    const name = intent.merchant ? `**${intent.merchant}**` : 'bill';
    const lines = intent.lines.length;
    const mine = isPersonal && !session.solo;            // a personal room: nobody to ask (board 10B)
    let reply = mine
      ? `Your ${name} bill — ${spoken(items.length, 'item', 'items')}, ${fmtINR(intent.total)}. No questions needed, it's all yours.`
      : `One ${name} bill, ${spoken(lines, 'line', 'lines')}.`;
    if (left < -0.004) reply = `Those ${spoken(lines, 'line', 'lines')} come to ${fmtINR(-left)} more than ${fmtINR(intent.total)}. Check the amounts.`;
    else if (rest && rest.amount > 0) {
      const sp = rest.splitAmong.length;
      reply += isPersonal
        ? ` ${fmtINR(rest.amount)} left over. Tap it if that's wrong.`
        : ` ${fmtINR(rest.amount)} left over — split ${sp === n ? `${n} ways` : spoken(sp, 'way', 'ways')}. Tap it if that's wrong.`;
    }
    const unsure = [];
    if (!intent.merchant) unsure.push('name');
    if (!intent.paidBy && !isPersonal) unsure.push('paidBy');
    if (rest) unsure.push('rest');
    return { steps, reply, card: billCard(bill, unsure, session.firstCard) };
  }

  // no amount → an UNCLEAR reply (its "Add by hand" button makes the card, see handCard)
  if (intent.type === 'unknown') return { steps, reply: null, card: null, error: unclearTyped(text) };

  // expense → one quick card
  const card = quickCard(intent, sess, session.firstCard);
  let reply = null;
  if (intent.questions?.length) reply = intent.questions[0].message || 'Check who it\'s split with before saving.';
  else if (intent.needsIdentity) reply = 'Who paid? Tap the name on the card.';
  return { steps, reply, card };
}

/**
 * AAI's answer to typed text: { steps, reply, card, error?, chips? }.
 * session.solo (a shared room with only you in it) = no split questions; AAI says so and offers "Invite roommates".
 */
export function respond(text, session) {
  const r = respondInner(text, session);
  if (session.solo && r.card) {
    const name = session.roomName ? `**${session.roomName}**` : 'this room';
    if (r.card.kind === 'quick' && !r.reply) r.reply = `Nobody else is in ${name} yet, so there's nothing to split.`;
    r.chips = [{ id: 'invite', label: 'Invite roommates · share code' }];
  }
  return r;
}

/** "Add by hand" on an UNCLEAR reply: the same text as a card with amount 0 (the person types the ₹). */
export function handCard(text, session) {
  const intent = parse(text, { users: session.users, me: session.me, categories: session.categories, expenses: session.expenses, isPersonal: session.isPersonal, now: session.now });
  const today = session.today || toDateStr(session.now);
  return {
    steps: [],
    reply: 'Tap the ₹ and type it.',
    card: quickCard({ ...intent, type: 'unknown' }, { ...session, today }, session.firstCard),
  };
}

const toStr = toDateStr;

/** 'Today' · 'Yesterday · 3 Oct' · '2 Oct' */
export function dayLabel(dateStr, now = new Date()) {
  if (!dateStr) return '';
  const d = fromDateStr(dateStr);
  const short = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  if (dateStr === toDateStr(now)) return 'Today';
  if (dateStr === toDateStr(addDays(now, -1))) return `Yesterday · ${short}`;
  return short;
}
const shortDay = (dateStr, now) => { const l = dayLabel(dateStr, now); return l.includes('·') ? `${l.split(' · ')[1]}` : l; };

// ── thinking steps (plain words, tied to what really happened, never a joke about the final numbers) ──

const ordinal = n => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
};
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const clip = (t, n = 26) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function buildStepsFor(intent, text, session) {
  const { users, expenses, isPersonal, now } = session;
  const h = hash(text);
  const t = clip(text.trim().replace(/\s+/g, ' '));
  const steps = [];
  const add = (s, bold) => steps.push(bold ? { text: s, bold } : { text: s });
  const n = users.length;

  if (intent.type === 'many' || intent.type === 'bill') {
    const count = intent.type === 'many' ? intent.count : intent.lines.length;
    if (intent.type === 'many') add(`spotted ${count} lines with one total… that is a bill, not ${count} expenses.`);
    else add(`reading "${t}"… a shop, a total and ${count} line${count === 1 ? '' : 's'}.`);
    const items = intent.type === 'many' ? intent.expenses : intent.lines;
    const partial = !isPersonal && items.find(i => i.splitAmong && i.splitAmong.length > 0 && i.splitAmong.length < n);
    if (partial) {
      const out = users.filter(u => !partial.splitAmong.includes(u.id)).map(u => cleanName(u.name));
      if (out.length) add(`"${clip(`${partial.description || 'item'} ${partial.amount}`, 22)}"… ${out.join(' and ')} ${out.length > 1 ? 'are' : 'is'} out of this one.`);
    }
    if (intent.type === 'bill' && intent.rest) add('"rest all"… someone got tired of typing. Fair.');
    else if (intent.type === 'bill' && intent.restAmount > 0.004) add('adding up the lines… some of the bill is missing. I\'ll split the rest.');
  } else if (intent.type === 'command') {
    add(`reading "${t}"… that is not an expense.`);
  } else {
    const desc = norm(intent.description);
    const times = desc ? expenses.filter(e => norm(e.description) === desc).length + 1 : 1;
    if (intent.type === 'unknown') add(`parsing "${t}"… I see words, no rupees.`);
    else if (times >= 4) add(`parsing "${t}"… ${ordinal(times)} time. Not judging.`);
    else add(`parsing "${t}"… ${pick(['one thing, no drama.', 'easy one.', 'clean and simple.', 'I have seen worse.'], h)}`);

    if (intent.type === 'expense') {
      if (intent.dateGiven) add(`checking date… ${shortDay(intent.date, now)}, right?`);
      if (!isPersonal && n > 1) {
        const sp = intent.splitAmong.length;
        if (sp && sp < n) add(`counting roommates… only ${sp} of ${n} are in this.`);
        else add(`counting roommates… ${pick(['still', 'all', 'yep,'], h)} ${n}.`);
        if (sp > 1 && Math.round(intent.amount * 100) % sp !== 0) {
          const last = users.find(u => u.id === intent.splitAmong[sp - 1]);
          add(`rounding paise… odd paisa goes to ${cleanName(last?.name)}. Again.`);
        }
      }
    }
  }
  return steps.slice(0, 4);
}

/** "SAME BILL AGAIN" chip → a bill card copied from a past bill (items, categories, splits), dated today (or the "Adding for" date). */
export function billFromPast(group, session) {
  const { users, me, isPersonal } = session;
  const today = session.today || toDateStr(session.now);
  const items = group.items.map(e => ({
    id: uid(), name: e.description || 'Item', amount: parseFloat(e.amount) || 0, categoryId: e.categoryId || null,
    splitAmong: isPersonal ? [me || users[0]?.id] : (e.splitAmong || users.map(u => u.id)), unsure: !e.categoryId,
  }));
  const f = group.items[0];
  const payer = isPersonal ? (me || users[0]?.id) : (users.some(u => u.id === f.paidBy) ? f.paidBy : me);
  const bill = {
    name: group.name, nameUnsure: false, date: session.date || today, paidBy: payer || null,
    total: items.reduce((s, i) => s + i.amount, 0), totalTyped: false, items,
  };
  return {
    steps: [
      { text: `finding "${clip(group.name, 22)}"… found it, last one was ${group.last.toLowerCase()}.` },
      { text: `copying ${group.count} lines… same names, same splits.` },
    ],
    reply: `Same **${group.name}** bill — ${spoken(group.count, 'item', 'items')}, ${fmtINR(bill.total)}. Dated ${session.date ? dayLabel(session.date, session.now).toLowerCase() : 'today'}. Check the amounts, then save.`,
    card: billCard(bill, [], session.firstCard),
  };
}
