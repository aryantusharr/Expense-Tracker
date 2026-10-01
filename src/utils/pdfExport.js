import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateBalances } from './splitCalculator';
import { calculateSettlements } from './settlementEngine';
import { memberStyle, monthWindow } from '../components/dashboard/dashboardData';

// "Magazine" report (board E1e): A4 landscape on white paper — a cover with one huge number,
// then expenses per month, then a category × month matrix. Sora / JetBrains Mono / Unbounded /
// a serif italic are embedded (subset TTFs in /public/fonts/pdf) so ₹ prints as ₹.
// If the fonts can't be fetched (offline first run) it falls back to Helvetica and "Rs.".

const INK = [21, 20, 43];
const VIOLET = [107, 91, 255];
const TEAL = [10, 133, 119];
const PINK = [210, 59, 114];
const MUTED = [111, 110, 136];
const PAPER = [251, 250, 255];
const ZEBRA = [246, 245, 252];
const RULE = [228, 226, 242];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PT = 0.3528; // 1pt in mm

const FONT_FILES = [
  ['Sora-400.ttf', 'Sora', 'normal'], ['Sora-700.ttf', 'Sora', 'bold'],
  ['Mono-500.ttf', 'Mono', 'normal'], ['Mono-700.ttf', 'Mono', 'bold'],
  ['Unbounded-800.ttf', 'Unbounded', 'normal'], ['Unbounded-700.ttf', 'Unbounded', 'bold'],
  ['SerifItalic-400.ttf', 'Serif', 'italic'],
];
let fontData = null; // cached { file: binaryString }

