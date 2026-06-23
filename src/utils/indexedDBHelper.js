/**
 * indexedDBHelper.js
 *
 * DEPRECATED: The learned_patterns IndexedDB store has been removed.
 * These are no-op stubs kept for import compatibility during the transition.
 * No code should call these functions — they are safe to remove in a future cleanup.
 */

const DB_NAME = 'splitease_offline_db';
const DB_VERSION = 2; // bumped to drop the old learned_patterns_store on upgrade

/**
 * Opens the DB and removes the old learned_patterns_store if it exists.
 * Safe to call multiple times — idempotent.
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Clean up the old store from v1
      if (db.objectStoreNames.contains('learned_patterns_store')) {
        db.deleteObjectStore('learned_patterns_store');
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/** No-op stub — learned pattern storage has been removed. */
// eslint-disable-next-line no-unused-vars
export async function saveLearnedPatternsToIndexedDB(_patterns) {
  // DEPRECATED — do nothing
}

/** No-op stub — always returns empty array. */
export async function getLearnedPatternsFromIndexedDB() {
  // DEPRECATED — learned patterns no longer stored
  return [];
}
