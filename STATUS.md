# SplitEase — status (read this first)

_Last updated: 26 Oct 2026 (v3.0.5 release). Keep this under about 45 lines; move history to `LOG.md`._

## The app
- **SplitEase v3.0.5 (build 146) is LIVE** (26 Oct 2026; v3.0.4 build 143 before it) at https://splitease-7bb6c.web.app (Firebase Hosting, project `splitease-7bb6c`, 3 real users, 4 rooms).
- PWA expense tracker: shared rooms (roommate splits, balances, settlements) and personal rooms (budget). Installed on the designer's iPhone 13 Pro as a Home-Screen app.
- Stack: React 19 + Vite 8 + Firestore (no sign-in; the room code is the key) + Framer Motion. Working rules in `AGENTS.md`.
- Code: GitHub `aryantusharr/Expense-Tracker` (public). Working branch `redesign`; `main` was fast-forwarded to the v3.0.0 release and is protected; tags `v3.0.0`, `v3.0.3`, `v3.0.4`, `v3.0.5` (3.0.1 and 3.0.2 were never live).
- Tests: `npm test` → 278 pass. Lint is clean. Build and deploy run on the designer's Mac (the `node_modules` there are macOS builds).

## What shipped in v3
- Full visual redesign (dark + light), all screens: onboarding, dashboard, add expense (Quick + Items), history, settings, import/export.
- **Aryan AI (AAI)**: chat assistant that ADDS expenses from typed text or bill screenshots (Gemini through Firebase AI Logic + App Check, free tier with a spare model). Past chats, errors as replies, per-member app-opens heatmap. Guide: `docs/AAI.md`.
- Amounts use the in-app keypad; text fields use the phone's keyboard. Version/What's-new system. Learned categories.

## What shipped in v3.0.4–3.0.5 (26 Oct 2026)
- 3.0.5: the pill shows for everyone — owe, owed (under the sentence) and all square — and replaces the personal room's Last paid card (synced copies get a "synced from … · edit it there" line).
- Hero: the last payment is a glass pill (LAST PAID ₹ · animated category icon · name) with a magnifier date reel (TODAY/YESTERDAY/date → date or "N DAYS AGO" → weekday). Code: `dashboard/parts/LastPaidPill.jsx`, `reelFaces()` in `dashboardData.js`.
- Category icons have their own small motion: `MotionIcon` in `ui/CategoryIcon.jsx`, rules in `design/categoryMotion.js`, CSS `styles/categoryMotion.css` (reduced motion = still). Canvas boards: Final app → "Last paid · L2 + N4 magnifier" and "System · Category icons · motion".

## What shipped in v3.0.3 (26 Oct 2026, everything since 3.0.0)
- Dashboard: graph shows every month (scroll, Months/Years switch); You-owe card shows the last payment (no name icon in front); header has no Shared / roommate count; Smart settlements are a deck (tap to fan, no Settle).
- History: month card PAID/SHARE (personal: BUDGET/LEFT); search lists only matches from every month, month chips + date dropdown, dates searchable.
- Fixed: Taxes & charges added twice (old duplicates heal); Settings budget sheet has a numpad.
- What's new lists all of the above (3.0.1 and 3.0.2 were skipped on live).

## Environments (never mix them)
- Live: `splitease-7bb6c` — touch only with the designer's explicit "yes" per step, after a fresh backup.
- Test: `splitease-test-2026` + `phone-test` preview — kept on purpose. All dev and testing here.

## Open items
See "Open" in `PLAN.md`. Right now: rules hardening; optional AI-monitoring switch-off; split the oversized files; choose the next round of work.

## Recent changes (since the last full refresh, 26 Oct 2026)
_One line per session; emptied at each full refresh. If this list is long, the rest of this file may be slightly behind._
- 26 Oct · A "Test App" page on the canvas opens the current build with test data (no live database); rebuilt from the code on request.

## Bugs and change requests of 26 Oct 2026
All six bugs and change requests 1 and 3 are fixed and LIVE in v3.0.3. Change 2 ("Not logged" redesign) was dropped. No open bugs known.

## Known risks
- **Gemini free tier**: about 20 bill reads/day per model (main + spare). When both are used up the chat shows the LIMIT reply and the user types items instead. Options to weigh: watch usage, add another fallback, or move to a paid tier.
- **Firestore rules hardening (open)**: (1) `roomNames` entries can be deleted by anyone (`allow delete: if true`, `firestore.rules` line 64); (2) expense and opens writes only check the room-code format, not that the room exists (lines 46 and 53). Fix goes through the test project first; live rules deploy needs the designer's yes and a fresh backup.

## Known quirks
- Live app verified on the designer's iPhone on 26 Oct 2026 (rooms, add/delete a test expense, Aryan AI). Phase 5 is closed.
- Some AAI logic files are tested but not used by the chat UI any more: `src/aai/chips.js`, `src/aai/commands.js` (kept for now; see `docs/AAI.md`).

## Where things are
- Folder map: `ARCHITECTURE.md` · design: `docs/SplitEase-Design-System.md` · AAI: `docs/AAI.md` · checklist: `PLAN.md` · history: `LOG.md` · for the brainstorming account: `BRIEF.md` (one-time setup: `docs/FREE-ACCOUNT-SETUP.md`).
