# SplitEase — status (read this first)

_Last updated: 26 Oct 2026. Keep this under about 45 lines; move history to `LOG.md`._

## The app
- **SplitEase v3.0.0 (build 132) is LIVE** at https://splitease-7bb6c.web.app (Firebase Hosting, project `splitease-7bb6c`, 3 real users, 4 rooms).
- PWA expense tracker: shared rooms (roommate splits, balances, settlements) and personal rooms (budget). Installed on the designer's iPhone 13 Pro as a Home-Screen app.
- Stack: React 19 + Vite 8 + Firestore (no sign-in; the room code is the key) + Framer Motion. Details in `CLAUDE.md`.
- Code: GitHub `aryantusharr/Expense-Tracker` (public). Working branch `redesign`; `main` was fast-forwarded to the v3.0.0 release and is protected; tag `v3.0.0`.
- Tests: `npm test` → 261 pass. Lint is clean. A build needs the designer's Mac (the `node_modules` there are macOS builds).

## What shipped in v3
- Full visual redesign (dark + light), all screens: onboarding, dashboard, add expense (Quick + Items), history, settings, import/export.
- **Aryan AI (AAI)**: chat assistant that ADDS expenses from typed text or bill screenshots (Gemini through Firebase AI Logic + App Check, free tier with a spare model). Past chats, errors as replies, per-member app-opens heatmap. Guide: `docs/AAI.md`.
- Amounts use the in-app keypad; text fields use the phone's keyboard. Version/What's-new system. Learned categories.

## Environments (never mix them)
- Live: `splitease-7bb6c` — touch only with the designer's explicit "yes" per step, after a fresh backup.
- Test: `splitease-test-2026` + `phone-test` preview — kept on purpose. All dev and testing here.

## Open items
See "Open" in `PLAN.md`. Right now: rules hardening; optional AI-monitoring switch-off; split the oversized files; choose the next round of work.

## Known risks
- **Gemini free tier**: about 20 bill reads/day per model (main + spare). When both are used up the chat shows the LIMIT reply and the user types items instead. Options to weigh: watch usage, add another fallback, or move to a paid tier.
- **Firestore rules hardening (open)**: (1) `roomNames` entries can be deleted by anyone (`allow delete: if true`, `firestore.rules` line 64); (2) expense and opens writes only check the room-code format, not that the room exists (lines 46 and 53). Fix goes through the test project first; live rules deploy needs the designer's yes and a fresh backup.

## Known quirks
- Live app verified on the designer's iPhone on 26 Oct 2026 (rooms, add/delete a test expense, Aryan AI). Phase 5 is closed.
- Some AAI logic files are tested but not used by the chat UI any more: `src/aai/chips.js`, `src/aai/commands.js` (kept for now; see `docs/AAI.md`).

## Where things are
- Folder map: `ARCHITECTURE.md` · design: `docs/SplitEase-Design-System.md` · AAI: `docs/AAI.md` · checklist: `PLAN.md` · history: `LOG.md` · for the brainstorming account: `BRIEF.md` (one-time setup: `docs/FREE-ACCOUNT-SETUP.md`).
