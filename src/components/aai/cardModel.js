/**
 * Intent (src/aai/parse.js) → what a non-expense answer card shows (board Bot-Functions, style A).
 * Expense intents are drawn by ExpenseCard from their draft instead.
 *
 * Returns { title, sub, value, actions: [{ label, kind, primary?, ... }], tone? } or null.
 * Balances and the settle plan only ever offer Remind (her decision 3 Oct: nothing is recorded).
 */
import { balanceAnswer, spendAnswer } from '../../aai/answers.js';
import { undoPlan, changeLastPlan, removePersonPlan, remindPlan, settlePlan } from '../../aai/commands.js';
import { fmtINR } from '../../aai/common.js';

const pct = p => (p == null ? null : `${p > 0 ? '+' : ''}${p}%`);
const day = s => (s ? new Date(`${s}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

const REASONS = {
  'nothing-to-undo': 'Nothing to undo yet',
  'nothing-to-change': 'Nothing to change yet',
  'is-bill': 'That was a bill — edit it in History',
  'bad-amount': 'Type the new amount, e.g. "change last to 500"',
  'no-description': 'Say which expense, e.g. "remove Ravi from dinner"',
  'expense-not-found': 'Couldn’t find that expense',
  'not-in-split': 'They’re not in that split',
  'would-be-empty': 'Nobody would be left in the split',
};
const nope = (title, reason) => ({ title, sub: REASONS[reason] || reason, value: '—', actions: [], tone: 'muted' });

export function commandCard(intent, c) {
  const { expenses, users, meId, categories, isPersonal, now, roomName, lastAai } = c;
  switch (intent.cmd) {
    case 'balance': {
      if (isPersonal) return { title: 'Personal room', sub: 'No one to settle with here', value: '₹0', actions: [] };
      if (!meId) return { title: 'Who are you?', sub: 'Pick your name on the Dashboard first', value: '—', actions: [], tone: 'muted' };
      const b = balanceAnswer(expenses, users, meId);
      if (b.settled) return { title: 'All settled', sub: 'Nobody owes anything', value: '₹0', actions: [] };
      const owe = [...b.iOwe].sort((x, y) => y.amount - x.amount)[0];
      const get = [...b.owedToMe].sort((x, y) => y.amount - x.amount)[0];
      const net = `net ${b.net >= 0 ? '+' : '−'}${fmtINR(Math.abs(b.net))}`;
      const actions = get ? [{ label: `Remind ${get.name}`, kind: 'remind', personId: get.id, primary: true }] : [];
      if (owe) return { title: `You owe ${owe.name}`, sub: [get && `${get.name} pays you ${fmtINR(get.amount)}`, net].filter(Boolean).join(' · '), value: fmtINR(owe.amount), actions };
      return { title: `${get.name} owes you`, sub: [b.owedToMe.length > 1 && `${b.owedToMe.length} people owe you`, net].filter(Boolean).join(' · '), value: fmtINR(get.amount), actions, tone: 'pos' };
    }
    case 'spend': {
      const s = spendAnswer({ expenses, categories, categoryId: intent.categoryId, period: intent.period, now, meId, isPersonal });
      const what = s.categoryName || 'All spend';
      if (s.period === 'biggest') {
        if (!s.biggest) return { title: `Biggest · ${s.month}`, sub: 'No expenses yet', value: '₹0', actions: [] };
        return { title: s.biggest.description, sub: `Biggest${s.categoryName ? ` ${s.categoryName}` : ''} in ${s.month} · ${day(s.biggest.date)}`, value: fmtINR(s.biggest.amount), actions: [] };
      }
      const vs = pct(s.pctVsPrev);
      const share = !isPersonal && meId ? `your share ${fmtINR(s.myShare)}` : null;
      return {
        title: s.period === 'compare' ? `${what} · ${s.month} vs ${s.prevMonth}` : `${what} · ${s.month}`,
        sub: [vs && `${vs} vs ${s.prevMonth}`, `${s.count} ${s.count === 1 ? 'expense' : 'expenses'}`, share].filter(Boolean).join(' · '),
        value: fmtINR(s.total),
        actions: [],
      };
    }
    case 'remind': {
      if (!intent.person?.id) return { title: 'Remind who?', sub: 'Type a name, e.g. "remind Ravi"', value: '—', actions: [], tone: 'muted' };
      const p = remindPlan(expenses, users, meId, intent.person.id, roomName);
      if (!p.ok) return { title: `${p.name || 'They'} owe${p.name ? 's' : ''} you nothing`, sub: 'Nothing to remind', value: '₹0', actions: [] };
      return { title: `Message for ${p.name}`, sub: 'Opens WhatsApp with the text ready', value: fmtINR(p.amount), actions: [{ label: 'Send', kind: 'whatsapp', text: p.text, primary: true }] };
    }
    case 'settle': {
      const p = settlePlan(expenses, users, meId, roomName);
      if (p.settled) return { title: 'All settled', sub: 'Nobody owes anything', value: '₹0', actions: [] };
      const name = id => (id === meId ? 'you' : null);
      const lines = p.plan.map(x => `${name(x.fromId) || x.from} → ${name(x.toId) || x.to} ${fmtINR(x.amount)}`);
      const rem = p.plan.filter(x => x.canRemind).map(x => ({ label: `Remind ${x.from}`, kind: 'whatsapp', text: x.text }));
      if (rem[0]) rem[0].primary = true;
      return { title: `${p.plan.length} ${p.plan.length === 1 ? 'payment settles' : 'payments settle'} all`, sub: lines.join(' · '), value: fmtINR(p.total), actions: rem };
    }
    case 'undo': {
      const p = undoPlan(expenses, lastAai, now);
      if (!p.ok) return nope('Undo', p.reason);
      return { title: 'Undo last', sub: `${p.summary}${p.source === 'room' ? ' · newest in the room' : ''}`, value: 'Delete', actions: [{ label: 'Confirm', kind: 'run', plan: p, primary: true }], tone: 'neg' };
    }
    case 'change': {
      const p = changeLastPlan(expenses, lastAai, now, intent.amount);
      if (!p.ok) return nope('Change last', p.reason);
      return { title: p.before.description, sub: `${p.source === 'room' ? 'Newest in the room · ' : ''}Undo any time`, value: `${fmtINR(p.before.amount)} → ${fmtINR(intent.amount)}`, actions: [{ label: 'Confirm', kind: 'run', plan: p, primary: true }] };
    }
    case 'remove': {
      if (!intent.person?.id) return { title: 'Remove who?', sub: intent.person?.name ? `No one called ${intent.person.name}` : 'Type a name', value: '—', actions: [], tone: 'muted' };
      const p = removePersonPlan(expenses, intent.person.id, intent.description, users);
      if (!p.ok) return nope('Remove', p.reason);
      return { title: p.expense.description, sub: p.summary, value: fmtINR(p.expense.amount), actions: [{ label: 'Confirm', kind: 'run', plan: p, primary: true }] };
    }
    default:
      return null;
  }
}
