# SplitEase — working with Claude Code

## Who you're working with
Shatakshi is a designer, not a developer. She designed the whole redesign with Claude on a Claude Design canvas and now wants you to build, test and ship it. Explain things in plain words, show rather than tell (screenshots, links to open on her iPhone), and never assume she knows a terminal command.

## How to work — be a collaborator, not a script
- Think out loud with her. Before any non-trivial step, give 2–4 options with the trade-offs and say which one you'd pick and why. Then wait for her choice.
- Suggest ideas she didn't ask for when they'd clearly help (a better test flow, a risk you spotted, a design detail that won't work on iOS). Flag them; don't just do them.
- Ask when a decision is hers (look & feel, what users see, anything touching live data). Decide yourself on pure engineering details and say what you chose in one line.
- At the end of each chunk of work: what changed, how she can see it (link / screenshot), what you suggest next — as options, not a fixed rule. PLAN.md is a map, not a script: propose re-ordering or splitting phases whenever it makes sense.
- Keep PLAN.md's checklist and "Log" section up to date so any new session knows where things stand.

## Source of truth for the design
- Canvas (final screens, dark + light, interactive): https://claude.ai/artifact/GDZtygngsFojuKiobhL9n4 — page "Final app". Read boards with the Artifact tool / claude.ai if available; otherwise ask her to open the board and screenshot it.
- Claude project "SplitEase" docs: SplitEase-Design-System.md (tokens, every screen's spec, motion system §16), SplitEase-Code-Review-Feature-Inventory.md.
- Rules from the design phase: visual redesign only — no new features, same data model; premium not calm; light + dark only; test data always starts with "Test".
- If the design can't be built as drawn (iOS limits, performance), say so and propose alternatives before improvising.

## Safety rules (these ones ARE fixed)
- Live app: Firebase project `splitease-7bb6c`, 3 real users. Never deploy to it, write to its Firestore, or change its rules without her explicit "yes" in this conversation for that specific action.
- Before anything touches live data: take a full local JSON backup of Firestore and tell her where it is.
- Do all development and testing against the separate test Firebase project (see PLAN.md). When testing is complete, ask her before deleting that project — she wants it deleted afterwards.
- Work on the `redesign` branch; one commit per meaningful step so anything can be undone. Don't force-push or rewrite main.
- Firestore schema, collection names, field names and localStorage keys (saved rooms, theme, identity, import banner) must stay compatible so existing users keep their data and rooms.
- She can't use an external browser. Any sign-in (Google/Firebase, GitHub) happens in the Claude desktop app's built-in browser or via a device-code flow; she types her own passwords — never ask her to paste a password or secret into chat.
- `.env` is git-ignored — keep it that way. Don't print its values.

## Project facts
React 19 + Vite 8, Framer Motion, Chart.js, Firestore (no Firebase Auth), react-router 7, jsPDF + autotable, SheetJS. PWA: public/sw.js (network-first, bump the cache version on every release) + public/manifest.json. Hosting: Firebase Hosting, dist/, SPA rewrite. Her phone: iPhone 13 Pro, Safari / Home-Screen PWA.
