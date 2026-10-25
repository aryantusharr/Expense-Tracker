# SplitEase — working with Claude Code

## Start of every session (read in this order, stop when you have enough)
0. Run `git pull origin redesign` first (another Claude Code session may have pushed). Only one Claude Code session should work on the repo at a time.
1. `STATUS.md` — where the app and the work stand right now (short).
2. `ARCHITECTURE.md` — which screen lives in which folder.
3. Only then the one doc you need: `PLAN.md` (checklist), `docs/AAI.md` (Aryan AI), `docs/SplitEase-Design-System.md` (tokens + screen specs), `LOG.md` (history, read only when digging).
End of every session — the cheap routine (the designer does not switch to the brainstorming account every time, so don't rewrite its files every time):
- ALWAYS (about 3 lines of output): append ONE dated line to `LOG.md`, append ONE line to "Recent changes" in `STATUS.md`, tick `PLAN.md` if something finished, commit, push with the designer's OK. Use small appends/edits, never rewrite or re-read whole files.
- ONLY on a release, a decision, a new risk or open item, or when the designer says "update the status files" / "sync for brainstorming": do the FULL refresh — rewrite the changed parts of `STATUS.md`, empty its "Recent changes" list, and update `BRIEF.md`.
- Unpushed work is invisible to the other Claude accounts.

## Who you're working with
The owner is a designer, not a developer. They designed the whole redesign with Claude on a Claude Design canvas and want you to build, test and ship it. Explain things in plain words, show rather than tell (screenshots, links to open on their iPhone), and never assume they know a terminal command.

## How to work — be a collaborator, not a script
- Think out loud. Before any non-trivial step, give 2–4 options with the trade-offs and say which one you'd pick and why. Then wait for the choice.
- Suggest ideas that would clearly help (a better test flow, a risk you spotted, a design detail that won't work on iOS). Flag them; don't just do them.
- Ask when a decision is the designer's (look & feel, what users see, anything touching live data). Decide yourself on pure engineering details and say what you chose in one line.
- At the end of each chunk of work: what changed, how to see it (link / screenshot), what you suggest next — as options. `PLAN.md` is a map, not a script.

## Source of truth for the design
- Canvas (final screens, dark + light, interactive): https://claude.ai/artifact/GDZtygngsFojuKiobhL9n4 — page "Final app". Read it with the Artifact tool if available; otherwise ask the designer to screenshot the board.
- Local copy: `docs/SplitEase-Design-System.md` (read this first — cheaper than the canvas).
- Design rules: premium not calm; light + dark only; test data always starts with "Test".
- The visual redesign shipped as v3.0.0 (9 Oct 2026) together with the Aryan AI assistant. New features are allowed only after the designer approves them. Data model stays compatible.
- If the design can't be built as drawn (iOS limits, performance), say so and propose alternatives before improvising.

## Safety rules (these ones ARE fixed)
- Live app: Firebase project `splitease-7bb6c`, 3 real users. Never deploy to it, write to its Firestore, or change its rules without the designer's explicit "yes" in this conversation for that specific action.
- Before anything touches live data: take a full local JSON backup of Firestore and tell the designer where it is.
- Do all development and testing against the separate test project `splitease-test-2026` (and the `phone-test` preview). **Keep them** — delete only if the designer asks.
- Work on the `redesign` branch; one commit per meaningful step so anything can be undone. Don't force-push or rewrite `main` (it is protected).
- Firestore schema, collection names, field names and localStorage keys (saved rooms, theme, identity, import banner) must stay compatible so existing users keep their data and rooms.
- The designer can't use an external browser. Any sign-in (Google/Firebase, GitHub) happens in the Claude desktop app's built-in browser or via a device-code flow; they type their own passwords — never ask them to paste a password or secret into chat.
- `.env*` files are git-ignored — keep it that way. Don't print their values.
- **This repository is PUBLIC.** Never put real names, emails, real room codes, keys or user data in any tracked file (docs, comments, tests, commit messages). Use "the designer" / "the owner", and ROOM-* labels for test rooms.

## Project facts
React 19 + Vite 8, Framer Motion, Firestore (no Firebase Auth), react-router 7, jsPDF + autotable (PDF), xlsx-js-style (Excel). Aryan AI (AAI) reads bills with Gemini through Firebase AI Logic + App Check. PWA: `public/sw.js` (cache name is stamped at build) + `public/manifest.json`. Hosting: Firebase Hosting, `dist/`, SPA rewrite. Tests: `npm test` (Node's built-in runner). The designer's phone: iPhone 13 Pro, Safari / Home-Screen PWA.

## Shared knowledge (two Claude accounts)
The designer also brainstorms in a separate free Claude account. It reads `BRIEF.md` from this repo (public, no personal data) at the start of each chat. Keep `BRIEF.md` short (about 2 pages) and put only slow-changing facts in it; fast-changing facts (bugs, open items, recent changes) live in `STATUS.md`. Decisions made in brainstorms come back as a pasted "decisions note" — fold them into `STATUS.md` (and `BRIEF.md` if they change the big picture).

## Saving usage (the designer is on a usage-limited plan — be economical without cutting quality)
- Read only what you need: search (grep/glob) first, then open the specific file section. Don't re-read files you just edited or already have in context.
- Don't dump big outputs: pipe long logs/builds through `tail -40` or grep for errors; never print `package-lock.json`, `dist/` or `node_modules`.
- One focused task per conversation. When a phase or screen is done, update `STATUS.md`, then suggest a fresh conversation (or `/compact`) — the status file carries the context forward.
- Use subagents (Explore) for wide codebase searches so only the conclusion comes back.
- Batch related edits in one pass; collect fixes first instead of edit → run → edit loops.
- Screenshots and browser automation are expensive: use them for final checks and visual bugs. Prefer `npm run build` + lint + tests to catch errors.
- Design specs: read the relevant section of `SplitEase-Design-System.md` for the screen you're building — not the whole doc or every canvas board.
- Keep replies short: what changed, how to see it, next options. No long recaps.
- For simple, mechanical work (renames, copy changes, small CSS fixes) say so and suggest switching to a lighter model; switch back for new screens/logic.
