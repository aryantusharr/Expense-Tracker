import { doc, setDoc, increment, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { toDateStr } from '../aai/common.js';

/**
 * "Who opened the app" — rooms/{code}/opens/{memberId}_{yyyy-mm-dd} = { memberId, day, count, last }.
 * One document per member per day; `count` goes up once per app open (see useRecordOpen). Everyone in the room
 * can read everyone's (her call 4 Oct). Failures are silent: this only feeds the heatmap.
 */
export function recordOpen(roomCode, memberId, now = new Date()) {
  const day = toDateStr(now);
  return setDoc(doc(db, 'rooms', roomCode, 'opens', `${memberId}_${day}`), {
    memberId, day, count: increment(1), last: now.getTime(),
  }, { merge: true });
}

/** Live rows since `sinceDay` ('YYYY-MM-DD'). cb(rows) — or cb(null) if reading isn't allowed / fails. */
export function subscribeOpens(roomCode, sinceDay, cb) {
  const q = query(collection(db, 'rooms', roomCode, 'opens'), where('day', '>=', sinceDay));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data())), () => cb(null));
}
