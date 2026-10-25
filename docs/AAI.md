# Aryan AI (AAI) — current guide

One page on how AAI works today. The detailed original specs are archived in `docs/archive/aai/` (they describe the older "sheet" version in places; this file wins).

## What it does
AAI only **adds expenses**. The user opens it from the pill on the Dashboard header and either types ("cig 20", "dinner 450 with ravi") or adds bill screenshots. AAI shows an editable card; the user confirms; it saves through the app's normal functions (`addExpense` / `addItemisedExpenseGroup`) with `source: 'text'` or `'bill'`. Undo is available for 5 seconds. It does not answer questions, show balances, remind or settle.

## How it works
- **Typed text** is understood on the phone with plain code, no AI and no network (`src/aai/parse.js` and helpers). It never hits a usage limit.
- **Bill screenshots** are the only AI part: up to 4 images → one request to Gemini through Firebase AI Logic, App Check attached (`src/aai/billRead.js`). The model returns JSON; the phone does all the maths and checks (`billParse.js`). Screenshots are never stored.
- **Models:** main `gemini-3.8-flash`, spare `gemini-3.5-flash-lite` (constants in `billRead.js`). Free tier ≈ 20 reads/day/project per model; when both are used up the user sees the LIMIT reply. Offline reads wait in IndexedDB (`billQueue.js`) and run when back online.
- **Live safety:** the live build has no reCAPTCHA site key and `billRead.js` refuses the live project unless `VITE_AAI_BILLS_LIVE=yes`; both are set only at release.
- **Chats** are kept on the phone (`splitease_aai_chats`, `chatStore.js`): editable until 1 minute after closing, then read-only; newest 30 / 30 days per room.
- **App opens** (for the heatmap): `rooms/{code}/opens/{memberId}_{yyyy-mm-dd}` written once per app open (`hooks/useRecordOpen.js`, `services/opensService.js`).

## Where the code is
- Pure logic (testable with Node): `src/aai/` — `parse`, `dates`, `amount`, `people`, `split`, `common` (typed text) · `chatModel` (message → steps/reply/card) · `chatStore` · `billRead` / `billParse` / `billQueue` · `errors` · `greetings` · `heatmap` · `usuals` · `answers` · `fixtures` (test data).
- UI: `src/components/aai/` — `AaiPill.jsx`, `Buddy.jsx`, `aaiSave.js` (save + undo), `chat/` (`AaiChat.jsx` main flow, `Cards.jsx` quick + bill cards, `Bill.jsx`, `Composer.jsx`, `Heatmap.jsx`, `PastChats.jsx`, `Errors.jsx`, `LoopMark.jsx`).
- Tests: `npm run test:aai`.

## Rules worth remembering
- Equal splits only; names win when parsing; dates: a date word wins, else today.
- Bill card: one "Taxes & charges" line (category created in a room on its first bill save); a mismatch blocks Save until fixed; "Split with" is per item, all start as "All N" with a pulsing tick.
- Anything AAI guessed or couldn't read pulses ("check me") until the user looks at it.
- Errors are replies with a stamp: UNCLEAR, LIMIT, OFFLINE, DOWN, WAIT, SLOW, NOT A BILL.
- Test data always starts with "Test"; screenshots of real bills stay out of git (`test-data/` is ignored).

## Known loose ends
- `chips.js` and `commands.js` (and their tests) are not used by the chat UI since the chat redesign (it only adds expenses). Delete them if the designer confirms they will not come back.
- The accessibility pass for AAI was skipped on purpose (4 Oct).
- Console setup for the test project (reCAPTCHA Enterprise key, App Check, AI Logic) is recorded in `docs/archive/aai/AAI-Setup-Test.md`.
