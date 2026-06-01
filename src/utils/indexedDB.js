/**
 * IndexedDB Staging Layer for SplitEase
 * Stores and manages pending transactions locally in the user's browser.
 * Database name: splitease-pending
 * Object store: pendingTransactions
 */

const DB_NAME = 'splitease-pending';
const STORE_NAME = 'pendingTransactions';
const DB_VERSION = 1;

let dbInstance = null;
// Singleton promise ensures initDB() is only ever called ONCE regardless of
// how many callers invoke it concurrently (e.g. React StrictMode double-invoke).
// Without this guard, two simultaneous indexedDB.open() calls race during mount,
// stalling the JS event loop and causing RoomContext to read stale localStorage.
let dbInitPromise = null;

/**
 * Initializes the IndexedDB database.
 * Creates the object store if it doesn't already exist.
 * Guaranteed to open the database only once per session.
 */
export function initDB() {
  // Return the cached instance immediately if already open
  if (dbInstance) return Promise.resolve(dbInstance);

  // Return the in-flight promise if an open() is already in progress
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      dbInitPromise = null;
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      dbInitPromise = null;
      reject(new Error('Failed to open IndexedDB: ' + event.target.error));
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Only touch the pendingTransactions store — nothing else
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

  return dbInitPromise;
}

/**
 * Helper to ensure the database instance is opened and active.
 */
async function getDB() {
  if (dbInstance) return dbInstance;
  return initDB();
}


/**
 * Adds a new pending transaction to the store.
 * Generates a unique UUID and appends status: "PENDING" and capturedAt timestamp.
 */
export async function addPendingTransaction(parsedData) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Securely generate UUID, or fallback if crypto.randomUUID isn't available
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    const record = {
      ...parsedData,
      id,
      status: 'PENDING',
      capturedAt: new Date().toISOString()
    };

    const request = store.add(record);

    request.onsuccess = () => {
      resolve(record);
    };

    request.onerror = (event) => {
      reject(new Error('Failed to save pending transaction: ' + event.target.error));
    };
  });
}

/**
 * Retrieves all pending transactions, sorted by capturedAt descending (newest first).
 */
export async function getAllPending() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      const records = event.target.result || [];
      const pending = records
        .filter(record => record.status === 'PENDING')
        .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
      resolve(pending);
    };

    request.onerror = (event) => {
      reject(new Error('Failed to fetch pending transactions: ' + event.target.error));
    };
  });
}

/**
 * Gets the count of all pending transactions.
 */
export async function getPendingCount() {
  const pending = await getAllPending();
  return pending.length;
}

/**
 * Updates the status of a pending transaction (e.g. "PROCESSED" or "IGNORED").
 */
export async function updateStatus(id, status) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = (event) => {
      const record = event.target.result;
      if (!record) {
        reject(new Error(`Transaction with ID ${id} not found.`));
        return;
      }

      record.status = status;
      const updateRequest = store.put(record);

      updateRequest.onsuccess = () => {
        resolve(record);
      };

      updateRequest.onerror = (event) => {
        reject(new Error('Failed to update status: ' + event.target.error));
      };
    };

    getRequest.onerror = (event) => {
      reject(new Error('Failed to fetch transaction for status update: ' + event.target.error));
    };
  });
}

/**
 * Performs a hard deletion of a transaction by ID.
 */
export async function deletePendingTransaction(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = (event) => {
      reject(new Error('Failed to delete pending transaction: ' + event.target.error));
    };
  });
}

/**
 * Checks if a pending transaction with the exact same amount, date, time, and merchant already exists.
 */
export async function isDuplicate(parsedData) {
  if (!parsedData) return false;
  const pending = await getAllPending();
  return pending.some(record => 
    record.amount === parsedData.amount &&
    record.date === parsedData.date &&
    record.time === parsedData.time &&
    record.merchant === parsedData.merchant
  );
}
