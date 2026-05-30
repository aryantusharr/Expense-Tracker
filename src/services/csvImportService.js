import Papa from 'papaparse';
import { db } from './firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';

// ── Date Parsing ───────────────────────────────────────────────
const MONTH_ABBR = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04',
  May: '05', Jun: '06', Jul: '07', Aug: '08',
  Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * Parse "DD Mon YYYY" (e.g. "31 Mar 2026") → "YYYY-MM-DD"
 * Also handles "YYYY-MM-DD" passthrough.
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // "DD Mon YYYY"
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const mon = MONTH_ABBR[m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()];
    if (!mon) return null;
    return `${m[3]}-${mon}-${day}`;
  }
  return null;
}

/**
 * Strip ₹, commas, whitespace and parse as float.
 */
function parseAmount(raw) {
  if (!raw) return NaN;
  const cleaned = String(raw).replace(/[₹,\s]/g, '').trim();
  return parseFloat(cleaned);
}

// ── CSV Parsing ────────────────────────────────────────────────

const REQUIRED_COLS_SHARED = ['Date', 'Description', 'Category', 'Amount', 'Paid By', 'Split Between'];
const REQUIRED_COLS_PERSONAL = ['Date', 'Description', 'Category', 'Amount'];

/**
 * Parse a CSV file and extract raw rows and unique values for mapping.
 * Validates required columns based on mode (isPersonal).
 */
export function parseCSVForMapping(file, isPersonal) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || [];
        const requiredCols = isPersonal ? REQUIRED_COLS_PERSONAL : REQUIRED_COLS_SHARED;
        
        // Find missing columns (case-insensitive check)
        const headerLower = headers.map(h => h.toLowerCase().trim());
        const missingCols = requiredCols.filter(req => !headerLower.includes(req.toLowerCase()));
        
        if (missingCols.length > 0) {
          return reject(new Error(`Missing required columns: ${missingCols.join(', ')}`));
        }

        if (results.data.length === 0) {
          return reject(new Error('The uploaded file has no data rows.'));
        }

        const rawRows = [];
        const skipped = [];
        const uniqueCategories = new Set();
        const uniquePaidBy = new Set();
        const uniqueSplits = new Set();

        // Helper to find the actual header name from the CSV that matches our required col (case insensitive)
        const getHeader = (colName) => headers.find(h => h.toLowerCase().trim() === colName.toLowerCase());

        const hDate = getHeader('Date');
        const hDesc = getHeader('Description');
        const hCat = getHeader('Category');
        const hAmount = getHeader('Amount');
        const hPaidBy = getHeader('Paid By');
        const hSplit = getHeader('Split Between');

        results.data.forEach((row, idx) => {
          const rowNum = idx + 2; // +2 for 1-indexed + header row

          const dateRaw = row[hDate];
          const descRaw = row[hDesc];
          const catRaw = row[hCat];
          const amountRaw = row[hAmount];
          
          if (!dateRaw || !String(dateRaw).trim()) {
            skipped.push({ rowNum, reason: 'Date is blank' });
            return;
          }
          if (!amountRaw || !String(amountRaw).trim()) {
            skipped.push({ rowNum, reason: 'Amount is blank' });
            return;
          }

          const date = parseDate(String(dateRaw));
          if (!date) {
            skipped.push({ rowNum, reason: `Invalid date format: "${dateRaw}"` });
            return;
          }

          const amount = parseAmount(amountRaw);
          if (isNaN(amount) || amount <= 0) {
            skipped.push({ rowNum, reason: `Invalid amount: "${amountRaw}"` });
            return;
          }
          
          const categoryRaw = String(catRaw || '').trim();
          if (categoryRaw) uniqueCategories.add(categoryRaw);

          let paidByStr = '';
          let splitStr = '';

          if (!isPersonal) {
            paidByStr = String(row[hPaidBy] || '').trim();
            if (paidByStr) uniquePaidBy.add(paidByStr);
            
            splitStr = String(row[hSplit] || '').trim();
            if (splitStr) uniqueSplits.add(splitStr);
          }

          rawRows.push({
            rowNum,
            date,
            description: String(descRaw || '').trim(),
            amount,
            categoryRaw,
            paidByRaw: paidByStr,
            splitRaw: splitStr
          });
        });

        resolve({ 
          rawRows, 
          skipped, 
          uniqueCategories: Array.from(uniqueCategories),
          uniquePaidBy: Array.from(uniquePaidBy),
          uniqueSplits: Array.from(uniqueSplits)
        });
      },
      error(err) {
        reject(err);
      },
    });
  });
}

/**
 * Applies mappings to raw rows to generate final Firestore documents.
 */
export function applyMappings(rawRows, mappings, isPersonal, roomUsers) {
  const { categoryMap, peopleMap, splitMap } = mappings;
  const processedRows = [];
  const additionalSkipped = [];

  rawRows.forEach(row => {
    const categoryId = categoryMap[row.categoryRaw] || null;
    if (row.categoryRaw && !categoryId) {
        additionalSkipped.push({ rowNum: row.rowNum, reason: `Unmapped category: "${row.categoryRaw}"` });
        return;
    }

    let paidBy = null;
    let splitAmong = [];

    if (isPersonal) {
      paidBy = roomUsers[0].id;
      splitAmong = [roomUsers[0].id];
    } else {
      paidBy = peopleMap[row.paidByRaw] || null;
      if (row.paidByRaw && !paidBy) {
          additionalSkipped.push({ rowNum: row.rowNum, reason: `Unmapped person: "${row.paidByRaw}"` });
          return;
      }
      
      splitAmong = splitMap[row.splitRaw] || [];
      if (row.splitRaw && splitAmong.length === 0) {
          additionalSkipped.push({ rowNum: row.rowNum, reason: `Unmapped split: "${row.splitRaw}"` });
          return;
      }
    }

    processedRows.push({
      date: row.date,
      description: row.description,
      amount: row.amount,
      categoryId: categoryId || 'cat-4', // Fallback to 'Food' or general category if needed, though we block unmapped usually. Let's rely on validation.
      paidBy,
      splitAmong,
      // Keep raw strings for preview table if needed
      categoryRaw: row.categoryRaw,
      paidByRaw: row.paidByRaw,
      splitRaw: row.splitRaw,
      rowNum: row.rowNum
    });
  });

  return { processedRows, additionalSkipped };
}


// ── Firestore Batch Import ─────────────────────────────────────

const BATCH_SIZE = 500;

/**
 * Write parsed expense rows to Firestore in batches of 500.
 * @param {string} roomId — The room ID
 * @param {Array} rows — processed expense objects
 * @param {Function} onProgress — callback(percent: number)
 * @returns {{ imported: number, errors: Array<{rowIndex, error}> }}
 */
export async function importToFirestore(roomId, rows, onProgress) {
  const collectionRef = collection(db, 'rooms', roomId, 'expenses');
  const errors = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((row) => {
      const docRef = doc(collectionRef); // auto-ID
      // Strip out raw mapping fields before saving
      const { categoryRaw, paidByRaw, splitRaw, rowNum, ...cleanRow } = row;
      batch.set(docRef, {
        ...cleanRow,
        createdAt: new Date().toISOString(),
      });
    });

    try {
      await batch.commit();
      imported += chunk.length;
    } catch (err) {
      // Record all rows in this chunk as failed
      chunk.forEach((row, j) => {
        errors.push({ rowIndex: row.rowNum, error: err.message });
      });
    }

    const percent = Math.min(100, Math.round(((i + chunk.length) / rows.length) * 100));
    if (onProgress) onProgress(percent);
  }

  return { imported, errors };
}
