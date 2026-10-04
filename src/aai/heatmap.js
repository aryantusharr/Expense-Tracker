/**
 * AAI heatmap — "who opened the app", per member per day. Pure (no React).
 * opens = { [memberId]: { 'YYYY-MM-DD': count } }. Part 2 fills it from Firestore; until then it is empty.
 */
import { toDateStr, addDays, fromDateStr, cleanName } from './common.js';

/** 5 week-columns (Sun→Sat, like the boards' S M T W T F S, oldest first) ending with the current week. Days after today are null. */
export function weekGrid(now, weeks = 5) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sunday = addDays(today, -today.getDay());
  const cols = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(sunday, -7 * w + d);
      col.push(day > today ? null : toDateStr(day));
    }
    cols.push(col);
  }
  return cols;
}

/** The last `n` days, oldest first (the focused strip). */
export function stripDays(now, n = 14) {
  return Array.from({ length: n }, (_, i) => toDateStr(addDays(now, -(n - 1 - i))));
}

/** Cell strength: 0 empty · 1 opened · 2 a few · 3 many · 4 loads. */
export const tier = c => (c >= 7 ? 4 : c >= 4 ? 3 : c >= 2 ? 2 : c >= 1 ? 1 : 0);

/** Per member: days opened in the last 31, today's opens, current + best streak, days since the last open. */
export function memberStats(opens = {}, now) {
  const today = toDateStr(now);
  const stats = {};
  for (const [id, days] of Object.entries(opens)) {
    let opened = 0;
    for (let i = 0; i < 31; i++) if (days[toDateStr(addDays(now, -i))] > 0) opened++;
    // current streak: today counts if opened, otherwise start from yesterday
    let streak = 0;
    let i = days[today] > 0 ? 0 : 1;
    while (days[toDateStr(addDays(now, -i))] > 0) { streak++; i++; }
    // best streak over everything recorded
    const keys = Object.keys(days).filter(k => days[k] > 0).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      run = prev && Math.round((fromDateStr(k) - fromDateStr(prev)) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    }
    const last = keys[keys.length - 1];
    stats[id] = {
      opened, today: days[today] || 0, streak, best,
      gone: last ? Math.round((fromDateStr(today) - fromDateStr(last)) / 86400000) : null,
      total: keys.length,
    };
  }
  return stats;
}

const LINES = {
  fresh: () => 'Fresh room. Zero streaks. Very peaceful. Won\'t last.',
  streak: (n, d) => `${n}'s opened the app ${d} days straight. Very organised. Or very bored.`,
  gone: (n, d) => `${n}'s been gone ${d} days. Probably living off Maggi and vibes.`,
  flattered: n => `You opened it ${n} times today. The app is flattered.`,
  nobody: () => 'Nobody opened yesterday. The expenses didn\'t stop though.',
  past: (d, b) => `${d} days straight. Past you did ${b}. Just saying.`,
  tied: (a, n, o) => `You and ${a}, tied at ${n}. ${o} is not in this race.`,
  empty: o => `Today's still empty for you. ${o}'s already judging.`,
};

/**
 * One sarcastic line from the real numbers (first rule that fits wins, so it stays honest).
 * members = [{ id, name }]. Returns a string.
 */
export function heatLine({ stats, opens = {}, members, meId, now, personal = false }) {
  const anyData = Object.values(stats).some(s => s.total > 0);
  if (!anyData) return LINES.fresh();
  const me = stats[meId];
  const others = members.filter(m => m.id !== meId && stats[m.id]);
  const nm = m => cleanName(m.name);

  if (personal) {
    if (me && me.today >= 3) return LINES.flattered(me.today);
    if (me && me.streak >= 2 && me.best > me.streak) return LINES.past(me.streak, me.best);
    if (me && me.today === 0) return 'Today\'s still empty for you. The app is waiting. Patiently. Mostly.';
    return LINES.flattered(me?.today || 1);
  }

  const streaker = others.filter(m => stats[m.id].streak >= 5).sort((a, b) => stats[b.id].streak - stats[a.id].streak)[0];
  if (streaker) return LINES.streak(nm(streaker), stats[streaker.id].streak);
  const ghost = others.filter(m => (stats[m.id].gone ?? 0) >= 3).sort((a, b) => stats[b.id].gone - stats[a.id].gone)[0];
  if (ghost) return LINES.gone(nm(ghost), stats[ghost.id].gone);
  if (me && me.today >= 3) return LINES.flattered(me.today);
  if (me && me.streak >= 2 && me.best > me.streak) return LINES.past(me.streak, me.best);
  const tie = others.find(m => me && stats[m.id].opened === me.opened && me.opened > 0);
  if (tie) {
    const out = others.filter(m => m.id !== tie.id).map(nm)[0];
    if (out) return LINES.tied(nm(tie), me.opened, out);
  }
  if (me && me.today === 0 && others.some(m => stats[m.id].today > 0)) return LINES.empty(nm(others.find(m => stats[m.id].today > 0)));
  const yest = toDateStr(addDays(now, -1));
  if (!Object.values(opens).some(d => d[yest] > 0)) return LINES.nobody();
  return LINES.empty(others[0] ? nm(others[0]) : 'Everyone');
}
