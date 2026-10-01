// Make an anonymised copy of a backup for the TEST project.
// Usage: node scripts/anonymise-backup.mjs <backup firestore.json>
// Writes firestore.anon.json next to it. Keeps amounts, dates, categories, splits, item groups,
// sync links and IDs; replaces every person name, room name, description and group name with
// consistent "Test …" values (the same real value always maps to the same test value).
// Only rooms + expenses are kept (learned_patterns is unused by the app).
import fs from 'node:fs'

const file = process.argv[2]
const backup = JSON.parse(fs.readFileSync(file, 'utf8'))
const docs = backup.docs
const str = v => v?.stringValue

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const mapper = (fmt) => {
  const m = new Map()
  return (real) => {
    const k = (real ?? '').trim().toLowerCase()
    if (!m.has(k)) m.set(k, fmt(m.size))
    return m.get(k)
  }
}
const personName = mapper(i => `Test ${LETTERS[i % 26]}${i >= 26 ? Math.floor(i / 26) : ''}`)
const sharedRoomName = mapper(i => `Test Room ${i + 1}`)
const description = mapper(i => `Test item ${i + 1}`)
const groupName = mapper(i => `Test group ${i + 1}`)

const roomPaths = Object.keys(docs).filter(p => /^rooms\/[^/]+$/.test(p))
const idToName = new Map()
for (const p of roomPaths) {
  for (const u of docs[p].fields?.users?.arrayValue?.values || []) {
    const f = u.mapValue.fields
    idToName.set(str(f.id), personName(str(f.name)))
  }
}

// Room name: personal rooms become "<Test person>'s Expenses", shared rooms "Test Room N".
const roomNameMap = new Map()
for (const p of roomPaths) {
  const f = docs[p].fields || {}
  const real = str(f.name) ?? ''
  const owner = str(f.users?.arrayValue?.values?.[0]?.mapValue?.fields?.name)
  roomNameMap.set(real, f.isPersonal?.booleanValue && owner
    ? `${personName(owner)}'s Expenses`
    : sharedRoomName(real))
}
const roomName = real => roomNameMap.get(real ?? '') ?? sharedRoomName(real)
const person = v => idToName.has(v) ? v : personName(v) // IDs stay; legacy plain names get replaced

const out = {}
for (const [p, d] of Object.entries(docs)) {
  if (!p.startsWith('rooms/') || d.missing) continue
  const f = structuredClone(d.fields || {})
  if (/^rooms\/[^/]+$/.test(p)) {
    if (f.name) f.name = { stringValue: roomName(str(f.name)) }
    for (const u of f.users?.arrayValue?.values || []) {
      const uf = u.mapValue.fields
      const n = personName(str(uf.name))
      uf.name = { stringValue: n }
      uf.avatar = { stringValue: n.slice(5, 6) }
    }
  } else {
    if (f.description) f.description = { stringValue: description(str(f.description)) }
    if (f.groupName) f.groupName = { stringValue: groupName(str(f.groupName)) }
    if (f.syncedFromRoomName) f.syncedFromRoomName = { stringValue: roomName(str(f.syncedFromRoomName)) }
    if (f.paidBy) f.paidBy = { stringValue: person(str(f.paidBy)) }
    for (const x of f.splitAmong?.arrayValue?.values || []) x.stringValue = person(x.stringValue)
  }
  out[p] = { fields: f }
}

const target = file.replace(/firestore\.json$/, 'firestore.anon.json')
fs.writeFileSync(target, JSON.stringify({ anonymised: true, from: backup.projectId, takenAt: backup.takenAt, docs: out }, null, 1))
console.log(JSON.stringify({
  file: target,
  docs: Object.keys(out).length,
  rooms: [...new Set(roomNameMap.values())],
  people: [...new Set(idToName.values())].length,
}, null, 1))
