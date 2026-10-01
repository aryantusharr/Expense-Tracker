// Read-only Firestore backup over the REST API.
// Usage: node scripts/backup-firestore.mjs [envFile] [serviceAccountKey.json]
//   envFile defaults to .env.production.local (= LIVE). With a service-account key the
//   backup can list every room (live rules block listing for normal app access).
// Writes backups/<projectId>-<timestamp>/firestore.json with Firestore's typed values
// (lossless: timestamps, numbers, maps stay exactly as stored) so it can be restored later.
// Only GET/list calls are made — it never writes.
import fs from 'node:fs'
import path from 'node:path'
import { GoogleAuth } from 'google-auth-library'

const envFile = process.argv[2] || '.env.production.local'
const env = Object.fromEntries(
  fs.readFileSync(envFile, 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)).filter(Boolean)
    .map(m => [m[1], m[2]])
)
const projectId = env.VITE_FIREBASE_PROJECT_ID
const key = env.VITE_FIREBASE_API_KEY
const keyFile = process.argv[3]
const auth = keyFile && new GoogleAuth({
  keyFile, scopes: ['https://www.googleapis.com/auth/datastore'],
})
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

async function call(url, body) {
  const sep = url.includes('?') ? '&' : '?'
  const headers = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = `Bearer ${await auth.getAccessToken()}`
  else url = `${url}${sep}key=${key}`
  const res = await fetch(url, body
    ? { method: 'POST', headers, body: JSON.stringify(body) }
    : { headers })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

// All documents of a collection (handles paging). parent = '' for top level, or 'rooms/ABC'.
async function listDocs(parent, collectionId) {
  const docs = []
  let pageToken = ''
  do {
    const p = parent ? `${base}/${parent}/${collectionId}` : `${base}/${collectionId}`
    const r = await call(`${p}?pageSize=300&showMissing=true${pageToken ? `&pageToken=${pageToken}` : ''}`)
    docs.push(...(r.documents || []))
    pageToken = r.nextPageToken || ''
  } while (pageToken)
  return docs
}

let subcollectionScan = 'ok'
async function listSubcollections(docPath) {
  try {
    const r = await call(`${base}/${docPath}:listCollectionIds`, { pageSize: 100 })
    return r.collectionIds || []
  } catch (e) {
    subcollectionScan = `unavailable (${e.message.slice(0, 80)}) — fell back to known "expenses"`
    return ['expenses']
  }
}

async function dumpCollection(parent, collectionId, out) {
  for (const d of await listDocs(parent, collectionId)) {
    const rel = d.name.split('/documents/')[1]
    out[rel] = { fields: d.fields || {}, createTime: d.createTime, updateTime: d.updateTime, missing: !d.fields }
    for (const sub of await listSubcollections(rel)) await dumpCollection(rel, sub, out)
  }
}

const docs = {}
const topLevel = await call(`${base}:listCollectionIds`, { pageSize: 100 })
  .then(r => r.collectionIds || []).catch(() => ['rooms'])
for (const c of topLevel) await dumpCollection('', c, docs)

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dir = path.join('backups', `${projectId}-${stamp}`)
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, 'firestore.json')
fs.writeFileSync(file, JSON.stringify({ projectId, takenAt: new Date().toISOString(), topLevel, subcollectionScan, docs }, null, 1))

const counts = {}
for (const p of Object.keys(docs)) {
  const parts = p.split('/')
  const k = parts.filter((_, i) => i % 2 === 0).join('/')
  counts[k] = (counts[k] || 0) + 1
}
console.log(JSON.stringify({ projectId, file: path.resolve(file), topLevel, subcollectionScan, counts }, null, 1))
