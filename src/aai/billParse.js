/**
 * Bill screenshots — the pure half (no React, no network; tested with node --test).
 * billRead.js sends the screenshots to Gemini with BILL_SCHEMA + billPrompt(); what comes back goes through
 * normaliseRead() → plain data. AAI never trusts the model's maths: sums, taxes line and mismatch are worked out here.
 *
 * Plain data: { isBill, shop, date, items:[{ name, qty, amount|null, category, conf }], charges:[{ label, kind, amount }],
 *               total|null, conf:{ shop, date, total }, unclear:[index…] }
 */
import { guessCategory, findMatchingCategory } from '../utils/categoryGuess.js';
import { toDateStr, fromDateStr, addDays, fmtINR, MONTH_NAMES, cleanName } from './common.js';

export const SURE = 0.7;                 // below this a field gets the dotted "not sure" underline
export const UNCLEAR_BELOW = 0.5;        // an item line below this counts as unreadable (UNCLEAR reply)

const CHARGE_KINDS = ['tax', 'delivery', 'handling', 'platform', 'packaging', 'service', 'tip', 'discount', 'roundoff', 'other'];

/** responseJsonSchema for Firebase AI Logic (plain JSON Schema). */
export const BILL_SCHEMA = {
  type: 'object',
  properties: {
    isBill: { type: 'boolean' },
    shop: { type: 'string' },
    shopConfidence: { type: 'number' },
    date: { type: 'string', description: 'YYYY-MM-DD, or empty if not shown' },
    dateConfidence: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'string' },
          amount: { type: ['number', 'null'] },
          category: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['name', 'qty', 'amount', 'category', 'confidence'],
      },
    },
    charges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          kind: { type: 'string', enum: CHARGE_KINDS },
          amount: { type: 'number' },
        },
        required: ['label', 'kind', 'amount'],
      },
    },
    total: { type: ['number', 'null'] },
    totalConfidence: { type: 'number' },
  },
  required: ['isBill', 'shop', 'shopConfidence', 'date', 'dateConfidence', 'items', 'charges', 'total', 'totalConfidence'],
};

export function billPrompt({ categories = [], today, count = 1 }) {
  const cats = categories.map(c => c.name).join(', ') || 'Other';
  return [
    `You read Indian shopping / food-delivery / restaurant bills from ${count > 1 ? `${count} screenshots of ONE bill (they may overlap — merge them, never list a line twice)` : 'a screenshot'}.`,
    `Today is ${today}. Reply only with JSON in the given schema.`,
    'Rules:',
    '- isBill: false if this is not a bill/receipt/order summary (a chat, a photo, a payment-only screen with no items).',
    '- shop: the store or app name as printed (e.g. Blinkit, Zepto, Swiggy, DMart, a restaurant name). Empty if not shown.',
    '- date: the order/bill date as YYYY-MM-DD. If the year is missing use the most recent past date. Empty if not shown.',
    '- items: every purchased line, top to bottom. name = product name as printed, shortened to the useful words (no SKU codes).',
    '  qty = quantity/size as printed ("1 kg", "×2", "500 ml"); "" if none. amount = the rupees actually charged for that line',
    '  (after any per-item discount; quantity × price if only the unit price is printed). Never use the struck-out MRP.',
    '  If a line\'s amount can\'t be read, keep the line with amount null and a low confidence.',
    `  category = the best match from this exact list: ${cats}.`,
    '- charges: everything between the items and the grand total that is NOT a subtotal/item total: GST, CGST, SGST, cess, service',
    '  charge, delivery fee, handling fee, platform fee, small-cart / packaging fee, tip, donation, round off, and discounts/coupons/',
    '  savings that reduce the payable amount (discount amounts as NEGATIVE numbers). Skip any line that is struck out or says FREE / ₹0.',
    '- total: the final amount paid ("Grand total", "To pay", "Bill total", "Total paid"). null if not shown.',
    '- confidence numbers are 0–1: how sure you are the value is read correctly. Blurry, cut off or guessed = below 0.5.',
    '- Amounts are plain numbers in rupees (no ₹, no commas).',
  ].join('\n');
}

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(+v.replace(/[,₹\s]/g, '')) ? +v.replace(/[,₹\s]/g, '') : null);
const r2 = n => Math.round(n * 100) / 100;
const conf = v => { const n = num(v); return n == null ? 1 : Math.max(0, Math.min(1, n > 1 ? n / 100 : n)); };
const clean = s => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

