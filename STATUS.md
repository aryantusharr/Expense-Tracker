# SplitEase — status (read this first)

_Last updated: 26 Oct 2026. Keep this under about 45 lines; move history to `LOG.md`._

## The app
- **SplitEase v3.0.0 (build 132) is LIVE** at https://splitease-7bb6c.web.app (Firebase Hosting, project `splitease-7bb6c`, 3 real users, 4 rooms).
- PWA expense tracker: shared rooms (roommate splits, balances, settlements) and personal rooms (budget). Installed on the designer's iPhone 13 Pro as a Home-Screen app.
- Stack: React 19 + Vite 8 + Firestore (no sign-in; the room code is the key) + Framer Motion. Working rules in `AGENTS.md`.
- Code: GitHub `aryantusharr/Expense-Tracker` (public). Working branch `redesign`; `main` was fast-forwarded to the v3.0.0 release and is protected; tag `v3.0.0`.
- Tests: `npm test` → 269 pass. Lint is clean. Build and deploy run on the designer's Mac (the `node_modules` there are macOS builds).

## What shipped in v3
- Full visual redesign (dark + light), all screens: onboarding, dashboard, add expense (Quick + Items), history, settings, import/export.
- **Aryan AI (AAI)**: chat assistant that ADDS expenses from typed text or bill screenshots (Gemini through Firebase AI Logic + App Check, free tier with a spare model). Past chats, errors as replies, per-member app-opens heatmap. Guide: `docs/AAI.md`.
- Amounts use the in-app keypad; text fields use the phone's keyboard. Version/What's-new system. Learned categories.

## Environments (never mix them)
- Live: `splitease-7bb6c` — touch only with the designer's explicit "yes" per step, after a fresh backup.
- Test: `splitease-test-2026` + `phone-test` preview — kept on purpose. All dev and testing here.

## Open items
See "Open" in `PLAN.md`. Right now: rules hardening; optional AI-monitoring switch-off; split the oversized files; choose the next round of work.

## Recent changes (since the last full refresh, 26 Oct 2026)
_One line per session; emptied at each full refresh. If this list is long, the rest of this file may be slightly behind._
- 26 Oct · **v3.0.1 is built and pushed but NOT live yet** (version bumped, release notes written, `dist/` built). Next step: on the designer's Mac, with the designer's yes, run the hosting deploy in `AGENTS.md` → Releasing. Then tag `v3.0.1` and do the full refresh.
- 26 Oct · Process change: Claude Code is no longer used. Rules moved from `CLAUDE.md` to the tool-neutral `AGENTS.md`; any AI coding assistant on the designer's Mac can build and deploy. The free Claude account keeps brainstorming from `BRIEF.md` + `STATUS.md`.
- 26 Oct · Fixed: Taxes & charges no longer added twice and old duplicates heal themselves; the Settings budget sheet has a numpad; the Dashboard bars show all months (scroll, plus a Months/Years switch above 12 months). The "Pay … to settle up" line on the You-owe card is now "Last · Paid ₹… for … · day", and the Balances cards no longer show it; the header no longer says Shared / x roommates. Checked by tests (269 pass), lint and a build only — not yet looked at on a phone, not live.

## Bugs (open) — logged 26 Oct 2026
Format: what happens · where · cause if known · next step. "FIX" = clear, can be built now on the test project. "BRAINSTORM" = needs a design decision first.
1. ✅ FIXED on `redesign` (not live) **Taxes & charges category appears many times** · Settings categories / pickers · cause found: `AaiChat.jsx` adds the category on every bill save that uses it, without checking the room already has it · FIX (code), plus decide about cleaning rooms that already have duplicates (live data needs the designer's yes + backup).
2. ✅ FIXED on `redesign` (not live) **Balances graph shows only the last 6 months** · Dashboard · cause found: `monthWindow()` in `dashboardData.js` is hard-limited to 6 months (the PDF report relies on the same limit) · FIX once the display is chosen (scroll sideways, compress, or by year).
3. ✅ FIXED on `redesign` (not live) **"Pay ___ to settle up" line** · Dashboard You owe / You're owed card · replace with "Last · Paid ₹2xx for ____ · Yesterday" and remove that line from the Balances cards (text lives in `parts/Shared.jsx`) · FIX once the exact wording and the Balances-card result are confirmed.
4. **Month card should show the person's Paid and Share for that month** · History · BRAINSTORM (what to show, where, for shared vs personal rooms).
5. **Search mutes other items instead of showing only matches** · History · BRAINSTORM (filter vs highlight, how totals behave).
6. ✅ FIXED on `redesign` (not live) **Personal room: budget can't be set** · Settings > Monthly budget sheet · cause found: the sheet only has +/− ₹500/₹1000 buttons and no numpad (the setup screen does have one) · FIX (tap the amount to open the numpad, keep the steps).

## Changes requested — 26 Oct 2026
1. Smart settlements cards stacked · Dashboard · BRAINSTORM + redesign.
2. "Not logged" section · Dashboard · BRAINSTORM + redesign.
3. ✅ FIXED on `redesign` (not live) Remove the "Shared" and "x roommates" texts under the room name · Dashboard header (the LIVE/OFFLINE dot stays).

## Known risks
- **Gemini free tier**: about 20 bill reads/day per model (main + spare). When both are used up the chat shows the LIMIT reply and the user types items instead. Options to weigh: watch usage, add another fallback, or move to a paid tier.
- **Firestore rules hardening (open)**: (1) `roomNames` entries can be deleted by anyone (`allow delete: if true`, `firestore.rules` line 64); (2) expense and opens writes only check the room-code format, not that the room exists (lines 46 and 53). Fix goes through the test project first; live rules deploy needs the designer's yes and a fresh backup.

## Known quirks
- Live app verified on the designer's iPhone on 26 Oct 2026 (rooms, add/delete a test expense, Aryan AI). Phase 5 is closed.
- Some AAI logic files are tested but not used by the chat UI any more: `src/aai/chips.js`, `src/aai/commands.js` (kept for now; see `docs/AAI.md`).

## Where things are
- Folder map: `ARCHITECTURE.md` · design: `docs/SplitEase-Design-System.md` · AAI: `docs/AAI.md` · checklist: `PLAN.md` · history: `LOG.md` · for the brainstorming account: `BRIEF.md` (one-time setup: `docs/FREE-ACCOUNT-SETUP.md`).
