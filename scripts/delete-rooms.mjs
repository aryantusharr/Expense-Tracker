// Delete specific rooms (room doc + its expenses) by code. Safety: every room must be in the given backup,
// and its expense count today must match the backup — so everything deleted can be restored from that file.
// Usage: node scripts/delete-rooms.mjs <backup firestore.json> CODE [CODE…] [--env envFile] [--yes]
//   envFile defaults to .env.production.local (= LIVE). Without --yes it only prints what it would delete.
// Uses unauthenticated REST list calls → only works while the open rules are deployed.
import fs from 'node:fs'

const args = process.argv.slice(2)
const go = args.includes('--yes')
const envAt = args.indexOf('--env')
const envFile = envAt >= 0 ? args[envAt + 1] : '.env.production.local'
const [backupFile, ...codes] = args.filter((a, i) => a !== '--yes' && (envAt < 0 || (i !== envAt && i !== envAt + 1)))
if (!backupFile || !codes.length) throw new Error('Usage: node scripts/delete-rooms.mjs <backup firestore.json> CODE [CODE…] [--env envFile] [--yes]')

const env = Object.fromEntries(
  fs.readFileSync(envFile, 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)).filter(Boolean)
    .map(m => [m[1], m[2]])
)
const projectId = env.VITE_FIREBASE_PROJECT_ID
const key = env.VITE_FIREBASE_API_KEY
const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
if (backup.projectId !== projectId) throw new Error(`Backup is from "${backup.projectId}" but target is "${projectId}" — refusing`)

const dbRoot = `projects/${projectId}/databases/(default)`
const api = `https://firestore.googleapis.com/v1/${dbRoot}/documents`
const list = async path => {
  const out = []
  let token = ''
  do {
    const r = await fetch(`${api}/${path}?pageSize=300&key=${key}${token ? `&pageToken=${token}` : ''}`)
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
    const j = await r.json()
    out.push(...(j.documents || []).map(d => d.name))
    token = j.nextPageToken || ''
  } while (token)
  return out
}
const del = async names => {
  for (let i = 0; i < names.length; i += 400) {
    const r = await fetch(`${api}:commit?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: names.slice(i, i + 400).map(n => ({ delete: n })) }),
    })
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
  }
}

const plan = []
for (const code of codes) {
  const inBackup = Object.keys(backup.docs).filter(p => p.startsWith(`rooms/${code}/expenses/`)).length
  const hasRoomDoc = !!backup.docs[`rooms/${code}`]?.fields
  if (!hasRoomDoc && !inBackup) throw new Error(`${code} is not in the backup — refusing`)
  const exp = await list(`rooms/${code}/expenses`)
  if (exp.length !== inBackup) throw new Error(`${code}: ${exp.length} expenses now vs ${inBackup} in backup — changed since backup, refusing`)
  plan.push({ code, name: backup.docs[`rooms/${code}`]?.fields?.name?.stringValue || '(no room doc)', expenses: exp.length, exp })
}
if (go) for (const p of plan) { await del(p.exp); await del([`${dbRoot}/documents/rooms/${p.code}`]) }

console.log(JSON.stringify({ projectId, backup: backupFile, deleted: go, rooms: plan.map(({ exp, ...p }) => p) }, null, 1))
