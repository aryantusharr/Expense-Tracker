# SplitEase redesign — build plan (living document; propose changes freely)

## Phase 0 · Setup
- [ ] Clear leftover .git/index.lock (from the old tool); `git status` clean
- [ ] Install tools: Homebrew (if missing), Node LTS, firebase-tools, gh (optional)
- [ ] Confirm GitHub push works (she's logged in on this Mac)
- [ ] Firebase sign-in via `firebase login --no-localhost` (URL + code, opened in the built-in browser) — or a service-account key if that's smoother
- [ ] `npm install`, `npm run dev` works locally

## Phase 1 · Safety net
- [ ] Local JSON backup of all live Firestore collections (read-only script) → backups/ (git-ignored)
- [ ] Check live Firestore security rules (not in repo — no auth in app) and report risks
- [ ] Create test Firebase project (e.g. splitease-test), web app, Firestore; `.env.test`; `.firebaserc` alias `test`
- [ ] Copy backup into the test project so real-shaped data can be tested
- [ ] `redesign` branch

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
- [ ] Fresh backup → merge to main → bump SW cache → `firebase deploy --only hosting` to splitease-7bb6c
- [ ] Verify on her phone; tell the other 2 users to close + reopen the app
- [ ] Rollback ready: `firebase hosting:rollback` / re-deploy previous release
- [ ] Ask her, then delete the test Firebase project

## Log
- 2026-10-01 · Design finalised on the canvas (all screens + motion system). Plan written.
