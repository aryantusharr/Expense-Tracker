/**
 * Bills waiting to be read, kept ON THE PHONE only (IndexedDB) — offline, or the free daily limit was hit.
 * Read as soon as the chat is open and online (a LIMIT one waits for the next day); deleted the moment reading starts.
 * Entry: { id, room, blobs:[Blob], reason: 'offline' | 'limit', day: 'yyyy-mm-dd', at }
 */
const DB = 'splitease_aai';
const STORE = 'billQueue';

function open() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('no indexedDB')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => res(out?.result);
      tx.onerror = () => rej(tx.error);
    });
  } finally { db.close(); }
}

export const queueBill = entry => run('readwrite', s => s.put({ at: Date.now(), ...entry })).catch(() => {});
export const unqueueBill = id => run('readwrite', s => s.delete(id)).catch(() => {});
export const queuedBills = room => run('readonly', s => s.getAll()).then(all => (all || []).filter(e => e.room === room).sort((a, b) => a.at - b.at)).catch(() => []);

/** The next queued bill that can be read now (offline ones any time; limit ones from the next day). */
export const readyToRead = (list, today) => list.find(e => e.reason !== 'limit' || e.day < today) || null;
