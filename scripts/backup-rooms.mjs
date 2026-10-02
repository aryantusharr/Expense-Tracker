// Read-only backup of known rooms by code — works under the strict live rules (no key needed:
// a room can be read by its code, and its expenses listed). Same file format as backup-firestore.mjs.
// Usage: node scripts/backup-rooms.mjs CODE [CODE…]   (env: .env.production.local = LIVE)
// Only GET/list calls are made — it never writes.
import fs from 'node:fs'
import path from 'node:path'

const codes = process.argv.slice(2)
if (!codes.length) { console.error('Usage: node scripts/backup-rooms.mjs CODE [CODE…]'); process.exit(1) }
const env = Object.fromEntries(
  fs.readFileSync('.env.production.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)).filter(Boolean)
    .map(m => [m[1], m[2]])
)
const projectId = env.VITE_FIREBASE_PROJECT_ID
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
const get = async url => {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}key=${env.VITE_FIREBASE_API_KEY}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.json()
}
const put = (out, d) => { out[d.name.split('/documents/')[1]] = { fields: d.fields || {}, createTime: d.createTime, updateTime: d.updateTime, missing: false } }

const docs = {}
const summary = {}
for (const code of codes) {
  const room = await get(`${base}/rooms/${code}`)
  if (!room) { summary[code] = 'NOT FOUND'; continue }
  put(docs, room)
  let n = 0, pageToken = ''
  do {
    const r = await get(`${base}/rooms/${code}/expenses?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`)
    for (const d of r?.documents || []) { put(docs, d); n++ }
    pageToken = r?.nextPageToken || ''
  } while (pageToken)
  const name = room.fields?.name?.stringValue
  const rn = name && await get(`${base}/roomNames/${encodeURIComponent(name.trim().toLowerCase())}`).catch(() => null)
  if (rn) put(docs, rn)
  summary[code] = { name, expenses: n }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dir = path.join('backups', `${projectId}-${stamp}`)
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, 'firestore.json')
fs.writeFileSync(file, JSON.stringify({ projectId, takenAt: new Date().toISOString(), scope: `rooms by code: ${codes.join(', ')}`, docs }, null, 1))
console.log(JSON.stringify({ projectId, file: path.resolve(file), summary }, null, 1))
