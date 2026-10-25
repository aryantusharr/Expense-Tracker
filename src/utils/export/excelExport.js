import * as XLSX from 'xlsx-js-style';

// Same columns and data as before; styled per the Report-Excel board (E2):
// violet header (frozen, filter), ₹ number format with Indian grouping, bold Total row.
const VIOLET = '6B5BFF';
const INK = '15142B';
const RUPEE_FMT = '"₹"#,##,##0';
const thin = { style: 'thin', color: { rgb: 'D9D9E3' } };
const box = { top: thin, bottom: thin, left: thin, right: thin };

// Real Excel dates (serial numbers) so the column sorts and filters by date; shown as "01 Oct 2026".
const DATE_FMT = 'dd mmm yyyy';
const serialOf = value => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  const d = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : (() => { const x = new Date(value); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()); })();
  return Math.round((d - Date.UTC(1899, 11, 30)) / 86400000);
};
const safe = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');

function buildSheet(list, categories) {
  const catMap = {};
  categories.forEach(c => { catMap[c.id] = c.name; });
  const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

  const head = ['S.No', 'Date', 'Description', 'Category', 'Amount'];
  const headStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: VIOLET } }, border: box, alignment: { vertical: 'center' } };
  const aoa = [head.map((h, i) => ({ v: h, t: 's', s: { ...headStyle, alignment: { horizontal: i === 4 ? 'right' : i === 0 ? 'center' : 'left', vertical: 'center' } } }))];

  sorted.forEach((e, i) => {
    aoa.push([
      { v: i + 1, t: 'n', s: { border: box, alignment: { horizontal: 'center' }, font: { color: { rgb: '6F6E88' } } } },
      { v: serialOf(e.date), t: 'n', z: DATE_FMT, s: { border: box, numFmt: DATE_FMT, alignment: { horizontal: 'left' } } },
      { v: e.description || '-', t: 's', s: { border: box } },
      { v: catMap[e.categoryId] || 'Other', t: 's', s: { border: box } },
      { v: parseFloat(e.amount) || 0, t: 'n', z: RUPEE_FMT, s: { border: box, numFmt: RUPEE_FMT, alignment: { horizontal: 'right' } } },
    ]);
  });

  const last = aoa.length; // 1-based row number of the final expense row
  const bold = { font: { bold: true } };
  aoa.push([
    { v: '', t: 's' }, { v: '', t: 's' },
    { v: `Total · ${sorted.length} ${sorted.length === 1 ? 'expense' : 'expenses'}`, t: 's', s: bold },
    { v: '', t: 's' },
    { f: `SUM(E2:E${last})`, t: 'n', v: sorted.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0), z: RUPEE_FMT,
      s: { font: { bold: true }, numFmt: RUPEE_FMT, alignment: { horizontal: 'right' }, border: { top: { style: 'medium', color: { rgb: INK } } } } },
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 14 }];
  ws['!autofilter'] = { ref: `A1:E${last}` };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
  ws['!rows'] = [{ hpt: 22 }];
  return ws;
}

function save(ws, sheetName, filename) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * Export every expense to a styled .xlsx. Throws on failure (the caller shows a toast).
 * @returns {string} the saved file name
 */
export function exportToExcel(expenses, categories = [], roomName = 'SplitEase') {
  if (!expenses || expenses.length === 0) throw new Error('No expenses to export.');
  const stamp = new Date().toISOString().split('T')[0];
  return save(buildSheet(expenses, categories), 'Expenses', `${safe(roomName)}_Expenses_${stamp}.xlsx`);
}

/**
 * Export one month ({ month, year, label }) to a styled .xlsx. Throws on failure.
 * @returns {string} the saved file name
 */
export function exportToExcelMonthly(expenses, categories = [], roomName = 'SplitEase', monthObj) {
  const filtered = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === monthObj.month && d.getFullYear() === monthObj.year;
  });
  if (!filtered.length) throw new Error(`No expenses found for ${monthObj.label}.`);
  return save(buildSheet(filtered, categories), monthObj.label, `${safe(roomName)}_Expenses_${monthObj.label.replace(/\s+/g, '_')}.xlsx`);
}
