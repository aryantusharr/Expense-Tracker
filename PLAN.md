# SplitEase — plan (checklist only)

> Short on purpose: this file is read at the start of many sessions. Current state is in `STATUS.md`, dated history in `LOG.md`, full per-phase detail in `docs/archive/PLAN-phases-0-7.md`.

## Finished
- [x] Phase 0 · Setup (branches, test project, env guards)
- [x] Phase 1 · Safety net (live backup, anonymised test data)
- [x] Phase 2 · Build the redesign (foundations, onboarding, dashboard, add expense, history, settings, exports, cleanup)
- [x] Phase 2.5 · Test → fix → cleanup (27 QA items fixed)
- [x] Phase 2.6 · Learned categories
- [x] Phase 3 · iPhone testing
- [x] Phase 4 · Data check (balances, settlements, synced copies)
- [x] Phase 5 · Go live: tighter Firestore rules + new app deployed (1 Oct)
- [x] Phase 6 · Post-launch fixes (in-app keypad for amounts, version system, budget nudge, sync pill)
- [x] Phase 7 · Aryan AI (AAI) chat: text entry, bill reading with Gemini, past chats, app-opens heatmap — live in v3.0.0 (9 Oct)
- [x] Repo tidy-up (README for v3, `npm test`, protected `main`, public repo)
- [x] Docs + code tidy (26 Oct): privacy scrub, STATUS/PLAN/LOG split, dead code removed, architecture map

## Open
- [x] Phase 5 leftover: live app checked on the designer's iPhone (26 Oct: rooms load, add/delete a test expense, Aryan AI opens). The other two users need no manual step; the in-app update toast reloads open apps.
- [ ] Rules hardening: block deleting `roomNames` entries and require the room to exist for expense/opens writes (test project first; live needs the designer's yes + backup)
- [ ] Gemini free-tier limit (about 20 bill reads/day per model): decide how to handle it
- [ ] Optional: switch off AI monitoring in the live console (cost-free either way)
- [ ] Split the oversized files listed in `ARCHITECTURE.md` (one file per commit, tests + build after each)
- [ ] Decide what the next round of fixes or features is (brainstorm → decisions note → here)

## Decided and closed
- [—] Test project `splitease-test-2026` + `phone-test` preview: KEEP until the designer says (9 Oct)
- [—] Android Share: dropped (9 Oct)
- [—] Accessibility pass: skipped by the designer's call (4 Oct); spec kept in `docs/archive/aai/AAI-Chat-Handoff.md` §10
- [—] Payment-SMS feature: never built; web apps can't read SMS (3 Oct)

## Release checklist (every release)
1. Ask the designer for the version number first.
2. Bump `package.json` `version` (+ `splitEaseBuild` if used) and write the RELEASE notes in `src/version/version.js`.
3. Fresh read-only live backup (`scripts/backup-firestore.mjs`), tell the designer where it is.
4. One "yes" per live step: rules first (if changed), then hosting. `sw.js` cache name is stamped at build.
5. Update `STATUS.md`, `LOG.md`, `BRIEF.md`.
