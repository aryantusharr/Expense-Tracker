/**
 * SMS Parser Utility for SplitEase
 * Parses real-world Indian bank transaction SMS notifications.
 */

// Predefined category lookup table
const CATEGORY_MAP = {
  zepto: "Groceries",
  blinkit: "Groceries",
  bigbasket: "Groceries",
  swiggy: "Food & Drink",
  zomato: "Food & Drink",
  uber: "Transport",
  ola: "Transport",
  rapido: "Transport",
  netflix: "Entertainment",
  spotify: "Entertainment",
  prime: "Entertainment",
  bajaj: "Bills & Utilities"
};

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Normalizes date to YYYY-MM-DD format.
 * Supports DD-MM-YY (prefixes 20) and DD-MM-YYYY.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/[./]/g, '-').trim();
  const match = cleaned.match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if (!match) return null;
  
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month}-${day}`;
}

/**
 * Normalizes time to HH:MM format.
 */
function normalizeTime(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

/**
 * Resolves merchant from UPI ID based on specification rules.
 */
function resolveMerchantFromUPI(upiId) {
  if (!upiId) return null;
  
  // Rule: UPI ID is all digits before @ -> merchant = null
  const beforeAt = upiId.split('@')[0];
  if (/^\d+$/.test(beforeAt)) {
    return null;
  }
  
  // UPI ID prefix before first dot or @
  const upiPrefix = upiId.split(/[.@]/)[0];
  
  if (upiPrefix.toLowerCase().includes('paytmqr')) {
    return "Paytm";
  }
  
  if (upiPrefix.toLowerCase().includes('bajajpay')) {
    return "Bajaj";
  }
  
  // Otherwise extract first meaningful word of UPI prefix as merchant
  const match = upiPrefix.match(/[a-zA-Z]+/);
  if (match) {
    return capitalize(match[0]);
  }
  
  return null;
}

/**
 * Main parser entry point.
 * Parses raw text clipboard data.
 */
export function parseSMS(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { error: "UNRECOGNIZED", message: "Could not read this as a bank transaction." };
  }

  // 1. Received transaction detection (INCOME check)
  const isIncome = /received|credited/i.test(rawText);
  if (isIncome) {
    return { error: "INCOME", message: "This looks like income, not an expense." };
  }

  // Define extraction target variables
  let amount = null;
  let date = null;
  let time = null;
  let merchant = null;
  let suggestedCategoryName = null;

  // Split lines for parsing Axis bank or matching line-based content
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // 2. Try parsing Specific Formats
  
  // Format A: Axis Bank Card/RuPay
  // Spent INR 133\nAxis Bank Card no. XX3579\n30-05-26 21:55:30 IST\nZepto\nAvl Limit...
  const isAxis = rawText.includes("Spent INR") && (rawText.includes("Axis Bank") || rawText.includes("Axis"));
  
  // Format B: Kotak Bank UPI
  // Sent Rs.45.00 from Kotak Bank AC X8666 to bajajpay.6879729@indus on 29-05-26.UPI Ref...
  const isKotak = rawText.includes("Sent Rs.") && (rawText.includes("Kotak") || rawText.includes("Kotak Bank"));

  // Format C: UCO Bank UPI
  // A/c XX6835 Debited with Rs.100.00 on 31-05-2026 by UCO-UPI...
  const isUco = rawText.includes("Debited with Rs.") && (rawText.includes("UCO") || rawText.includes("UCO-UPI"));

  if (isAxis && lines.length >= 4) {
    // Amount extraction
    const amountMatch = lines[0].match(/Spent INR\s*([\d,]+(?:\.\d+)?)/i);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // Date and time extraction: find any date and time pattern in the lines
    let dtMatch = null;
    for (let i = 0; i < Math.min(lines.length, 4); i++) {
      const match = lines[i].match(/(\d{2}-\d{2}-\d{2,4})\s+(\d{2}:\d{2}:\d{2})/);
      if (match) {
        dtMatch = match;
        break;
      }
    }
    
    if (dtMatch) {
      date = normalizeDate(dtMatch[1]);
      time = normalizeTime(dtMatch[2]);
    } else if (lines[2]) {
      // Fallback: match from the 3rd line directly (index 2)
      const parts = lines[2].split(/\s+/);
      if (parts[0]) date = normalizeDate(parts[0]);
      if (parts[1]) time = normalizeTime(parts[1]);
    }

    // Merchant is the 4th line (index 3) trimmed, as-is
    merchant = lines[3];

  } else if (isKotak) {
    // Sent Rs.45.00 from Kotak Bank AC X8666 to bajajpay.6879729@indus on 29-05-26.UPI Ref...
    const amountMatch = rawText.match(/Sent Rs\.\s*([\d,]+(?:\.\d+)?)/i);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // UPI ID extraction
    const upiMatch = rawText.match(/to\s+([a-zA-Z0-9.\-_@]+)/i);
    const upiId = upiMatch ? upiMatch[1] : null;
    merchant = resolveMerchantFromUPI(upiId);

    // Date extraction: e.g. "on 29-05-26"
    const dateMatch = rawText.match(/on\s+(\d{2}-\d{2}-\d{2,4})/i);
    if (dateMatch) {
      date = normalizeDate(dateMatch[1]);
    }

  } else if (isUco) {
    // A/c XX6835 Debited with Rs.100.00 on 31-05-2026 by UCO-UPI...
    const amountMatch = rawText.match(/Debited with Rs\.\s*([\d,]+(?:\.\d+)?)/i);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    const dateMatch = rawText.match(/on\s+(\d{2}-\d{2}-\d{2,4})/i);
    if (dateMatch) {
      date = normalizeDate(dateMatch[1]);
    }
    
    merchant = null;

  } else {
    // 3. Fallback General Parser
    const generalAmtMatch = rawText.match(/(?:Spent|Sent|Debited|Paid|Amt)\s*(?:INR|Rs\.?|with)?\s*([\d,]+(?:\.\d+)?)/i) 
      || rawText.match(/([\d,]+(?:\.\d+)?)\s*(?:debit|debited|spent|paid)/i);
      
    if (generalAmtMatch) {
      amount = parseFloat(generalAmtMatch[1].replace(/,/g, ''));
    }

    // Extract Date
    const generalDateMatch = rawText.match(/(\d{2}[-/]\d{2}[-/]\d{2,4})/);
    if (generalDateMatch) {
      date = normalizeDate(generalDateMatch[1]);
    }

    // Extract Time
    const generalTimeMatch = rawText.match(/(\d{2}:\d{2}(?::\d{2})?)/);
    if (generalTimeMatch) {
      time = normalizeTime(generalTimeMatch[1]);
    }

    // Extract UPI/Merchant fallback if visible
    const upiMatch = rawText.match(/(?:to|at|by)\s+([a-zA-Z0-9.\-_@]+)/i);
    if (upiMatch && upiMatch[1].includes('@')) {
      merchant = resolveMerchantFromUPI(upiMatch[1]);
    }
  }

  // 4. Validate output confidence & amount
  if (amount === null || isNaN(amount)) {
    return { error: "UNRECOGNIZED", message: "Could not read this as a bank transaction." };
  }

  // Tag suggested category
  if (merchant) {
    const key = merchant.toLowerCase();
    if (CATEGORY_MAP[key]) {
      suggestedCategoryName = CATEGORY_MAP[key];
    }
  }

  const confidence = (amount !== null && date !== null) ? "high" : "low";

  return {
    amount,
    date,
    time,
    merchant: merchant || null,
    suggestedCategoryName: suggestedCategoryName || null,
    transactionType: "debit",
    confidence,
    rawText
  };
}
