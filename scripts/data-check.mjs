// Phase 4 data check (read-only): re-derives balances/totals from the anonymised backup with exact math and
// compares with the app's own calculators; also flags data shapes the UI might trip on.
import fs from 'node:fs';
import { calculateBalances, getTotalExpenses, getMonthlyTotals } from '../src/utils/splitCalculator.js';
import { calculateSettlements } from '../src/utils/settlementEngine.js';
const dec = v => v == null ? v : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue
  : 'booleanValue' in v ? v.booleanValue : 'nullValue' in v ? null : 'arrayValue' in v ? (v.arrayValue.values || []).map(dec)
  : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : v;
const file = process.argv[2];
const docs = JSON.parse(fs.readFileSync(file)).docs;
const rooms = {}, orphans = {};
for (const [p, d] of Object.entries(docs).sort((a, b) => a[0].split('/').length - b[0].split('/').length)) {
  const f = Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, dec(v)]));
  const m = p.split('/');
  if (m[0] !== 'rooms' || (m.length > 2 && m[2] !== 'expenses')) continue;
  if (m.length === 2) rooms[m[1]] = { ...f, expenses: [] };
  else if (!rooms[m[1]]) { orphans[m[1]] = (orphans[m[1]] || 0) + 1; }
  else rooms[m[1]].expenses.push({ id: m[3], ...f });
}
const issues = {};
const bad = (r, t) => (issues[`${r}: ${t}`] = (issues[`${r}: ${t}`] || 0) + 1);
for (const [code, room] of Object.entries(rooms)) {
  const users = room.users || [], ids = new Set(users.map(u => u.id)), cats = new Set((room.categories || []).map(c => c.id));
  const ex = room.expenses;
  const keys = new Set(ex.flatMap(e => Object.keys(e)));
  // exact balances in cents-free floats
  const exact = Object.fromEntries(users.map(u => [u.id, 0]));
  for (const e of ex) {
    const a = Number(e.amount), s = e.splitAmong || [];
    if (!(a > 0)) bad(code, 'amount<=0/NaN');
    if (!s.length) bad(code, 'empty splitAmong');
    if (!ids.has(e.paidBy)) bad(code, 'paidBy not in users');
    if (s.some(x => !ids.has(x))) bad(code, 'splitAmong has unknown user');
    if (!/^\d{4}-\d{2}-\d{2}/.test(e.date || '')) bad(code, 'odd date');
    if (e.categoryId && !cats.has(e.categoryId)) bad(code, 'category not in room list');
    if (!(a > 0) || !s.length) continue;
    if (ids.has(e.paidBy)) exact[e.paidBy] += a;
    for (const x of s) if (ids.has(x)) exact[x] -= a / s.length;
  }
  const bal = calculateBalances(ex, users);
  let maxDiff = 0, sum = 0;
  for (const u of users) { maxDiff = Math.max(maxDiff, Math.abs(bal[u.id].balance - exact[u.id])); sum += bal[u.id].balance; }
  const st = users.length > 1 ? calculateSettlements(bal) : [];
  const net = Object.fromEntries(users.map(u => [u.id, 0]));
  for (const s of st) { net[s.from.id] -= s.amount; net[s.to.id] += s.amount; }
  const settleOK = users.every(u => Math.abs(net[u.id] - bal[u.id].balance) < 0.5 || users.length < 2);
  const tot = getTotalExpenses(ex), mt = getMonthlyTotals(ex);
  const mSum = Object.values(mt).reduce((a, b) => a + (typeof b === 'object' ? (b.total ?? 0) : b), 0);
  console.log(`${code} ${room.name} · ${users.length} users · ${ex.length} exp · fields[${[...keys].join(',')}] · total ₹${Math.round(tot)} · balΣ=${sum} · maxΔ vs exact=${maxDiff.toFixed(2)} · settlements=${st.length} ${settleOK ? 'OK' : 'MISMATCH'} · budget=${room.budget ?? room.monthlyBudget ?? '-'}`);
}
console.log('\nexpenses under a missing room doc:', orphans);
console.log('ISSUES:', Object.keys(issues).length ? issues : 'none');
