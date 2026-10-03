/**
 * Who paid / who is in the split, read from the words of a sentence.
 *   payer:  "<name> paid" · "paid by <name>" · "<name> ne diya" · "maine diya" / "i paid"
 *   people: "with a b" · "all / sab / everyone" · "me+ravi" · "not / except / bina meera" · "only meera"
 * Names match room members by start of name, ignoring case, the "Test " prefix and one typo.
 * Words used here are removed from the returned `rest`.
 */
import { lower, matchMember, isSelfWord } from './common.js';

const ALL = new Set(['all', 'sab', 'sabhi', 'everyone', 'everybody', 'sabka', 'sabko']);
const WITH = new Set(['with', 'saath']);
const ONLY = new Set(['only', 'sirf']);
const NOT = new Set(['not', 'except', 'bina', 'without']);
const JOIN = new Set(['and', 'aur', '&', '+', ',']);

const strip = w => lower(w).replace(/^[^\p{L}\p{N}+]+|[^\p{L}\p{N}+]+$/gu, '');
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * @returns {{
 *   rest: string,
 *   payer: null | {self:true} | {id:string},
 *   include: string[], includeSelf: boolean,   // "with ..." → added to the payer
 *   literal: string[]|null, literalSelf: boolean, // "me+ravi" / "only x" → exactly these
 *   exclude: string[], excludeSelf: boolean,
 *   all: boolean,
 *   questions: object[]
 * }}
 */
export function extractPeople(text, users) {
  const toks = text.split(/\s+/).filter(Boolean);
  const kept = [];
  const out = {
    payer: null, include: [], includeSelf: false,
    literal: null, literalSelf: false,
    exclude: [], excludeSelf: false, all: false, questions: [],
  };
  const userIds = (users || []).map(u => u.id);
  const unknown = name => out.questions.push({
    kind: 'unknownPerson', name: cap(name),
    message: `${cap(name)} isn't in this room · pick`, options: userIds,
  });
  const ambiguous = (name, cands, role) => out.questions.push({
    kind: 'pickPerson', name: cap(name), role,
    message: `Which ${cap(name)}?`, candidates: cands.map(c => c.id),
  });

  /** Resolve one word: 'self' | {id} | 'ambiguous' | 'unknown' | null (not a name at all). */
  const resolve = (w, role, askIfUnknown) => {
    if (isSelfWord(w)) return 'self';
    const m = matchMember(w, users);
    if (m.status === 'one') return { id: m.user.id };
    if (m.status === 'many') { ambiguous(w, m.candidates, role); return 'ambiguous'; }
    if (askIfUnknown) { unknown(w); return 'unknown'; }
    return null;
  };

  /** Read a list of names starting at toks[j]; returns the index after the list. */
  const readList = (j, role, sink) => {
    let n = 0;
    while (j < toks.length) {
      const w = strip(toks[j]);
      if (JOIN.has(w)) { j++; continue; }
      if (ALL.has(w)) { out.all = true; j++; n++; continue; }
      const r = resolve(w, role, n === 0);
      if (r === null) break;
      if (r === 'self') sink.self = true;
      else if (r !== 'ambiguous' && r !== 'unknown') sink.ids.push(r.id);
      j++; n++;
      if (r === 'unknown') break;
    }
    return j;
  };

  for (let i = 0; i < toks.length; i++) {
    const w = strip(toks[i]);
    const next = strip(toks[i + 1] || '');

    // "maine diya" / "i paid" / "me paid"
    if ((w === 'maine' && (next === 'diya' || next === 'paid' || next === 'di')) ||
        ((w === 'i' || w === 'me') && next === 'paid')) {
      out.payer = { self: true }; i++; continue;
    }
    // "paid by X"
    if (w === 'paid' && next === 'by') {
      const r = resolve(strip(toks[i + 2] || ''), 'payer', true);
      if (r === 'self') out.payer = { self: true };
      else if (r && r.id) out.payer = { id: r.id };
      i += 2; continue;
    }
    // "paid to X" → X is part of the split (or unknown)
    if (w === 'paid' && next === 'to') {
      const r = resolve(strip(toks[i + 2] || ''), 'with', true);
      if (r && r.id) out.include.push(r.id);
      i += 2; continue;
    }
    // "X paid" / "X ne diya"
    if ((w === 'paid') || (w === 'ne' && ['diya', 'di', 'paid', 'pay'].includes(next))) {
      const prev = kept.length ? strip(kept[kept.length - 1]) : '';
      if (prev && !/\d/.test(prev)) {
        const m = isSelfWord(prev) ? 'self' : matchMember(prev, users);
        if (m === 'self') { out.payer = { self: true }; kept.pop(); }
        else if (m.status === 'one') { out.payer = { id: m.user.id }; kept.pop(); }
        else if (m.status === 'many') { ambiguous(prev, m.candidates, 'payer'); kept.pop(); }
      }
      if (w === 'ne') i++;
      continue; // drop "paid" / "ne diya" either way
    }
    // with / saath <names>
    if (WITH.has(w)) {
      const sink = { ids: [], self: false };
      const j = readList(i + 1, 'with', sink);
      if (j > i + 1) { out.include.push(...sink.ids); out.includeSelf ||= sink.self; i = j - 1; continue; }
    }
    // only / sirf <names>
    if (ONLY.has(w)) {
      const sink = { ids: [], self: false };
      const j = readList(i + 1, 'only', sink);
      if (j > i + 1) {
        out.literal = [...(out.literal || []), ...sink.ids]; out.literalSelf ||= sink.self;
        i = j - 1; continue;
      }
    }
    // not / except / bina <name>
    if (NOT.has(w) && next) {
      const r = resolve(next, 'not', true);
      if (r === 'self') out.excludeSelf = true;
      else if (r && r.id) out.exclude.push(r.id);
      i++; continue;
    }
    // me+ravi / ravi+meera
    if (/[\p{L}]\s*\+\s*[\p{L}]/u.test(w) || (/^[\p{L}]+$/u.test(w) && JOIN.has(next) && next === '+')) {
      const parts = w.split('+').filter(Boolean);
      let j = i;
      // "me + ravi" typed with spaces
      if (parts.length === 1) {
        while (strip(toks[j + 1] || '') === '+' && toks[j + 2]) { parts.push(strip(toks[j + 2])); j += 2; }
      }
      const ids = []; let self = false; let ok = parts.length > 1;
      const saved = out.questions.length;
      for (const p of parts) {
        const r = resolve(p, 'with', true);
        if (r === 'self') self = true; else if (r && r.id) ids.push(r.id);
        else if (r === null) ok = false;
      }
      if (ok) {
        out.literal = [...(out.literal || []), ...ids]; out.literalSelf ||= self;
        i = j; continue;
      }
      out.questions.length = saved;
    }
    if (ALL.has(w)) { out.all = true; continue; }
    kept.push(toks[i]);
  }

  out.rest = kept.join(' ');
  return out;
}
