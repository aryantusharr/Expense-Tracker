# SplitEase redesign — build plan (living document; propose changes freely)

## Phase 0 · Setup ✅
- [x] Cleared leftover .git/index.lock; `redesign` branch created
- [x] Tools: Homebrew + Node 24 were present; firebase-tools 15.32 installed (gh skipped until PR time)
- [x] GitHub push works (re-authed via `gh` device code; account aryantusharr = hers)
- [x] Firebase CLI signed in as himanshu12.hk@gmail.com (she confirmed this is the account to use)
- [x] `.env` untracked (was public on GitHub); live settings now in `.env.production.local` (git-ignored, used only by `npm run build`)
- [x] Test project `splitease-test-2026` created: web app, Firestore (nam5/US — live is asia-south2; fine for testing), open test rules expiring 2027-01-01 (`firestore.test.rules`, deployed via `firebase.test.json`)
- [x] `.firebaserc`: default + `test` → test project; live only via `--project live`
- [x] `.env.development.local` / `.env.test.local` → test project; `vite.config.js` guard refuses dev/test mode pointed at live
- [x] `npm install`, `npm run dev -- --host` works (launch config `splitease-dev`), verified it talks only to the test project

## Phase 1 · Safety net ✅
- [x] Live backup (read-only, via a temporary service-account key she created; key revoked + binned): `backups/splitease-7bb6c-2026-10-01T01-22-25/firestore.json` — 11 rooms, 5,476 expenses, 69 `learned_patterns` (unused). Script: `scripts/backup-firestore.mjs`
- [x] Live rules checked: fully open (`allow read, write: if true`) + config is public → anyone can read/change/delete everything. Fix planned below (Phase 5), needs her yes.
- [x] Test data: real rooms anonymised (`scripts/anonymise-backup.mjs` → names/descriptions/groups → "Test …"; amounts, dates, categories, splits, sync links kept) and copied to test (`scripts/restore-to-test.mjs`, refuses raw data + live). Raw real data never leaves live.
- Test room codes: D4NYY3 = Test Room 3 (C53 copy, 1,181 exp), NCRY97 = Test Room 4; personal: N4EWMU, W6LTVB, MB739V

## Phase 2 · Build (order is a suggestion)
- [x] Foundations (preview: /foundations — dev/test builds only): `src/styles/tokens.css` (--se-* colours dark/light, Sora/Unbounded/JetBrains Mono self-hosted via @fontsource, radii, motion tokens, reduce-motion), `src/styles/motion.css` (pop/print/stamp/tear/sheet/shake, orbs), `src/styles/ui.css`, `src/components/ui/` (Button, IconButton, Chip, Sheet, Toast/useToast, CategoryIcon), `src/design/categoryIcons.js` (32 A-line icons + name/emoji → icon mapping; stored emoji unchanged), `src/utils/haptics.js`
  - 4 extra icons added on the canvas (Smoking, Weed, Saving, Gadgets) → 36 icons
  - Screen-specific icons (nav, header, etc.) and signature moves get built with their screens
- [ ] Onboarding (landing w/ orbit keys + ⚙ room sheet, create chat, share postcard + sync setup, join paper strip + keypad, personal chat + join by code)
- [x] Dashboard (shared + personal) — `src/components/dashboard/DashboardScreen.jsx` + `parts/`, data in `dashboardData.js` (reuses splitCalculator / settlementEngine, read-only). New FloatingNav replaces BottomNav everywhere (old Add screen keeps the nav until Add is rebuilt — it has no back button). Checked dark + light, shared + personal on test data.
  - Her decisions (1 Oct): keep current (empty) month on the 1st; budget status ON TRACK / NEARLY THERE (≥85%, amber) / OVER BUDGET; nav should NOT be forced to the Dashboard version everywhere — follow each screen's own board (confirm when building Settings); light orbs keep the board's alpha (.34/.26/.2, spec says .22/.18/.14 — not decided). "NOT LOGGED" = no payment dated today
  - Cleanup later: chart.js + react-chartjs-2 now unused
- [~] Add Expense — built in 3 chunks (new code in `src/components/add/`; logic in `useAddController.js`, helpers moved unchanged to `addHelpers.js`; old `expenses/AddExpense.jsx` stays until Items is ported, then delete)
  - [x] Chunk 1 · Quick mode: amount card with odometer, custom keypad (expressions), +₹ chips, recurring chips, slips strip (payer flip, seats, ₹ slips), description, categories (AUTO), date strip, slide-to-add with validation, Quick⇄Items pill + swipe, personal variant, dark + light. Nav hidden on /add (close button added). Items tab is a placeholder for now.
  - [x] Chunk 2 · Items mode (`ItemsPane.jsx`): NEW BILL receipt paper (zigzag edge, dotted leaders, ink stamps, initials), Bill name + Total (+ recent bill-name chips, payer/seats strip), item panel (auto-category, remaining pre-filled), Print to receipt, LEFT TO SPLIT / FULLY SPLIT, slide to add via `addItemisedExpenseGroup`. One payer per bill (her decision). Old `expenses/AddExpense.jsx` deleted. Checked personal MB739V (saved a 2-item test bill) + shared D4NYY3 setup screen, dark. Not yet: light mode check, on-phone check
  - [ ] Chunk 3 · Save moment: printer slot buzz → stutter print → receipt flies to History, nav bounce, "+1" (needs the nav on /add or a History target)
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
- [ ] Tighter live rules (no bulk listing, rooms only by code, no room deletes, lock learned_patterns) + tweak `checkRoomNameExists` query; test on the test project first
- [ ] Fresh backup → merge to main → bump SW cache → `firebase deploy --only hosting --project live`
- [ ] Verify on her phone; tell the other 2 users to close + reopen the app
- [ ] Rollback ready: `firebase hosting:rollback` / re-deploy previous release
- [ ] Ask her, then delete the test Firebase project

## Log
- 2026-10-01 · Design finalised on the canvas (all screens + motion system). Plan written.
- 2026-10-01 · Phase 0 done. Test project splitease-test-2026; env split + live guard; dev server runs against test. Test preview builds: `npm run build:test` then `firebase deploy --config firebase.test.json --only hosting:… --project test` (preview channel: `firebase hosting:channel:deploy <name> --config firebase.test.json --project test`).
- 2026-10-01 · Phase 1 done. Backup taken; live rules found fully open; anonymised copy of real rooms in test project, verified in the app (Test Room 3 shows balances).
- 2026-10-01 · Phase 2 foundations built and checked in the browser (dark + light, sheet, toast, icons); old screens untouched (new styles are --se-* / .se-* only).
- 2026-10-01 · Dashboard rebuilt (shared + personal) + floating nav; 36 category icons.
- 2026-10-01 · Add Expense chunk 1 (Quick mode) built + checked on test rooms D4NYY3 (shared) / MB739V (personal), dark + light. Saved a real test expense OK. Category starts unpicked (per spec); recent-description chips kept under the field.
- 2026-10-01 · Add Expense chunk 2 (Items mode) built; old AddExpense.jsx removed. Stamps on receipt lines reuse the line-icon glyph in ink (not the worn feTurbulence stamp yet).
