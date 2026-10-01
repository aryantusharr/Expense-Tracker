# SplitEase redesign — build plan (living document; propose changes freely)

## Phase 0 · Setup ✅
- [x] Cleared leftover .git/index.lock; `redesign` branch created
- [x] Tools: Homebrew + Node 24 were present; firebase-tools 15.32 installed (gh skipped until PR time)
- [x] GitHub push works (account aryantusharr = hers)
- [x] Firebase CLI signed in as himanshu12.hk@gmail.com (she confirmed this is the account to use)
- [x] `.env` untracked (was public on GitHub); live settings now in `.env.production.local` (git-ignored, used only by `npm run build`)
- [x] Test project `splitease-test-2026` created: web app, Firestore (nam5/US — live is asia-south2; fine for testing), open test rules expiring 2027-01-01 (`firestore.test.rules`, deployed via `firebase.test.json`)
- [x] `.firebaserc`: default + `test` → test project; live only via `--project live`
- [x] `.env.development.local` / `.env.test.local` → test project; `vite.config.js` guard refuses dev/test mode pointed at live
- [x] `npm install`, `npm run dev -- --host` works (launch config `splitease-dev`), verified it talks only to the test project

## Phase 1 · Safety net
- [ ] Local JSON backup of all live Firestore collections (read-only script) → backups/ (git-ignored)
- [ ] Check live Firestore security rules (not in repo — no auth in app) and report risks
- [ ] Copy backup into the test project so real-shaped data can be tested

## Phase 2 · Build (order is a suggestion)
- [ ] Foundations: CSS tokens (colours dark/light, type: Sora / Unbounded / JetBrains Mono, radius, glass), 32 A-line icons, motion tokens + reduced motion, buttons/chips/sheets/toasts
- [ ] Onboarding (landing w/ orbit keys + ⚙ room sheet, create chat, share postcard + sync setup, join paper strip + keypad, personal chat + join by code)
- [ ] Dashboard (shared + personal)
- [ ] Add Expense (Quick ⇄ Items, slips, receipt print save)
- [ ] History (month stack, search/filters, printing bills, tear delete + undo, receipt edit)
- [ ] Settings (room card, sync pill, join-code receipt, categories, pull-cord theme, export, import wizard, budget)
- [ ] Exports: PDF magazine report (embed fonts for ₹), styled Excel (xlsx-js-style), toasts instead of alert()
- [ ] Cleanup: dead code, emoji iconography, a11y labels

## Phase 3 · iPhone testing
- Day-to-day: `npm run dev -- --host` → open http://<mac-ip>:5173 on the iPhone (same Wi-Fi), pointed at the TEST project. Instant reloads; no PWA install/offline/clipboard (needs HTTPS).
- Full PWA check: deploy to a Firebase preview channel on the TEST project → HTTPS link, Add to Home Screen, offline, copy/share.
- [ ] Her test pass: every screen, dark + light, shared + personal, offline

## Phase 4 · Data check
- [ ] Real-shaped data in test project renders correctly: balances, settlements, synced entries, itemised groups, budgets

## Phase 5 · Go live (only with her explicit yes)
- [ ] Fresh backup → merge to main → bump SW cache → `firebase deploy --only hosting --project live`
- [ ] Verify on her phone; tell the other 2 users to close + reopen the app
- [ ] Rollback ready: `firebase hosting:rollback` / re-deploy previous release
- [ ] Ask her, then delete the test Firebase project

## Log
- 2026-10-01 · Design finalised on the canvas (all screens + motion system). Plan written.
- 2026-10-01 · Phase 0 done. Test project splitease-test-2026; env split + live guard; dev server runs against test. Test preview builds: `npm run build:test` then `firebase deploy --config firebase.test.json --only hosting:… --project test` (preview channel: `firebase hosting:channel:deploy <name> --config firebase.test.json --project test`).
