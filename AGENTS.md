# SplitEase — rules for any AI coding assistant (AGENTS.md)

These rules work for any assistant that edits this repo from the designer's Mac (Antigravity, Gemini CLI, VS Code assistants, Cursor, and so on). No tool is required; the files carry all the context.

## Start of every session (read in this order, stop when you have enough)
0. Run `git pull origin redesign` first. Only one assistant should work on the repo at a time.
1. `STATUS.md` — where the app and the work stand right now (short).
2. `ARCHITECTURE.md` — which screen lives in which folder.
3. Only then the one doc you need: `PLAN.md` (checklist), `docs/AAI.md` (Aryan AI), `docs/SplitEase-Design-System.md` (tokens + screen specs), `LOG.md` (history, read only when digging).

## End of every session — the cheap routine
The designer does not switch to the brainstorming account every time, so don't rewrite its files every time.
- ALWAYS (about 3 lines of output): append ONE dated line to `LOG.md`, append ONE line to "Recent changes" in `STATUS.md`, tick `PLAN.md` if something finished, commit, push. Use small appends/edits; never rewrite or re-read whole files.
- ONLY on a release, a decision, a new risk or open item, or when the designer says "update the status files": do the FULL refresh — rewrite the changed parts of `STATUS.md`, empty its "Recent changes" list, and update `BRIEF.md`.
- Unpushed work is invisible to the brainstorming account.

## Who you're working with
The owner is a designer, not a developer. They designed the whole redesign on a design canvas and want you to build, test and ship it. Explain in plain words, show rather than tell (screenshots, a link to open on their iPhone), and never assume they know a terminal command — run it for them.

## How to work
- Before any non-trivial step, give 2–4 options with trade-offs and say which you'd pick. Then wait for the choice. Pure engineering details: decide, and say what you chose in one line.
- Flag ideas and risks (an iOS limit, a better test flow); don't just do them. New features only after the designer approves them.
- Ask when a decision is the designer's (look & feel, what users see, anything touching live data).
- Finish each chunk with: what changed, how to see it, what you suggest next. `PLAN.md` is a map, not a script.

## Source of truth for the design
- `docs/SplitEase-Design-System.md` (tokens + screen specs). The original canvas: https://claude.ai/artifact/GDZtygngsFojuKiobhL9n4, page "Final app" — if you can't open it, ask the designer for a screenshot of the board.
- Design rules: premium not calm; light + dark only; test data always starts with "Test".
- The visual redesign shipped as v3.0.0 (9 Oct 2026) together with the Aryan AI assistant. Data model stays compatible.
- If the design can't be built as drawn (iOS limits, performance), say so and propose alternatives before improvising.

## Safety rules (these ones ARE fixed)
- Live app: Firebase project `splitease-7bb6c`, 3 real users. Never deploy to it, write to its Firestore, or change its rules without the designer's explicit "yes" in this conversation for that specific action.
- Before anything touches live data (Firestore data or rules): take a full local JSON backup (`scripts/backup-firestore.mjs`) and tell the designer where it is. A hosting-only deploy changes no data and needs no backup.
- Do all development and testing against the test project `splitease-test-2026` (and the `phone-test` preview). Keep them — delete only if the designer asks.
- Work on the `redesign` branch; one commit per meaningful step. Don't force-push or rewrite `main` (it is protected).
- Firestore schema, collection names, field names and localStorage keys must stay compatible so existing users keep their data and rooms.
- Never ask the designer to paste a password or secret into chat. `.env*` files are git-ignored — keep it that way and don't print their values.
- **This repository is PUBLIC.** Never put real names, emails, real room codes, keys or user data in any tracked file (docs, comments, tests, commit messages). Say "the designer" / "the owner", and use ROOM-* labels for test rooms.

## Releasing (needs the designer's yes for the live step)
1. Ask the designer for the version number. Bump `package.json` `version` and `splitEaseBuild` (= last live build + the number of lines in `RELEASE`), and rewrite `RELEASE` in `src/version/version.js`.
2. `npm test`, `npm run lint`, `npm run build`.
3. After the designer's yes: `npx firebase-tools deploy --only hosting --project live` (add `--only firestore:rules` as a separate yes if the rules changed; back up first).
4. Check `https://splitease-7bb6c.web.app/version.json` shows the new version, tag `vX.Y.Z`, then do the FULL refresh of `STATUS.md` and `BRIEF.md`.
Test preview: `npm run build:test`, then `npx firebase-tools hosting:channel:deploy phone-test --config firebase.test.json --project test`.

## Project facts
React 19 + Vite 8, Framer Motion, Firestore (no Firebase Auth), react-router 7, jsPDF + autotable (PDF), xlsx-js-style (Excel). Aryan AI (AAI) reads bills with Gemini through Firebase AI Logic + App Check. PWA: `public/sw.js` (cache name stamped at build) + `public/manifest.json`. Hosting: Firebase Hosting, `dist/`, SPA rewrite. Tests: `npm test` (Node's built-in runner). The designer's phone: iPhone 13 Pro, Safari / Home-Screen PWA.

## Shared knowledge (brainstorming account)
The designer also brainstorms in a separate free Claude account. It reads `BRIEF.md` and `STATUS.md` from this repo (public, no personal data) at the start of each chat. Keep `BRIEF.md` short (about 2 pages) with slow-changing facts only; bugs, open items and recent changes live in `STATUS.md`. Decisions made in brainstorms come back as a pasted "decisions note" — fold them into `STATUS.md` (and `BRIEF.md` if they change the big picture).

## Saving usage
- Search first, then open the specific file section. Don't re-read files you just edited.
- Pipe long logs and builds through `tail -40` or grep for errors; never print `package-lock.json`, `dist/` or `node_modules`.
- One focused task per conversation; `STATUS.md` carries the context to the next one.
- Prefer `npm run build` + lint + tests to catch errors; use screenshots and browser automation for final visual checks.
- Keep replies short: what changed, how to see it, next options.
