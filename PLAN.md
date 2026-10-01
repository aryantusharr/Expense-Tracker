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
- [~] Onboarding — new code in `src/components/onboarding/` (shared bits: `OnboardingBits.jsx`, `Onboarding.css`, `onboardingData.js`)
  - [x] Chunk 1 · Landing (`LandingScreen.jsx`: brand band + floating slips, glass room list with balance/budget read from the offline caches, ⚙ gear sheet: Open / Copy code / Delete for everyone (confirm card) / Remove from this device, orbit keys) + Join (`JoinScreen.jsx`: paper strip, own 32-key keypad, Paste, ⌫, NO ROOM / SHARED ROOM / PERSONAL / OFFLINE stamps + shake, ADMIT + punched holes, "Enter <room>"; personal mode via `navigate('/join', {state:{mode:'personal'}})`; `/join/:code` links prefill + check). Old LandingPage/JoinRoom deleted. Toasts accept `top: true`. Built, lint + build clean, NOT yet tested (her call: test after all of onboarding).
  - [x] Chunk 2 · `CreateScreen` (chat: count 2–6 → room name [TAKEN stamp + "Join X instead"] → your name → roommate names → "Invite roommates →"; creator saved as this phone's identity), `ShareScreen` (cream postcard, COPIED stamp, Copy/Share, sync sheet → who are you + which personal room → SYNC SET UP receipt / SYNC ON; "Not now" toast), `PersonalScreen` (name → budget chips or typed amount → "Start tracking →" lands on the Dashboard; "I already have a code" → Join in personal mode). Shared: `ChatScreen`, `useChat`. Old setup/ folder + Setup.css deleted; app loading screen restyled. Built + lint/build clean, NOT tested yet.
  - [ ] Her test pass for all of onboarding (then fix list)
- [x] Dashboard (shared + personal) — `src/components/dashboard/DashboardScreen.jsx` + `parts/`, data in `dashboardData.js` (reuses splitCalculator / settlementEngine, read-only). New FloatingNav replaces BottomNav everywhere (old Add screen keeps the nav until Add is rebuilt — it has no back button). Checked dark + light, shared + personal on test data.
  - Her decisions (1 Oct): keep current (empty) month on the 1st; budget status ON TRACK / NEARLY THERE (≥85%, amber) / OVER BUDGET; nav should NOT be forced to the Dashboard version everywhere — follow each screen's own board (confirm when building Settings); light orbs keep the board's alpha (.34/.26/.2, spec says .22/.18/.14 — not decided). "NOT LOGGED" = no payment dated today
  - Cleanup later: chart.js + react-chartjs-2 now unused
- [~] Add Expense — built in 3 chunks (new code in `src/components/add/`; logic in `useAddController.js`, helpers moved unchanged to `addHelpers.js`; old `expenses/AddExpense.jsx` stays until Items is ported, then delete)
  - [x] Chunk 1 · Quick mode: amount card with odometer, custom keypad (expressions), +₹ chips, recurring chips, slips strip (payer flip, seats, ₹ slips), description, categories (AUTO), date strip, slide-to-add with validation, Quick⇄Items pill + swipe, personal variant, dark + light. Nav hidden on /add (close button added). Items tab is a placeholder for now.
  - [x] Chunk 2 · Items mode (`ItemsPane.jsx`): NEW BILL receipt paper (zigzag edge, dotted leaders, ink stamps, initials), Bill name + Total (+ recent bill-name chips, payer/seats strip), item panel (auto-category, remaining pre-filled), Print to receipt, LEFT TO SPLIT / FULLY SPLIT, slide to add via `addItemisedExpenseGroup`. One payer per bill (her decision). Old `expenses/AddExpense.jsx` deleted. Checked personal MB739V (saved a 2-item test bill) + shared D4NYY3 setup screen, dark. Not yet: light mode check, on-phone check
  - [x] Chunk 3 · Save moment (`SaveMoment.jsx`, portal overlay, used by Quick + Items): slot buzz → 4-stop stutter print (3s) → receipt flies to bottom-centre → "+1" → fresh form. Tap skips the print. Add stays on Add after the save moment (her call, 1 Oct: no auto-landing on History). Checked on test room D4NYY3 Items flow; Quick path uses the same component (not clicked through)
- [x] History (`src/components/history/`: `HistoryScreen.jsx`, `MonthStack.jsx`, `Rows.jsx` (TearRow / ExpenseCard / BillCard), `EditSheet.jsx`, `EmptyHistory.jsx`, `historyData.js`, `History.css`). Old `expenses/ExpenseList` + `EditExpenseModal` + `SwipeableItem` deleted (`expenses/Expenses.css` kept — `ConfirmModal` still imports it; remove with the cleanup phase).
  - Built from boards App-History / -Personal / Hist-Empty / 4f / 6b / 8b. Month stack (tap → fan → pick), sticky bar on scroll, search grows + filter chips (payer / category) with orb tint + dimming, tear delete with Undo (real Firestore delete waits ~4.7s so Undo never recreates a doc; flushed on leaving the screen), receipt-style edit sheet, bills print downward (2.4s, 4 stops), synced rows in personal rooms are locked (COPY stamp, shake + toast), empty state.
  - Not done / decisions: editing a bill line opens the same receipt sheet (with a BILL name line) — NOT the Add Items screen pre-filled as the spec says (would need Add changes; propose later). Month net = paid − share for the person chosen on this phone (hidden if no identity picked). Personal rooms hide PAID BY / SPLIT in the edit sheet.
- [~] Settings — built in 3 chunks (`src/components/settings/SettingsScreen.jsx`, `CategoriesSection.jsx`, `SettingsScreen.css`)
  - [x] Chunk 1 · room ID card (members, personal budget bar → budget sheet), join-code receipt (COPIED stamp + toast), Categories (counts, bin → inline confirm → tear, ⋮⋮ lift/swap, add/edit sheet with the 36 icons, stored as `line:<key>`), Appearance pull-cord + circular wipe, Room rows (switch room, rename sheet). Old `SettingsPage` + `CategoryManager` deleted. NOT tested yet. Deleting a category does NOT rewrite expenses (same as before) — they show under Other; the board says "move to Other" (decide if a real move is wanted).
  - [ ] Chunk 2 · Profile sync pill (in the room card) + S3 sheets (info/change/turn off, 3-step setup). Until then the OLD `SyncSettings` card still shows under the join code.
  - [ ] Chunk 3 · Data: export scope → report receipt print → PDF/Excel (with Exports phase), import wizard (S6). Until then the OLD `DataManagement` still shows.
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
- 2026-10-01 · Add Expense chunk 3 (save moment) built. Add Expense is feature-complete; remaining: her phone check + light mode.
- 2026-10-01 · Add polish pass: worn-edge stamps (feTurbulence) on receipt lines, 'Who paid?' sheet when a room has 5+ people (3–4 still flip), light mode checked on Items. Payer sheet not exercised (test rooms have 3 people).
- 2026-10-01 · Add fixes after her review: slide only saves on a full drag (tap never saves); saves can't hang (8s timeout → treated as saved, Firestore syncs later; also passes cached expenses so a save no longer re-reads the whole collection); print is now 4 real stutter stops ~1.7s (whole moment ≈3.5s, was ≈5.3s); save overlay shows the real nav, receipt flies into History, nav bounce + History icon pop + '+1'; amount-page slips strip rebuilt to board (paper PAID BY bill, ₹ plates beside seats, 'PAID BY · SPLIT' + '₹40 EACH · 3'). Not done: Items panel uses the same strip, the board shows a round 'island' variant there.
- 2026-10-01 · Save moment rebuilt to the board (App-Add-Expense, keyframe printS): printer slot pill at the bottom ('PRINTING…', buzz) → paper slides UP out of the slot in 4 stops with twitch + brightness flash (2.8s) → at 3.0s nav slides in and receipt flies to History (.85s) → nav bounce, History pop, '+1' badge. Receipt content per board (title, date · 'X PAID', stamped lines, SPLIT n WAYS, TOTAL, ✓ ADDED TO room, barcode). Styles in SaveMoment.css. Whole moment ≈4.8s (tap during print skips to the flight). Dev tip: browser pane cached old Add.css — restart dev server if styles look stale.

- 2026-10-01 · History built + checked on test rooms D4NYY3 (shared) and MB739V (personal), dark + light, empty state (forced). Add save → History landing wired (saved a 'Test light check' expense in MB739V). Light-mode pass on Add Quick vs board: amount card (bg/border/shadow), ₹ + digit gradient colours, sheen, odometer digit clipping (0 was cut off in both themes) and the save-overlay scrim (.28 in light) fixed; dark amount card also moved to the board's values.

- 2026-10-01 · Onboarding chunk 1 built (Landing + Join), untested by design. Create/Share/Personal still the old screens until chunk 2.
- 2026-10-01 · Onboarding chunk 2 built (Create, Share + sync, Personal); old setup/ screens removed. Untested by design — her test pass next.
- 2026-10-01 · Settings chunk 1 built (untested by design). Old sync + data cards still in place, restyled in chunks 2–3.