/** Model JSON (object or string) → plain data. Throws { code: 'PARSE' } when it isn't JSON at all. */
export function normaliseRead(raw, { now = new Date() } = {}) {
  let j = raw;
  if (typeof raw === 'string') {
    try { j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { const e = new Error('Reply was not JSON'); e.code = 'PARSE'; throw e; }
  }
  if (!j || typeof j !== 'object') { const e = new Error('Empty reply'); e.code = 'PARSE'; throw e; }

  const items = (Array.isArray(j.items) ? j.items : [])
    .map(i => {
      const a = num(i?.amount);
      return { name: clean(i?.name), qty: clean(i?.qty).replace(/^(?:x|×)?\s*1$/i, ''), amount: a == null ? null : r2(Math.abs(a)), category: clean(i?.category), conf: conf(i?.confidence) };
    })
    .filter(i => i.name || i.amount != null || i.conf < UNCLEAR_BELOW);       // an unreadable line stays (it becomes a "failed" row)

  const charges = (Array.isArray(j.charges) ? j.charges : [])
    .map(c => {
      const kind = CHARGE_KINDS.includes(c?.kind) ? c.kind : 'other';
      let a = num(c?.amount);
      if (a == null || Math.abs(a) < 0.005) return null;
      if (kind === 'discount') a = -Math.abs(a);
      else if (kind !== 'roundoff') a = Math.abs(a);
      return { label: clean(c?.label) || kind, kind, amount: r2(a) };
    })
    .filter(Boolean)
    .filter(c => !/^(sub ?total|item ?total|items? total|total)$/i.test(c.label));

  // date: real, not in the future, not silly old
  let date = null;
  if (typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date.trim())) {
    const d = fromDateStr(j.date.trim());
    if (!Number.isNaN(d.getTime()) && d <= addDays(now, 1) && d >= addDays(now, -400)) date = toDateStr(d);
  }
  const total = num(j.total);
  const read = {
    isBill: j.isBill !== false,
    shop: clean(j.shop),
    date,
    items,
    charges,
    total: total == null || total <= 0 ? null : r2(total),
    conf: { shop: clean(j.shop) ? conf(j.shopConfidence) : 0, date: date ? conf(j.dateConfidence) : 0, total: total == null ? 0 : conf(j.totalConfidence) },
  };
  read.unclear = read.items.map((i, k) => (i.amount == null || i.conf < UNCLEAR_BELOW ? k : -1)).filter(k => k >= 0);
  if (!read.items.length && read.total == null) read.isBill = false;
  return read;
}

/** Sums the phone works out itself. */
export function readSums(read) {
  const items = r2(read.items.reduce((s, i) => s + (i.amount || 0), 0));
  const charges = r2(read.charges.reduce((s, c) => s + c.amount, 0));
  const total = read.total ?? r2(items + charges);
  return { items, charges, total, left: r2(total - items - charges) };
}

/** "GST ₹18 · DELIVERY ₹25 · HANDLING ₹15" — the mono line under "Taxes & charges". */
export function chargesDetail(charges) {
  const LAB = { tax: 'GST', delivery: 'DELIVERY', handling: 'HANDLING', platform: 'PLATFORM', packaging: 'PACKING', service: 'SERVICE', tip: 'TIP', discount: 'DISCOUNT', roundoff: 'ROUND OFF' };
  const merged = [];
  for (const c of charges) {
    const k = c.kind === 'other' ? c.label.toUpperCase().slice(0, 14) : LAB[c.kind];
    const hit = merged.find(m => m.k === k);
    if (hit) hit.a = r2(hit.a + c.amount); else merged.push({ k, a: c.amount });
  }
  return merged.map(m => `${m.k} ${m.a < 0 ? '−' : ''}${fmtINR(Math.abs(m.a))}`).join(' · ');
}

