import * as XLSX from 'xlsx';

/**
 * Export expenses to an Excel (.xlsx) file.
 *
 * Maps expense objects to clean, human-readable columns and triggers
 * a native browser download. Works entirely client-side via SheetJS.
 *
 * @param {Array}  expenses   - The active expenses array from context.
 * @param {Array}  categories - Category list for id → name lookup.
 * @param {string} [roomName] - Optional room name used in the filename.
 */
export function exportToExcel(expenses, categories = [], roomName = 'SplitEase') {
  try {
    if (!expenses || expenses.length === 0) {
      alert('No expenses to export.');
      return;
    }

    // Build a category lookup map
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });

    // Sort by date descending (newest first)
    const sorted = [...expenses].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    // Map to clean rows
    const rows = sorted.map((expense, index) => {
      const d = new Date(expense.date);
      return {
        'S.No': index + 1,
        'Date': d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        'Description': expense.description || '-',
        'Category': catMap[expense.categoryId] || 'Other',
        'Amount': parseFloat(expense.amount) || 0,
      };
    });

    // Create workbook & worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns for better readability
    const colWidths = [
      { wch: 6 },   // S.No
      { wch: 14 },  // Date
      { wch: 30 },  // Description
      { wch: 16 },  // Category
      { wch: 14 },  // Amount
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    // Generate filename with date stamp
    const dateStamp = new Date().toISOString().split('T')[0];
    const safeName = roomName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_Expenses_${dateStamp}.xlsx`;

    // Trigger browser download
    XLSX.writeFile(workbook, filename);
  } catch (err) {
    // Silent error
    alert('Failed to export Excel: ' + err.message);
  }
}

/**
 * Export expenses for a specific month to an Excel (.xlsx) file.
 *
 * @param {Array}  expenses   - The active expenses array from context.
 * @param {Array}  categories - Category list for id → name lookup.
 * @param {string} [roomName] - Optional room name used in the filename.
 * @param {Object} monthObj   - Object containing month and year properties.
 */
export function exportToExcelMonthly(expenses, categories = [], roomName = 'SplitEase', monthObj) {
  try {
    const filtered = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === monthObj.month && d.getFullYear() === monthObj.year;
    });

    if (!filtered || filtered.length === 0) {
      alert(`No expenses found for ${monthObj.label}.`);
      return;
    }

    // Build a category lookup map
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });

    // Sort by date descending (newest first)
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    // Map to clean rows
    const rows = sorted.map((expense, index) => {
      const d = new Date(expense.date);
      return {
        'S.No': index + 1,
        'Date': d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        'Description': expense.description || '-',
        'Category': catMap[expense.categoryId] || 'Other',
        'Amount': parseFloat(expense.amount) || 0,
      };
    });

    // Create workbook & worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns for better readability
    const colWidths = [
      { wch: 6 },   // S.No
      { wch: 14 },  // Date
      { wch: 30 },  // Description
      { wch: 16 },  // Category
      { wch: 14 },  // Amount
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, monthObj.label);

    // Generate filename
    const safeName = roomName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeMonth = monthObj.label.replace(/\s+/g, '_');
    const filename = `${safeName}_Expenses_${safeMonth}.xlsx`;

    // Trigger browser download
    XLSX.writeFile(workbook, filename);
  } catch (err) {
    // Silent error
    alert('Failed to export Excel: ' + err.message);
  }
}
