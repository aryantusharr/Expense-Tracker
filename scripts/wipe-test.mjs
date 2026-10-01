// Delete EVERY room (and its subcollections) from the TEST Firestore project, so
// scripts/restore-to-test.mjs can then put back a clean anonymised copy.
// Usage: node scripts/wipe-test.mjs --yes      (without --yes it only counts what it would delete)
// Target comes from .env.test.local. Refuses to run against the live project.
import fs from 'node:fs'

const LIVE_PROJECT_ID = 'splitease-7bb6c'
const env = Object.fromEntries(
  fs.readFileSync('.env.test.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)).filter(Boolean)
    .map(m => [m[1], m[2]])
)
const projectId = env.VITE_FIREBASE_PROJECT_ID
if (!projectId || projectId === LIVE_PROJECT_ID || !/test/i.test(projectId)) {
  throw new Error(`Refusing to wipe: target project is "${projectId}" (must be the test project)`)
}
const key = env.VITE_FIREBASE_API_KEY
const dbRoot = `projects/${projectId}/databases/(default)`
const api = `https://firestore.googleapis.com/v1/${dbRoot}/documents`
const go = process.argv.includes('--yes')

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
    const r = await fetch(`https://firestore.googleapis.com/v1/${dbRoot}/documents:commit?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: names.slice(i, i + 400).map(delete_ => ({ delete: delete_ })) }),
    })
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
  }
}

const rooms = await list('rooms')
let expenses = 0
for (const room of rooms) {
  const rel = room.split('/documents/')[1]
  const exp = await list(`${rel}/expenses`)
  expenses += exp.length
  if (go) { await del(exp); await del([room]) }
}
console.log(JSON.stringify({ projectId, rooms: rooms.length, expenses, deleted: go }, null, 1))
