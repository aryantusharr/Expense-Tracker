# Chat 3 · Changes brainstorm (9 Oct) — PLAN ONLY, nothing built

Her list after the iPhone pass. Each item: what it touches, options, my pick. Nothing here is in v2.2.0 unless she says so.

## 0 · Open question from the bug list — AAI "Split with" per item (bug 5)
Today: one "split with?" question per item, 3-second auto-pick ring. Too many questions, too short.
- **A (my pick)** Ask ONCE: "Split with — All N / pick people" for the whole bill. Every item starts with that. Fine-tune per item on the bill card (tap the chips, already built). No timer.
- **B** Keep one question per item, but remove the 3s timer — a "Next" button confirms each.
- **C** One screen with every item as a row and its people chips, "All" pre-selected, one "Done".
- Either way: "Who paid?" also loses the 3s auto-pick (tap to confirm). Her call whether Who paid keeps its ring.

## 1 · "Taxes & charges" as its own category
- Today the charges row is a fake row (no category). It saves as an expense under "Other"/the item category.
- **A (pick)** A real category "Taxes & charges" (icon + colour), created in a room the first time a bill with charges is saved (match by name, so never twice). Touches the `categories` collection → on LIVE it adds one category per room — needs her yes.
- **B** Only a label inside bills (no Firestore change); History/charts still group it as Other.
- Also decide: do taxes show in the dashboard category chart? (Yes under A.)

## 2 · "Who are you?" card leaves the Dashboard
- Touches: DashboardScreen (card), Settings → profile/sync row (`ProfileSync.jsx`), the pill in the corner.
- **A (pick)** Until she picks a profile the Dashboard shows the card once; after picking, it disappears and the choice lives in Settings → Profile (change/clear there).
- **B** Remove the card entirely; first launch after joining asks once in a sheet.
- localStorage identity key stays the same either way.

## 3 · Keyboard redo (slow, many problems)
- Need her examples first: slow where (typing lag, opening, jumping)? which fields? Suggest I measure on the preview with her phone before choosing.
- **A** Tune the own keypad: pointer-down instead of click, no full re-render per key, bigger hit areas, no animation per key.
- **B (pick, if A isn't enough)** Phone keyboard for text fields (names, descriptions), own keypad ONLY for amounts. Reverses "own keypad everywhere" from v2.1 — her design call.
- **C** Phone keyboard everywhere, with our suggestion strip above it (iOS can't host a custom strip reliably; drop Paste/shift bar).

## 4 · AAI header: "A|AI" animates to "Aryan AI"
- **A (pick)** Plays once during the open loader: the A grows "ryan" out of itself → "Aryan AI" → shrinks back to "A|AI" in the header.
- **B** Plays every time the header appears (also after New chat).
- Needs: Framer Motion / CSS only, ~1.6s; respects reduced-motion. I can sketch it in the browser before wiring.

## 5 · Date not found → highlight
- Parser already knows when the bill has no date (`read.date` empty → falls back to today). Add a `dateGuessed` flag on the bill and pulse the date chip until she taps it (or edits it).
- Same pulse reused for item 6.

## 6 · Everything not fetched pulses
- One shared "check me" pulse (soft ring, 1.4s loop, stops when touched) on: "Untitled bill", guessed date, unsure total, unsure category, missing Paid by.
- Add a line above Save: "3 things to check" that scrolls to the first one. Save stays allowed.
- Builds on the existing dotted `dots` system (`ch-ed`), so it's mostly style + the flags from 5.

## Suggested order
5+6 first (small, same mechanism) → 0 (split question) → 1 → 2 → 4 → 3 (needs her data). Probably a v2.3.0 chat, not Chat 3.

## Also answered: the pencil on the AAI top bar
It's "New chat" (the same as the button in the drawer). Not necessary, but one tap is faster than open-drawer-then-tap. Suggest: keep it, hide it while the chat is empty (nothing to start over).
