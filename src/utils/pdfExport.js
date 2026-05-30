import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate expense report PDF.
 * Page 1: Expense table with per-user share columns grouped by month
 * Page 2: Category pivot table with monthly columns
 *
 * NOTE: jsPDF Helvetica doesn't support Unicode (₹, ▸ etc). Use "Rs." instead.
 */
export function generateExpenseReport(expenses, users, balances, roomName, categories, filterMonth) {
  try {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Build lookup maps
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.name; });
    const catMap = {};
    (categories || []).forEach(c => { catMap[c.id] = c.name; });

    // Filter by month if provided
    let filtered = [...expenses];
    if (filterMonth) {
      filtered = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === filterMonth.month && d.getFullYear() === filterMonth.year;
      });
    }

    // Sort by date descending
    const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group by month
    const monthGroups = {};
    sorted.forEach(e => {
      const d = new Date(e.date);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (!monthGroups[key]) monthGroups[key] = [];
      monthGroups[key].push(e);
    });

    // ===== TITLE =====
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 50, 50);
    doc.text('Expenses', pageWidth / 2, 15, { align: 'center' });

    // Column headers — NO "Month" column
    const userNames = users.map(u => u.name);
    const isPersonal = users.length <= 1;
    let headers;
    if (isPersonal) {
      headers = [['Date', 'Description', 'Category', 'Amount']];
    } else {
      headers = [['Date', 'Description', 'Category', 'Amount', 'Paid By', 'Split Between', ...userNames.map(n => n + ' Share')]];
    }

    // Build rows
    const body = [];
    Object.entries(monthGroups).forEach(([monthLabel, monthExpenses]) => {
      // Month separator row
      const sepRow = new Array(headers[0].length).fill('');
      sepRow[0] = '-- ' + monthLabel + ' --';
      body.push(sepRow);

      monthExpenses.forEach(e => {
        const amount = parseFloat(e.amount) || 0;
        const splitAmong = e.splitAmong || [];
        const perPerson = splitAmong.length > 0 ? Math.round(amount / splitAmong.length) : 0;
        const d = new Date(e.date);

        const splitNames = splitAmong.length === users.length
          ? 'ALL'
          : splitAmong.map(id => {
              const name = userMap[id] || id;
              return name.charAt(0).toUpperCase();
            }).join(' + ');

        if (isPersonal) {
          body.push([
            d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            e.description || '-',
            catMap[e.categoryId] || 'Other',
            'Rs.' + amount.toLocaleString('en-IN'),
          ]);
        } else {
          body.push([
            d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            e.description || '-',
            catMap[e.categoryId] || 'Other',
            'Rs.' + amount.toLocaleString('en-IN'),
            userMap[e.paidBy] || '-',
            splitNames,
            ...users.map(u => splitAmong.includes(u.id) ? 'Rs.' + perPerson.toLocaleString('en-IN') : 'Rs.0'),
          ]);
        }
      });
    });

    autoTable(doc, {
      startY: 22,
      head: headers,
      body: body,
      theme: 'grid',
      headStyles: {
        fillColor: [80, 80, 80],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 24 },
        3: { halign: 'right' },
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.row.raw && data.row.raw[0] && String(data.row.raw[0]).startsWith('--')) {
          data.cell.styles.fillColor = [40, 40, 40];
          data.cell.styles.textColor = [200, 200, 200];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8;
        }
        // Color per-user share
        if (!isPersonal && data.section === 'body' && data.column.index >= 6 && data.column.index < 6 + users.length) {
          const val = String(data.cell.raw || '');
          if (val === 'Rs.0') {
            data.cell.styles.textColor = [150, 150, 150];
          } else {
            data.cell.styles.textColor = [0, 180, 0];
          }
        }
      },
      margin: { left: 8, right: 8 },
    });

    // ===== PAGE 2: Category Pivot Table =====
    doc.addPage();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 50, 50);
    doc.text('Expenses Pivot', pageWidth / 2, 15, { align: 'center' });

    const monthKeys = Object.keys(monthGroups);

    // Build pivot
    const pivotData = {};
    sorted.forEach(e => {
      const catName = catMap[e.categoryId] || 'Other';
      const d = new Date(e.date);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const mKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (!pivotData[catName]) pivotData[catName] = {};
      pivotData[catName][mKey] = (pivotData[catName][mKey] || 0) + (parseFloat(e.amount) || 0);
    });

    const pivotHeaders = [['Category', ...monthKeys, 'Grand Total']];
    const pivotBody = [];
    const grandTotals = {};
    monthKeys.forEach(m => { grandTotals[m] = 0; });
    let overallTotal = 0;

    Object.entries(pivotData)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([catName, months]) => {
        let rowTotal = 0;
        const row = [catName];
        monthKeys.forEach(m => {
          const val = months[m] || 0;
          rowTotal += val;
          grandTotals[m] = (grandTotals[m] || 0) + val;
          row.push(val > 0 ? 'Rs.' + Math.round(val).toLocaleString('en-IN') : '');
        });
        overallTotal += rowTotal;
        row.push('Rs.' + Math.round(rowTotal).toLocaleString('en-IN'));
        pivotBody.push(row);
      });

    const totalRow = ['Grand Total'];
    monthKeys.forEach(m => {
      totalRow.push('Rs.' + Math.round(grandTotals[m]).toLocaleString('en-IN'));
    });
    totalRow.push('Rs.' + Math.round(overallTotal).toLocaleString('en-IN'));

    autoTable(doc, {
      startY: 22,
      head: pivotHeaders,
      body: pivotBody,
      foot: [totalRow],
      theme: 'grid',
      headStyles: {
        fillColor: [80, 80, 80],
        textColor: [200, 200, 200],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      footStyles: {
        fillColor: [50, 50, 50],
        textColor: [255, 200, 80],
        fontStyle: 'bold',
        fontSize: 9,
      },
      columnStyles: (() => {
        const cs = { 0: { fontStyle: 'bold', textColor: [220, 100, 100] } };
        for (let i = 1; i <= monthKeys.length + 1; i++) {
          cs[i] = { halign: 'right' };
        }
        return cs;
      })(),
      didParseCell: function(data) {
        if (data.section === 'body') {
          const idx = data.column.index;
          if (idx === pivotHeaders[0].length - 1) {
            data.cell.styles.textColor = [255, 200, 80];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    const filename = `SplitEase_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  } catch (err) {
    // Silent error
    alert('Failed to generate PDF: ' + err.message);
  }
}
