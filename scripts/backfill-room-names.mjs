// Fill the roomNames/<normalised name> = { name } registry for rooms that existed before it,
// so the app's "name taken?" check (one get on roomNames) also knows the old rooms.
// Usage: node scripts/backfill-room-names.mjs <backup firestore.json> [envFile] [--yes]
//   Room names come from a FRESH backup (scripts/backup-firestore.mjs), so no listing is needed.
//   envFile defaults to .env.production.local (= LIVE). Without --yes it only prints what it would write.
// Only writes roomNames docs (one atomic commit); never touches rooms or expenses.
import fs from 'node:fs'

const args = process.argv.slice(2)
const go = args.includes('--yes')
const [backupFile, envFile = '.env.production.local'] = args.filter(a => a !== '--yes')
if (!backupFile) throw new Error('Usage: node scripts/backfill-room-names.mjs <backup firestore.json> [envFile] [--yes]')

const env = Object.fromEntries(
  fs.readFileSync(envFile, 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)).filter(Boolean)
    .map(m => [m[1], m[2]])
)
const projectId = env.VITE_FIREBASE_PROJECT_ID
const key = env.VITE_FIREBASE_API_KEY
const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
if (backup.projectId !== projectId) {
  throw new Error(`Backup is from "${backup.projectId}" but target is "${projectId}" — refusing`)
}

// Must match nameKey in src/services/roomService.js exactly.
const nameKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\//g, '_').slice(0, 120)
const validId = (id) => id && id !== '.' && id !== '..' && !/^__.*__$/.test(id)

const entries = new Map()   // key -> { name, rooms[] }
const skipped = []
for (const [path, d] of Object.entries(backup.docs)) {
  if (!/^rooms\/[^/]+$/.test(path)) continue
  const code = path.split('/')[1]
  const name = d.fields?.name?.stringValue
  if (d.missing || !name?.trim()) { skipped.push({ code, why: 'no room doc / no name' }); continue }
  const k = nameKey(name)
  if (!validId(k) || name.trim().length > 80) { skipped.push({ code, why: `name not storable: ${JSON.stringify(name)}` }); continue }
  if (!entries.has(k)) entries.set(k, { name: name.trim(), rooms: [] })
  entries.get(k).rooms.push(code)
}

const dbRoot = `projects/${projectId}/databases/(default)`
const writes = [...entries].map(([k, e]) => ({
  update: { name: `${dbRoot}/documents/roomNames/${k}`, fields: { name: { stringValue: e.name } } },
}))

if (go && writes.length) {
  const r = await fetch(`https://firestore.googleapis.com/v1/${dbRoot}/documents:commit?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }),
  })
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`)
}

console.log(JSON.stringify({
  projectId, backup: backupFile, written: go,
  roomNames: [...entries].map(([k, e]) => ({ key: k, name: e.name, rooms: e.rooms })),
  skipped,
}, null, 1))