/** Room category for a read item: the model's pick if it's one of ours, else the keyword/learned guess, else null. */
export function categoryFor(item, { categories, learned }) {
  const exact = item.category && categories.find(c => c.name.toLowerCase() === item.category.toLowerCase());
  if (exact) return { id: exact.id, sure: true };
  const g = guessCategory(item.name, learned, categories);
  if (g) return { id: g, sure: true };
  const near = item.category && findMatchingCategory(item.category, categories);
  return near ? { id: near.id, sure: false } : { id: null, sure: false };
}

/**
 * Plain read + the chat's answers → a bill card (the same shape the typed bill card uses, plus source 'bill').
 * answers = { paidBy, splits: { [itemIndex]: [ids] }, names: { [itemIndex]: 'renamed' }, shop }
 * - unreadable lines (no amount) become "failed" rows (₹—, TAP TO TYPE NAME + AMOUNT)
 * - charges become one "Taxes & charges" row split with everyone; a net discount is spread over the items instead
 */
export function billFromRead(read, ctx, answers = {}) {
  const { users, me, isPersonal, categories, learned, today, uid } = ctx;
  const allIds = isPersonal ? [me || users[0]?.id] : users.map(u => u.id);
  const charges = r2(read.charges.reduce((s, c) => s + c.amount, 0));

  let items = read.items.map((it, k) => {
    const cat = categoryFor(it, { categories, learned });
    const failed = it.amount == null;
    return {
      id: uid(), idx: k, name: (answers.names?.[k] ?? it.name) || '', qty: it.qty, amount: failed ? 0 : it.amount,
      categoryId: cat.id, splitAmong: isPersonal ? allIds : (answers.splits?.[k] || allIds),
      unsure: !cat.sure || it.conf < SURE, failed,
    };
  });

  // a net discount (coupon bigger than the fees): spread it over the item amounts so every saved line stays positive
  if (charges < -0.004) {
    const base = items.reduce((s, i) => s + i.amount, 0);
    if (base > 0) {
      let left = -charges;
      const live = items.filter(i => i.amount > 0);
      live.forEach((i, n) => {
        const cut = n === live.length - 1 ? r2(left) : r2((-charges * i.amount) / base);
        left = r2(left - cut);
        i.amount = r2(i.amount - cut);
      });
    }
  }
  const cats = items.map(i => i.categoryId).filter(Boolean);
  const topCat = cats.sort((a, b) => cats.filter(x => x === b).length - cats.filter(x => x === a).length)[0] || null;
  if (charges > 0.004) {
    items.push({
      id: uid(), name: 'Taxes & charges', charges: true, detail: chargesDetail(read.charges), amount: charges,
      categoryId: topCat, splitAmong: allIds, unsure: false,
    });
  } else if (charges < -0.004) {
    items = items.map(i => (i.amount > 0 ? { ...i, discounted: true } : i));
  }

  const sums = readSums(read);
  const shop = answers.shop ?? read.shop;
  const bill = {
    name: shop || 'Untitled bill', nameUnsure: !shop || read.conf.shop < SURE, date: read.date || answers.date || today,
    dateUnsure: !read.date || read.conf.date < SURE, paidBy: isPersonal ? allIds[0] : (answers.paidBy || null),
    total: sums.total, totalTyped: true, totalUnsure: read.total == null || read.conf.total < SURE, source: 'bill', items,
  };
  const dots = [];
  if (bill.nameUnsure) dots.push('name');
  if (bill.dateUnsure) dots.push('date');
  if (!bill.paidBy && !isPersonal) dots.push('paidBy');
  return { bill, dots };
}

