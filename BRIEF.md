# SplitEase — brief for the brainstorming partner

_Updated: 26 Oct 2026. Public file: no personal data. If anything here looks out of date, say so._

## What SplitEase is
A mobile web app (PWA, installed on an iPhone Home Screen) for tracking and splitting expenses.
- **Shared rooms**: roommates join with a room code, add expenses, see balances and who owes whom.
- **Personal rooms**: one person's own tracker with a monthly budget. A shared room can sync a person's share into their personal room.
- No sign-in. The room code is the key. 3 real users, 4 rooms.

## Where it stands
- **v3.0.5 is live** (26 Oct 2026; the Last-paid pill with a rolling date shows on every dashboard, plus animated category icons). v3.0.0 (9 Oct) brought the full visual redesign (dark + light) and the Aryan AI assistant; v3.0.3 added the Paid/Share month card, search across all months, the settlements deck, an all-months Dashboard graph and a few fixes.
- The redesign is finished. Right now the work is tidying code and docs; there is no active feature in progress.
- The designer is not a developer. They design on a Claude Design canvas; an AI coding assistant on their Mac turns designs into code.

## Screens
Landing · Create room (a chat-style flow) · Join room · Personal setup · Share room · Dashboard · Add Expense (Quick and Items/bill modes) · History · Settings (categories, data export/import, profile sync) · Aryan AI chat.

## Aryan AI (AAI)
A chat that only **adds** expenses. The user types ("cig 20", "dinner 450 with Ravi") or adds bill screenshots; AAI shows an editable card, the user confirms, there is a 5-second Undo. Typed text is understood on the phone with plain code. Bills are read by Gemini through Firebase (free tier, with a spare model). Past chats are kept on the phone. A heatmap shows who opened the app. It does not answer questions, show balances or settle.

## Design rules
Premium, not calm. Light and dark only. Warm, slightly playful copy (including Hinglish). Amounts use an in-app keypad; text uses the phone's keyboard. Test data always starts with "Test". Specs: `docs/SplitEase-Design-System.md` in the repo.

## Hard constraints (don't brainstorm around these)
- Existing users' data must keep working: no renaming of stored fields, collections or saved-room keys.
- No new feature goes into the app without the designer's explicit approval.
- Anything that touches the live database or live site needs the designer's explicit "yes" per step, after a backup.
- The repo is public: no names, emails, real room codes or keys in files.

## Decided and closed (don't reopen unless asked)
- SMS/payment reading: not possible on the web, never built.
- Android Share: dropped. Accessibility pass: skipped by choice (4 Oct); only revisit if the designer asks.
- Test Firebase project and preview: kept on purpose.
- Aryan AI adds expenses only (no questions, balances, remind or settle).

## Known risks
- **Bill reading is on Gemini's free tier**: about 20 reads a day per model, with a spare model behind it. When both run out, users see a "limit" reply and can type items instead.
- **Two gaps in the Firestore security rules**: room-name entries can be deleted by anyone who can reach the database, and an expense write does not check that its room exists. Details in `STATUS.md`. Fixing them needs a rules change on the live project (the designer's explicit yes, after a backup).

## Open for brainstorming
- What should the next round of fixes or features be? (Nothing is queued.)
- Two small code tidy-ups: removing two unused AAI logic files, and splitting the largest code files. Worth doing now or later?
- How to deal with the known risks below.
- Anything the three users have asked for or complained about. (The live app was checked on 26 Oct and works; no open bugs are known.)

## How to hand decisions back to the builder
When the designer says "wrap up", write a short note in this shape and keep it under 15 lines:

```
DECISIONS NOTE — <date>
1. <decision in one line>
   Why: <one line>
   Touches: <screen or feature>
   Status: decided | leaning | open
Open questions: <short list, or none>
```
The designer pastes it into the builder's chat once; the builder folds it into its status files and this brief.

## Style for this partner
Short replies. Offer 2–4 options with a recommendation. Ask before assuming. Don't invent code details; if unsure how something is built, say so and ask.