async function fetchFonts() {
  if (fontData) return fontData;
  const base = `${import.meta.env.BASE_URL || '/'}fonts/pdf/`;
  const out = {};
  await Promise.all(FONT_FILES.map(async ([file]) => {
    const res = await fetch(base + file);
    if (!res.ok) throw new Error(`font ${file}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    out[file] = bin;
  }));
  fontData = out;
  return out;
}

const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// Characters the subset fonts can draw; anything else becomes "?" instead of a blank box.
const SAFE = new Set([8211,8212,8216,8217,8220,8221,8226,8230,183,8594,8722,8377,9650,9660]); // en/em dash, quotes, bullet, ellipsis, middle dot, arrow, minus, rupee, triangles
const clean = s => Array.from(String(s ?? ''), ch => { const c = ch.codePointAt(0); return (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || SAFE.has(c) ? ch : '?'; }).join('');
const num = n => Math.round(Math.abs(n || 0)).toLocaleString('en-IN');

export async function generateExpenseReport({ expenses, users, roomName, categories, month = null, isPersonal = false, budget = 0 }) {
  let fonts = true;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  try {
    const data = await fetchFonts();
    FONT_FILES.forEach(([file, family, style]) => { doc.addFileToVFS(file, data[file]); doc.addFont(file, family, style); });
  } catch { fonts = false; }
  const F = (family, style = 'normal') => {
    if (fonts) doc.setFont(family === 'Display' ? 'Unbounded' : family, style);
    else doc.setFont('helvetica', style === 'italic' ? 'italic' : style);
  };
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const text = (t, x, y, opt) => doc.text(clean(t), x, y, opt);

  /** ₹ + number, ₹ always in Unbounded so it exists in every font; returns drawn width (mm). */
  const money = (n, x, y, { size = 9, family = 'Sora', style = 'normal', align = 'left', color = INK, sign = '' } = {}) => {
    const body = (sign ? sign : '') + num(n);
    const sym = fonts ? '₹' : 'Rs.';
    doc.setFontSize(size);
    F('Unbounded', 'bold'); const symW = doc.getTextWidth(sym) + size * PT * 0.12;
    F(family, style); const bodyW = doc.getTextWidth(body);
    const total = symW + bodyW;
    const x0 = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    doc.setTextColor(...color);
    F('Unbounded', 'bold'); doc.text(sym, x0, y);
    F(family, style); doc.text(body, x0 + symW, y);
    return total;
  };

  // ---- data ----
  const userName = Object.fromEntries(users.map(u => [u.id, u.name]));
  const catName = Object.fromEntries((categories || []).map(c => [c.id, c.name]));
  const amt = e => parseFloat(e.amount) || 0;
  const inM = (e, m) => { const d = new Date(e.date); return d.getMonth() === m.month && d.getFullYear() === m.year; };
  const scoped = (month ? expenses.filter(e => inM(e, month)) : [...expenses]).sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = scoped.reduce((s, e) => s + amt(e), 0);
  const allBalances = calculateBalances(expenses, users);
  const settlements = isPersonal ? [] : calculateSettlements(allBalances);
  const endDate = month ? new Date(month.year, month.month, 1) : (scoped[0] ? new Date(scoped[0].date) : new Date());
  const win = monthWindow(expenses, endDate).months; // up to 6 months ending at the scope month
  const lifetime = expenses.reduce((s, e) => s + amt(e), 0);
  const firstMonth = win[0]?.short;
  const scopeLabel = month ? `${MONTHS[month.month]} ${month.year}` : 'ALL TIME';
  const byCat = {};
  scoped.forEach(e => { const n = catName[e.categoryId] || 'Other'; byCat[n] = (byCat[n] || 0) + amt(e); });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  // ---- COVER ----
  doc.setFillColor(...PAPER); doc.rect(0, 0, W, H, 'F');
  try {
    doc.setGState(doc.GState({ opacity: 0.2 })); doc.setFillColor(139, 124, 255); doc.circle(W * 0.82, 30, 62, 'F');
    doc.setGState(doc.GState({ opacity: 0.18 })); doc.setFillColor(95, 212, 196); doc.circle(20, H + 5, 58, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
  } catch { /* soft glows are decoration only */ }

  const brand = (x, y, size) => {
    doc.setFontSize(size); F('Unbounded', 'normal');
    doc.setTextColor(...INK); text('Split', x, y);
    const w = doc.getTextWidth('Split'); doc.setTextColor(...VIOLET); text('Ease', x + w, y);
  };
  brand(16, 20, 15);
  doc.setFontSize(7); F('Mono'); doc.setTextColor(...INK);
  text(`${month ? 'MONTHLY' : 'FULL'} REPORT · ${scopeLabel.toUpperCase()}`, W - 16, 20, { align: 'right', charSpace: 0.4 });

  doc.setFontSize(22); F('Serif', 'italic'); doc.setTextColor(...INK);
  text(`${roomName} spent`, 16, 64);
  let heroSize = 70;
  const heroStr = `${fonts ? '₹' : 'Rs.'}${num(total)}`;
  F('Unbounded', 'normal');
  doc.setFontSize(heroSize);
  while (doc.getTextWidth(heroStr) > 160 && heroSize > 30) { heroSize -= 4; doc.setFontSize(heroSize); }
  doc.setTextColor(...INK); text(heroStr, 16, 64 + heroSize * PT + 8);

  // line under the number
  const prev = win[win.length - 2];
  let sub = `${scoped.length} ${scoped.length === 1 ? 'expense' : 'expenses'}.`;
  if (month && prev && prev.total > 0) {
    const pct = ((total - prev.total) / prev.total) * 100;
    sub = `— ${Math.abs(pct).toFixed(1)}% ${pct <= 0 ? 'less' : 'more'} than ${prev.full[0] + prev.full.slice(1).toLowerCase()}.`;
  } else if (!month) {
    sub = `— across ${win.length} ${win.length === 1 ? 'month' : 'months'}, ${scoped.length} expenses.`;
  }
  doc.setFontSize(15); F('Serif', 'italic'); doc.setTextColor(...MUTED);
  text(sub, 16, 64 + heroSize * PT + 20);

  // members (or budget)
  const baseY = H - 40;
  if (isPersonal) {
    const spent = month ? total : (win[win.length - 1]?.total || 0);
    doc.setFontSize(6.5); F('Mono'); doc.setTextColor(...MUTED);
    text(budget > 0 ? 'SPENT THIS MONTH VS BUDGET' : 'SPENT THIS MONTH', 16, baseY - 6, { charSpace: 0.4 });
    if (budget > 0) {
      doc.setFillColor(...RULE); doc.roundedRect(16, baseY, 120, 4, 2, 2, 'F');
      doc.setFillColor(...(spent > budget ? PINK : VIOLET)); doc.roundedRect(16, baseY, Math.max(4, 120 * Math.min(1, spent / budget)), 4, 2, 2, 'F');
      money(spent, 16, baseY + 12, { size: 10, family: 'Mono', style: 'bold' });
      money(budget, 136, baseY + 12, { size: 10, family: 'Mono', style: 'bold', align: 'right', color: MUTED });
    } else money(spent, 16, baseY + 8, { size: 12, family: 'Mono', style: 'bold' });
  } else {
    users.slice(0, 6).forEach((u, i) => {
      const x = 16 + i * 40;
      doc.setFillColor(...hex(memberStyle(i).color)); doc.circle(x + 5, baseY, 5, 'F');
      doc.setFontSize(9); F('Unbounded', 'bold'); doc.setTextColor(255, 255, 255);
      text((u.name || '?').trim().charAt(0).toUpperCase(), x + 5, baseY + 1.2, { align: 'center' });
      doc.setFontSize(10); F('Sora', 'bold'); doc.setTextColor(...INK); text(u.name, x, baseY + 12);
      const net = allBalances[u.id]?.balance || 0;
      money(net, x, baseY + 19, { size: 9.5, family: 'Mono', style: 'bold', color: net >= 0 ? TEAL : PINK, sign: Math.round(net) === 0 ? '' : net > 0 ? '+' : '−' });
    });
    doc.setFontSize(6); F('Mono'); doc.setTextColor(...MUTED); text('ALL-TIME BALANCES', 16, baseY - 9, { charSpace: 0.4 });
  }

  // facts column
  const fx = W - 82;
  doc.setDrawColor(...INK); doc.setLineWidth(0.3); doc.line(fx - 8, 52, fx - 8, H - 18);
  let fy = 58;
  const label = t => { doc.setFontSize(6); F('Mono'); doc.setTextColor(...MUTED); text(t, fx, fy, { charSpace: 0.5 }); fy += 5.5; };
  label('BIGGEST CATEGORY');
  if (topCat) { doc.setFontSize(10.5); F('Sora', 'bold'); doc.setTextColor(...INK); text(`${topCat[0]} · `, fx, fy); const w = doc.getTextWidth(`${clean(topCat[0])} · `); money(topCat[1], fx + w, fy, { size: 10.5, family: 'Sora', style: 'bold' }); }
  else { doc.setFontSize(10.5); F('Sora', 'bold'); text('—', fx, fy); }
  fy += 12;
  if (!isPersonal) {
    label('SETTLE UP');
    if (!settlements.length) { doc.setFontSize(10.5); F('Sora', 'bold'); doc.setTextColor(...TEAL); text('All settled', fx, fy); fy += 7; }
    settlements.slice(0, 4).forEach(s => {
      const from = userName[s.from.id || s.from.userId] || s.from.name; const to = userName[s.to.id || s.to.userId] || s.to.name;
      doc.setFontSize(9); F('Mono', 'bold'); doc.setTextColor(...INK);
      const t = `${from} → ${to}  `; text(t, fx, fy);
      money(s.amount, fx + doc.getTextWidth(clean(t)), fy, { size: 9, family: 'Mono', style: 'bold' });
      fy += 6;
    });
    fy += 6;
  }
  label('LIFETIME');
  money(lifetime, fx, fy, { size: 10.5, family: 'Sora', style: 'bold' });
  if (firstMonth) { doc.setFontSize(7); F('Mono'); doc.setTextColor(...MUTED); text(`since ${firstMonth}`, fx + 44, fy); }
  fy += 14;
  // bars
  const maxM = Math.max(1, ...win.map(m => m.total));
  const barH = 24; const barY = Math.max(fy + barH, H - 34);
  win.forEach((m, i) => {
    const h = Math.max(1.5, (m.total / maxM) * barH); const x = fx + i * 12;
    const last = i === win.length - 1;
    doc.setGState(doc.GState({ opacity: last ? 1 : 0.35 + i * 0.07 }));
    doc.setFillColor(...(last ? VIOLET : INK)); doc.roundedRect(x, barY - h, 6, h, 1, 1, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setFontSize(5.5); F('Mono'); doc.setTextColor(...MUTED); text(m.short.toUpperCase(), x + 3, barY + 4, { align: 'center' });
  });

  // ---- EXPENSES (per month) ----
  const groups = new Map();
  scoped.forEach(e => { const d = new Date(e.date); const k = d.getFullYear() * 12 + d.getMonth(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
  const head = isPersonal ? ['DATE', 'DESCRIPTION', 'CATEGORY', 'AMOUNT'] : ['DATE', 'DESCRIPTION', 'CATEGORY', 'AMOUNT', 'PAID BY', 'SPLIT', ...users.map(u => u.name.toUpperCase())];
  const shareCol0 = 6;
  const headed = new Set();
  const pageHeader = (title) => {
    const n = doc.internal.getCurrentPageInfo().pageNumber;
    if (n === 1 || headed.has(n)) return;
    headed.add(n);
    brand(14, 14, 10);
    doc.setFontSize(6.5); F('Mono'); doc.setTextColor(...MUTED); text(title, W - 14, 14, { align: 'right', charSpace: 0.4 });
  };
  const tableCommon = {
    theme: 'plain',
    margin: { left: 14, right: 14, top: 22, bottom: 16 },
    styles: { font: fonts ? 'Mono' : 'helvetica', fontSize: 7.5, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, textColor: INK, lineColor: RULE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, lineWidth: 0 },
    alternateRowStyles: { fillColor: ZEBRA },
  };
  // draw custom money cells (₹ in Unbounded) after autoTable lays the cell out
  const drawMoneyCell = data => {
    const raw = data.cell.raw; if (!raw || raw.money === undefined) return;
    const { x, y, width, height } = data.cell;
    const size = raw.size || 7.5;
    money(raw.money, x + width - 2, y + (raw.dy ?? height / 2 + size * PT * 0.34), {
      size, family: 'Mono', style: raw.bold ? 'bold' : 'normal', align: 'right', color: raw.color || INK, sign: raw.sign || '',
    });
  };

  let first = true;
  [...groups.entries()].sort((a, b) => b[0] - a[0]).forEach(([k, list]) => {
    const label = `${MONTHS[k % 12]} ${Math.floor(k / 12)}`;
    let y;
    if (first || (doc.lastAutoTable?.finalY || 0) > H - 70) { doc.addPage(); first = false; y = 28; } else y = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(17); F('Serif', 'italic'); doc.setTextColor(...INK); text(label, 14, y);
    const body = list.map(e => {
      const a = amt(e); const split = e.splitAmong || [];
      const per = split.length ? a / split.length : 0;
      const d = new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const base = [d, clean(e.description || '-'), clean(catName[e.categoryId] || 'Other'), { content: '', money: a }];
      if (isPersonal) return base;
      const splitTxt = split.length === users.length ? 'ALL' : split.map(id => (userName[id] || '?').charAt(0).toUpperCase()).join(' + ');
      return [...base, clean(userName[e.paidBy] || '-'), splitTxt,
        ...users.map(u => (split.includes(u.id) ? { content: '', money: per } : { content: '—', styles: { textColor: MUTED, halign: 'right' } }))];
    });
    const foot = isPersonal ? null : [[
      { content: '', colSpan: 1 }, { content: `BALANCE · ${MONTHS[k % 12].slice(0, 3).toUpperCase()}`, colSpan: 5, styles: { fontStyle: 'bold' } },
      ...users.map(u => {
        let net = 0;
        list.forEach(e => { const split = e.splitAmong || []; if (e.paidBy === u.id) net += amt(e); if (split.includes(u.id)) net -= amt(e) / split.length; });
        return { content: '', money: net, bold: true, sign: Math.round(net) === 0 ? '' : net > 0 ? '+' : '−', color: net >= 0 ? TEAL : PINK };
      }),
    ]];
    autoTable(doc, {
      ...tableCommon, startY: y + 4, head: [head], body, foot: foot || undefined, showFoot: 'lastPage',
      footStyles: { fillColor: [255, 255, 255], textColor: INK, fontSize: 7, lineWidth: { top: 0.4 }, lineColor: INK },
      columnStyles: { 3: { halign: 'right' }, ...Object.fromEntries(users.map((_, i) => [shareCol0 + i, { halign: 'right' }])) },
      didParseCell: data => { if (data.section === 'head' && (data.column.index === 3 || (!isPersonal && data.column.index >= shareCol0))) data.cell.styles.halign = 'right'; },
      didDrawCell: drawMoneyCell,
      didDrawPage: () => pageHeader(`EXPENSES · ${scopeLabel.toUpperCase()}`),
    });
  });

  // ---- MATRIX ----
  const monthsUsed = win.length ? win : [];
  const grid = {};
  expenses.forEach(e => {
    const d = new Date(e.date);
    const m = monthsUsed.find(x => x.year === d.getFullYear() && x.month === d.getMonth());
    if (!m) return;
    const n = catName[e.categoryId] || 'Other';
    (grid[n] ||= {})[m.key] = (grid[n][m.key] || 0) + amt(e);
  });
  const rowsM = Object.entries(grid).map(([n, v]) => [n, v, Object.values(v).reduce((s, x) => s + x, 0)]).sort((a, b) => b[2] - a[2]);
  doc.addPage();
  doc.setFontSize(17); F('Serif', 'italic'); doc.setTextColor(...INK); text('Where it went', 14, 28);
  const delta = (cur, prevV) => (prevV > 0 ? Math.round(((cur - prevV) / prevV) * 100) : null);
  const mHead = ['CATEGORY', ...monthsUsed.map(m => `${m.short.toUpperCase()} ${String(m.year).slice(2)}`), 'TOTAL'];
  const mBody = rowsM.map(([n, v, t]) => [
    { content: clean(n), styles: { fontStyle: 'bold', font: fonts ? 'Sora' : 'helvetica', fontSize: 8.5 } },
    ...monthsUsed.map((m, i) => ({ content: '', cell: { v: v[m.key] || 0, prev: i ? (v[monthsUsed[i - 1].key] || 0) : 0, sel: i === monthsUsed.length - 1 } })),
    { content: '', money: t, bold: true },
  ]);
  const colTotals = monthsUsed.map(m => rowsM.reduce((s, [, v]) => s + (v[m.key] || 0), 0));
  const mFoot = [[{ content: 'GRAND TOTAL', styles: { fontStyle: 'bold' } }, ...colTotals.map(t => ({ content: '', money: t, bold: true })), { content: '', money: colTotals.reduce((s, x) => s + x, 0), bold: true }]];
  autoTable(doc, {
    ...tableCommon, startY: 34, head: [mHead], body: mBody, foot: mFoot,
    styles: { ...tableCommon.styles, minCellHeight: 10, valign: 'middle' },
    footStyles: { fillColor: [255, 255, 255], textColor: INK, lineWidth: { top: 0.4 }, lineColor: INK },
    columnStyles: Object.fromEntries(Array.from({ length: monthsUsed.length + 1 }, (_, i) => [i + 1, { halign: 'right' }])),
    didParseCell: data => { if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right'; },
    didDrawCell: data => {
      drawMoneyCell(data);
      const c = data.cell.raw?.cell; if (!c) return;
      const { x, y, width, height } = data.cell;
      if (c.sel) { doc.setGState(doc.GState({ opacity: 0.07 })); doc.setFillColor(...VIOLET); doc.rect(x, y, width, height, 'F'); doc.setGState(doc.GState({ opacity: 1 })); }
      if (c.v > 0) money(c.v, x + width - 2, y + 4.6, { size: 8, family: 'Mono', style: c.sel ? 'bold' : 'normal' });
      const d = c.v > 0 ? delta(c.v, c.prev) : null;
      if (d !== null && d !== 0) {
        const up = d > 0; const col = up ? PINK : TEAL;
        doc.setFontSize(5.8); F('Mono'); doc.setTextColor(...col);
        text(`${up ? '▲' : '▼'} ${Math.abs(d)}%`, x + width - 2, y + 8.4, { align: 'right' });
      }
    },
    didDrawPage: () => pageHeader(`WHERE IT WENT · ${scopeLabel.toUpperCase()}`),
  });

  // ---- footers ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(6); F('Mono'); doc.setTextColor(...MUTED);
    text(`Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${clean(roomName)}`, 14, H - 8);
    text(`PAGE ${i} OF ${pages}`, W - 14, H - 8, { align: 'right', charSpace: 0.4 });
  }

  const filename = `SplitEase_Report_${month ? `${MONTHS[month.month]}_${month.year}` : new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  return { filename, pages };
}
