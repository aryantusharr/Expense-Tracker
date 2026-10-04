/**
 * Bill reading — loaded lazily the first time someone taps "+" in the AAI chat (so firebase/ai, App Check and the
 * reCAPTCHA script never touch the app's first load). Sends all screenshots of ONE bill in one request to Gemini via
 * Firebase AI Logic, App Check (reCAPTCHA Enterprise, now "Google Cloud Fraud Defense" — free up to 10k/month) attached. Returns plain data (see billParse.js). Screenshots are never stored anywhere:
 * they're shrunk in memory, sent, and dropped.
 */
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from '../services/firebase';
import { BILL_SCHEMA, billPrompt, normaliseRead } from './billParse.js';
import { toDateStr } from './common.js';

/**
 * The one place the model names live (free on the Gemini Developer API, checked 4 Oct 2026; 2.5 is closed to new projects).
 * main: best reader, but the free tier allows only 20 reads/day per project. spare: used automatically once main's
 * daily reads are gone (her call 4 Oct) — LIMIT only shows when both are used up.
 */
export const BILL_MODELS = { main: 'gemini-3.8-flash', spare: 'gemini-3.5-flash-lite' };
const K_SPARE = 'splitease_aai_spare_day';          // this phone already saw main's daily limit today → go straight to spare

const LIVE_PROJECT = 'splitease-7bb6c';
const MAX_EDGE = 1600;
const QUALITY = 0.8;
const HARD_TIMEOUT_MS = 60000;

let ai = null;
const models = {};

function setUp() {
  if (ai) return ai;
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  // Live stays untouched until her release yes: the live build has no site key, and the live project needs an explicit flag.
  if (!siteKey || (project === LIVE_PROJECT && import.meta.env.VITE_AAI_BILLS_LIVE !== 'yes')) {
    const e = new Error('Bill reading is not set up for this project'); e.code = 'NOT_SET_UP'; throw e;
  }
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  }
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: false });
  ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
  return ai;
}

const modelFor = which => (models[which] ||= getGenerativeModel(setUp(), {
  model: BILL_MODELS[which],
  generationConfig: { responseMimeType: 'application/json', responseJsonSchema: BILL_SCHEMA, ...(which === 'main' ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}) },
}));
const dayLimit = e => e?.customErrorData?.status === 429 && /PerDay|per day/i.test(`${e.message} ${JSON.stringify(e.customErrorData?.errorDetails || '')}`);
const spareToday = today => { try { return localStorage.getItem(K_SPARE) === today; } catch { return false; } };
const markSpare = today => { try { localStorage.setItem(K_SPARE, today); } catch { /* private mode */ } };

/** Called when "+" is tapped: set up App Check (loads the reCAPTCHA script) while the photo picker is open. */
export function warm() { try { setUp(); } catch { /* not set up → the read itself reports it */ } }

/** Shrink one image (≈1600px long edge, JPEG 0.8) → base64. Drawing on a canvas also turns iPhone HEIC into JPEG. */
async function shrink(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not open image')); i.src = url; });
    const k = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise(res => c.toBlob(res, 'image/jpeg', QUALITY));
    const buf = new Uint8Array(await out.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  } finally { URL.revokeObjectURL(url); }
}

/**
 * Read one bill. blobs = 1–4 images of the same bill. Resolves to plain data; rejects with the SDK error
 * (AIError with customErrorData.status), { code: 'PARSE' | 'NET' | 'NOT_SET_UP' | 'SLOW_ABORT' }.
 */
export async function readBill(blobs, { categories = [], signal, now = new Date() } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { const e = new Error('offline'); e.code = 'NET'; throw e; }
  setUp();
  const today = toDateStr(now);
  let which = spareToday(today) ? 'spare' : 'main';
  const images = await Promise.all(blobs.slice(0, 4).map(shrink));
  const parts = [
    { text: billPrompt({ categories, today: toDateStr(now), count: images.length }) },
    ...images.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
  ];
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  signal?.addEventListener('abort', stop);
  const hard = setTimeout(stop, HARD_TIMEOUT_MS);
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await modelFor(which).generateContent({ contents: [{ role: 'user', parts }] }, { signal: ctl.signal });
        return { ...normaliseRead(res.response.text(), { now }), model: which };
      } catch (e) {
        if (ctl.signal.aborted) { const a = new Error('aborted'); a.code = signal?.aborted ? 'ABORTED' : 'SLOW_ABORT'; throw a; }
        if (which === 'main' && dayLimit(e)) { markSpare(today); which = 'spare'; attempt--; continue; }   // main's 20 are gone → spare
        if (e?.code === 'PARSE' && attempt === 0) continue;          // a broken JSON reply: one silent retry
        throw e;
      }
    }
  } finally {
    clearTimeout(hard);
    signal?.removeEventListener('abort', stop);
  }
}
