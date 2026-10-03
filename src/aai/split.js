/**
 * Split rules. AAI only does EQUAL splits (the data model has no unequal shares).
 *  - Ratios ("50-50", "half-half", "33/33/33") mean "equal between that many people".
 *  - When names are given, the names win and the ratio is ignored.
 *  - With no names and a ratio that doesn't fit the room, the buddy asks (pickSplit question).
 *  - Unequal ratios (60/40) can't be saved: "AAI splits equally · pick who's in".
 */
import { cleanName } from './common.js';

/** Pull a ratio out of the text. → { rest, ratio: null | { text, n, equal } } */
export function extractRatio(text) {
  const word = text.match(/\b(?:half[\s-]*half|aadha[\s-]*aadha|adha[\s-]*adha)\b/i);
  if (word) {
    return { rest: text.replace(word[0], ' '), ratio: { text: '50-50', n: 2, equal: true } };
  }
  const re = /(?<![\d.,/-])(\d{1,3}(?:\s*[/-]\s*\d{1,3})+)(?![\d.,/]|-\d)/g;
  for (const m of text.matchAll(re)) {
    const parts = m[1].split(/\s*[/-]\s*/).map(Number);
    const sum = parts.reduce((a, b) => a + b, 0);
    if (parts.length < 2 || sum < 98 || sum > 100) continue; // "2/10" is a date, "120-20" a sum
    const equal = Math.max(...parts) - Math.min(...parts) <= 1;
    return {
      rest: text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length),
      ratio: { text: m[1].replace(/\s+/g, ''), n: parts.length, equal },
    };
  }
  return { rest: text, ratio: null };
}

/**
 * Work out who is in the split.
 * @param {object} p  { users, meId, payerId, people (from extractPeople), ratio, isPersonal }
 * @returns {{ splitAmong: string[], note: string, questions: object[] }}
 *   note: 'personal' | 'all' | 'just you' | 'named' | 'equal' | 'pick'
 */
export function resolveSplit({ users, meId, payerId, people, ratio, isPersonal }) {
  const ids = users.map(u => u.id);
  const order = set => ids.filter(id => set.has(id));
  const questions = [...people.questions];

  if (isPersonal) {
    const self = meId && ids.includes(meId) ? meId : ids[0];
    return { splitAmong: self ? [self] : [], note: 'personal', questions: [] };
  }

  const toSet = (list, self) => {
    const s = new Set(list);
    if (self && meId) s.add(meId);
    return s;
  };

  // "only x" / "me+ravi" → exactly these people
  if (people.literal) {
    const s = toSet(people.literal, people.literalSelf);
    if (s.size) return { splitAmong: order(s), note: 'named', questions };
  }

  const named = toSet(people.include, people.includeSelf);
  const hasNames = named.size > 0;
  const hasExclusions = people.exclude.length > 0 || people.excludeSelf;
  const base = people.all ? new Set(ids) : null;

  let set;
  if (base) set = base;
  else if (hasNames) {
    set = new Set(named);
    if (payerId) set.add(payerId);
  } else set = new Set(ids);

  if (hasExclusions) {
    people.exclude.forEach(id => set.delete(id));
    if (people.excludeSelf && meId) set.delete(meId);
    if (!set.size) { const who = payerId || meId || ids[0]; if (who) set.add(who); }
    const split = order(set);
    return {
      splitAmong: split,
      note: split.length === 1 && split[0] === (meId || payerId) ? 'just you' : 'named',
      questions,
    };
  }

  // ratio only matters when no one is named ("names win")
  if (ratio && !hasNames && !people.all) {
    const size = ids.length;
    if (ratio.equal && ratio.n === size) {
      return { splitAmong: ids, note: 'equal', questions };
    }
    if (ratio.equal && ratio.n < size) {
      const out = size - ratio.n;
      const whosOut = out === 1 && ratio.n >= 3; // 4 people, 33/33/33 → "who's out?"; halves → "pick 2"
      questions.push({
        kind: 'pickSplit',
        need: ratio.n,
        options: ids,
        selected: whosOut ? [...ids] : (payerId ? [payerId] : []),
        message: whosOut
          ? `Split between ${ratio.n} · who's out?`
          : `${ratio.text} between who? Pick ${ratio.n}`,
        allWays: size,
        allWaysLabel: `Split ${size} ways instead`,
      });
      return { splitAmong: whosOut ? [...ids] : (payerId ? [payerId] : []), note: 'pick', questions };
    }
    // unequal ratio, or more parts than people
    questions.push({
      kind: 'pickSplit', need: null, options: ids, selected: [...ids],
      message: "AAI splits equally · pick who's in",
      allWays: null, allWaysLabel: null,
    });
    return { splitAmong: [...ids], note: 'pick', questions };
  }

  const split = order(set);
  const everyone = split.length === ids.length;
  return { splitAmong: split, note: everyone ? 'all' : 'named', questions };
}

export const displayName = u => cleanName(u?.name);
