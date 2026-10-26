// Pure search logic for History: what matches, grouped by month → day, and the wording of the result strip.
// Kept free of app imports (explicit .js paths) so Node's test runner can load it.
import { MONTHS_FULL, MONTHS_SHORT } from '../dashboard/dashboardData.js';

const pad2 = n => String(n).padStart(2, '0');
const amountOf = e => parseFloat(e.amount) || 0;

/** Every way a date can be typed: '2026-10-09', '9 oct 2026', '09 october 2026', plus 'today' / 'yesterday'. */
export function dateWords(dateStr, todayStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return [];
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const short = MONTHS_SHORT[mo - 1].toLowerCase();
  const full = MONTHS_FULL[mo - 1].toLowerCase();
  const out = [`${y}-${pad2(mo)}-${pad2(d)}`];
  for (const name of [short, full]) out.push(`${d} ${name} ${y}`, `${pad2(d)} ${name} ${y}`);
  if (todayStr) {
    if (dateStr.slice(0, 10) === todayStr) out.push('today');
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const yest = new Date(ty, tm - 1, td - 1);
    if (dateStr.slice(0, 10) === `${yest.getFullYear()}-${pad2(yest.getMonth() + 1)}-${pad2(yest.getDate())}`) out.push('yesterday');
  }
  return out;
}

/** A function e → boolean: does this expense match the typed text and/or the applied chip (payer or category)? */
export function makeMatcher({ filter, ql, categories, users, today }) {
  const needle = (ql || '').replace(/[₹,]/g, '');
  return e => {
    if (filter && (filter.kind === 'payer' ? e.paidBy !== filter.id : e.categoryId !== filter.id)) return false;
    if (!ql) return true;
    const cat = categories.find(c => c.id === e.categoryId);
    const payer = users.find(u => u.id === e.paidBy);
    const hay = `${e.description || ''} ${e.groupName || ''} ${cat?.name || ''} ${payer?.name || ''} ${e.amount}`.toLowerCase();
    if (hay.includes(needle)) return true;
    return dateWords(e.date, today).some(w => ` ${w}`.includes(` ${ql}`));
  };
}

const matchEntry = (en, matches) => (en.kind === 'bill' ? en.items.some(matches) : matches(en.e));

/** All matches across every month: groups newest first, each with its days and entry counts. */
export function collectMatches(months, matches) {
  const groups = [];
  let total = 0;
  for (const m of months) {
    const days = m.days
      .map(d => { const entries = d.entries.filter(en => matchEntry(en, matches)); return { key: d.key, label: d.label, count: entries.length, entries }; })
      .filter(d => d.count > 0);
    const count = days.reduce((s, d) => s + d.count, 0);
    if (!count) continue;
    const [label, year] = (m.short || '').split(' ');
    groups.push({ key: m.key, name: m.name, label, year, count, days });
    total += count;
  }
  return { groups, total };
}

/** For a bill where only some items match: a copy with just those items (the original is kept for edit and delete). */
export function displayBill(en, matches) {
  if (en.kind !== 'bill') return en;
  const items = en.items.filter(matches);
  if (!items.length || items.length === en.items.length) return en;
  return { ...en, items, total: items.reduce((s, i) => s + amountOf(i), 0), partial: `${items.length} of ${en.items.length} items match` };
}

/** Which month chip and date are showing. Defaults to the newest month that has matches. */
export function resolvePick(groups, pick) {
  if (!groups.length) return { month: null, dateKey: null };
  if (pick?.month === 'all') return { month: 'all', dateKey: null };
  const g = groups.find(x => x.key === pick?.month) || groups[0];
  const dateKey = g.days.some(d => d.key === pick?.date) ? pick.date : null;
  return { month: g.key, dateKey };
}

/** The day sections to list for the current pick (in 'all', labels carry the year). */
export function visibleDays(groups, { month, dateKey }) {
  if (month === 'all') return groups.flatMap(g => g.days.map(d => ({ ...d, key: `${g.key}-${d.key}`, title: `${d.label} ${g.year}` })));
  const g = groups.find(x => x.key === month);
  if (!g) return [];
  return g.days.filter(d => !dateKey || d.key === dateKey).map(d => ({ ...d, key: `${g.key}-${d.key}`, title: d.label }));
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The two lines of the result strip. No money totals: a search is about finding, not adding up. */
export function stripText(groups, total, { month, dateKey }) {
  if (!total) return { primary: 'NO MATCHES', secondary: '' };
  if (month === 'all') return { primary: `${plural(total, 'MATCH', 'MATCHES')} · ${plural(groups.length, 'MONTH', 'MONTHS')}`, secondary: 'ALL MONTHS SEARCHED' };
  const g = groups.find(x => x.key === month);
  if (!g) return { primary: 'NO MATCHES', secondary: '' };
  if (dateKey) {
    const d = g.days.find(x => x.key === dateKey);
    return { primary: `${plural(d.count, 'MATCH', 'MATCHES')} ON ${d.label}`, secondary: `${g.count} IN ${g.label} · ${total} IN ALL MONTHS` };
  }
  return { primary: `${plural(g.count, 'MATCH', 'MATCHES')} IN ${g.label}`, secondary: `${total} IN ALL MONTHS` };
}