/** Mismatch for a screenshot bill: anything not adding up (either way) blocks Save. */
export function billMismatch(bill) {
  const sum = r2(bill.items.reduce((s, i) => s + (i.amount || 0), 0));
  const diff = r2(bill.total - sum);
  const failed = bill.items.map((i, n) => (i.failed && !(i.amount > 0) ? n + 1 : 0)).filter(Boolean);
  return { sum, diff, off: Math.abs(diff) > 0.004, failed };
}

// ── chat copy for the reading flow ──
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

export function readingSteps(read, seed = Date.now()) {
  const s = readSums(read);
  const steps = [{ text: pick(['reading screenshot… whoever picked this font owes me ₹10.', 'reading screenshot… squinting.', 'reading screenshot… zooming in like a detective.'], seed) }];
  const n = read.items.length;
  const chips = read.items.filter(i => /chips|lays|kurkure|bingo|doritos|pringles|namkeen|bhujia/i.test(i.name)).length;
  steps.push({ text: `found ${n} item${n === 1 ? '' : 's'}… ${chips > 1 ? `${chips} of them are chips.` : n > 12 ? 'someone did a full month\'s shopping.' : 'nothing suspicious. Yet.'}`, bold: `${n} item${n === 1 ? '' : 's'}` });
  if (read.charges.some(c => c.kind === 'tax')) steps.push({ text: 'spotted GST… the government also ate.' });
  if (read.unclear.length) steps.push({ text: `line ${read.unclear[0] + 1} is a blur. Bold of you.` });
  else if (Math.abs(s.left) > 0.004) steps.push({ text: `checking total… items ${fmtINR(s.items + s.charges)}, bill ${fmtINR(s.total)}. Kisi ne chupke se khaya.` });
  else steps.push({ text: `checking total… ${fmtINR(s.total)}. Adds up, surprisingly.` });
  return steps.slice(0, 4);
}

export const shortDate = d => { const x = fromDateStr(d); return `${x.getDate()} ${MONTH_NAMES[x.getMonth()]}`; };

/** "You + Ravi" / "All 3" / "Only you" for a split answer. */
export function splitLabel(ids, users, me) {
  if (ids.length === users.length) return `All ${users.length}`;
  const names = users.filter(u => ids.includes(u.id)).sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0)).map(u => (u.id === me ? 'You' : cleanName(u.name)));
  return names.join(' + ');
}

/** Which error reply an exception from billRead means. → { type, details, retryIn? } */
export function classifyReadError(e, online = true) {
  if (e?.code === 'SLOW_ABORT') return { type: 'down', details: 'TIMEOUT · 60S' };
  if (e?.code === 'PARSE') return { type: 'notbill', details: 'PARSE · NOT JSON' };
  if (e?.code === 'NOT_SET_UP') return { type: 'down', details: 'SETUP · NOT READY' };
  const status = e?.customErrorData?.status ?? e?.status;
  const text = `${e?.message || ''} ${JSON.stringify(e?.customErrorData?.errorDetails || '')}`;
  if (!online || e?.code === 'NET' || (e?.code === 'AI/fetch-error' && !status) || e?.name === 'TypeError') return { type: 'offline', details: 'NET · OFFLINE' };
  if (status === 429) {
    if (/PerDay|per day|daily/i.test(text)) return { type: 'limit', details: '429 · QUOTA' };
    const m = text.match(/retry in ([\d.]+)s|"retryDelay":"(\d+)s"/i);
    const secs = m ? Math.ceil(+(m[1] || m[2])) : 10;
    return { type: 'wait', details: `429 · RATE · RETRY IN ${secs}S`, retryIn: secs };
  }
  // 5xx, App Check refusals (401/403, appCheck/…) and anything else → DOWN (people never see "security")
  return { type: 'down', details: status ? `${status} · UNAVAILABLE` : 'SERVICE · UNAVAILABLE' };
}
