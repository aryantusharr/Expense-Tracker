/**
 * Errors as AAI replies (board AAI-Chat-7): a tinted box, the app's stamp, a plain reason, two buttons and a mono
 * DETAILS line. "Type items" is always offered where it makes sense. Pure (no React).
 *
 * Stamps/tones: UNCLEAR violet · LIMIT amber · OFFLINE grey · DOWN pink · WAIT amber · SLOW amber · NOT A BILL pink.
 * Actions: { id, label, primary? } — the chat decides what each id does (retry · type · hand · ok · add · fix · wait).
 */

const A = (id, label, primary = false) => ({ id, label, primary });

const BASE = {
  unclear: { tone: 'violet', stamp: 'UNCLEAR', title: 'Couldn’t read that clearly', body: 'Part of it is blurry or cut off. I read the rest.', details: 'OCR · LOW CONFIDENCE', actions: [A('add', 'Add screenshot', true), A('fix', 'Fix by hand')] },
  limit: { tone: 'amber', stamp: 'LIMIT', title: 'Reading limit reached for today', body: 'AAI reads bills for free, with a daily limit. Your screenshot is kept for tomorrow.', details: '429 · QUOTA', actions: [A('type', 'Type items', true), A('ok', 'OK')] },
  offline: { tone: 'grey', stamp: 'OFFLINE', title: 'You’re offline', body: 'Reading needs internet. I’ll read it when you’re back — typing still works.', details: 'NET · OFFLINE', actions: [A('ok', 'OK', true), A('type', 'Type items')] },
  down: { tone: 'pink', stamp: 'DOWN', title: 'AAI isn’t responding', body: 'The reading service is having trouble, not your bill.', details: '503 · UNAVAILABLE', actions: [A('retry', 'Try again', true), A('type', 'Type items')] },
  wait: { tone: 'amber', stamp: 'WAIT', title: 'One at a time, please', body: 'AAI is still busy with the last one. Give it a few seconds.', details: 'QUEUE · BUSY', actions: [A('retry', 'Try again', true), A('type', 'Type items')] },
  slow: { tone: 'amber', stamp: 'SLOW', title: 'Taking longer than usual', body: 'The reading is slow right now. You can wait, or type the items yourself.', details: 'SLOW · OVER 12S', actions: [A('wait', 'Keep waiting', true), A('type', 'Type items')] },
  notbill: { tone: 'pink', stamp: 'NOT A BILL', title: 'That doesn’t look like a bill', body: 'I couldn’t find items or a total in it.', details: 'NO ITEMS FOUND', actions: [A('add', 'Add another', true), A('type', 'Type items')] },
};

export const ERROR_TYPES = Object.keys(BASE);

/** type → reply spec { type, tone, stamp, title, body, details, actions }. Anything in `over` replaces the default. */
export function errorReply(type, over = {}) {
  const b = BASE[type] || BASE.down;
  return { type, ...b, ...over };
}

/** Typed text with no amount in it (the only UNCLEAR that can happen while typing). */
export const unclearTyped = text => errorReply('unclear', {
  title: 'Couldn’t find an amount',
  body: 'I need a number to add this. Fill it in by hand, or type it again with the amount.',
  details: 'NO AMOUNT · TYPED',
  actions: [A('hand', 'Add by hand', true), A('type', 'Type again')],
  text,
});

/** A save that failed (not the slow/offline case — those are saved on the phone and sync later). */
export const saveDown = e => errorReply('down', {
  title: 'Couldn’t save that',
  body: 'The server isn’t answering — not your entry. It’s still on the card, so try again.',
  details: `SAVE · ${String(e?.code || e?.message || 'FAILED').replace(/^firestore\//, '').toUpperCase().slice(0, 28)}`,
  actions: [A('retry', 'Try again', true), A('ok', 'OK')],
});
