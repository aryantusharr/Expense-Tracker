// Copy rooms from an ANONYMISED backup (scripts/anonymise-backup.mjs output) into the TEST project.
// Usage: node scripts/restore-to-test.mjs <firestore.anon.json> [--skip "Room name" ...]
// Target comes from .env.test.local. Refuses to run against the live project, and refuses
// raw (non-anonymised) backups so real people's details never leave live.
// Values are written exactly as backed up (Firestore typed JSON), same document IDs.
import fs from 'node:fs'

const LIVE_PROJECT_ID = 'splitease-7bb6c'
const [backupFile, ...rest] = process.argv.slice(2)
const skipNames = rest.filter((a, i) => rest[i - 1] === '--skip')

const env = Object.fromEntries(
  fs.readFileSync('.env.test.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)).filter(Boolean)
    .map(m => [m[1], m[2]])
)
const projectId = env.VITE_FIREBASE_PROJECT_ID
if (!projectId || projectId === LIVE_PROJECT_ID) {
  throw new Error(`Refusing to write: target project is "${projectId}" (must be the test project)`)
}
const key = env.VITE_FIREBASE_API_KEY
const root = `projects/${projectId}/databases/(default)/documents`

const { docs, anonymised } = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
if (!anonymised) {
  throw new Error('Refusing to copy a raw backup — run scripts/anonymise-backup.mjs first')
}
const roomName = id => docs[`rooms/${id}`]?.fields?.name?.stringValue ?? ''
const skipRooms = new Set(
  Object.keys(docs).filter(p => /^rooms\/[^/]+$/.test(p))
    .map(p => p.split('/')[1]).filter(id => skipNames.includes(roomName(id)))
)

const paths = Object.keys(docs).filter(p => {
  const s = p.split('/')
  return s[0] === 'rooms' && !skipRooms.has(s[1]) && !docs[p].missing
})

let written = 0
for (let i = 0; i < paths.length; i += 400) {
  const writes = paths.slice(i, i + 400).map(p => ({
    update: { name: `${root}/${p}`, fields: docs[p].fields },
  }))
  const res = await fetch(`https://firestore.googleapis.com/v1/${root.replace('/documents', '')}/documents:commit?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`)
  written += writes.length
}

const rooms = new Set(paths.map(p => p.split('/')[1]))
console.log(JSON.stringify({
  projectId, written, rooms: [...rooms].map(roomName),
  skipped: [...skipRooms].map(roomName),
}, null, 1))
