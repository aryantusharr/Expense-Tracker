# AAI Chat — build handoff (design final 4 Oct 2026)

Supersedes the *UI* parts of `docs/AAI-Handoff.md` (sheet, pill sheet, live card, answer cards, questions/balances/remind/settle).
The brain in `src/aai/` (parse, commands, chips, dates, split — 237 tests) is kept as-is.
Canvas: Final app → rows "Aryan AI (AAI) · chat · Dark / Light (final 4 Oct)", boards 01–08, 09, 10A, 10B, 11 (+ -Light).

## 1. Scope
- AAI only ADDS expenses: typed text and bill screenshots. No questions, balances, remind, settle.
- Entry: the existing Dashboard pill only. Tap → L1 loop plays once (~1.2s short cut) centred on the blurred Dashboard → full-screen chat fades up (board 01).
- Look: Claude-quiet (serif replies — Source Serif 4 — mono steps, Sora UI) with SplitEase tokens/accents. Light mode uses the approved light tokens; buddy is OLED black with off-white eyes.

## 2. Screen parts
- Header: past-chats (☰) · A|AI mark · New chat · ✕. All 44px.
- Empty state (02A): time/context greeting (≥5 lines per context, see §8) + member heatmap 2A (3 mini 5-week calendars, one per member, "n/31 days opened", today ringed, one sarcastic line). Tap an empty day → "Adding for <date>".
- Composer focused (03): "Continue: <chat> · N min ago" pill · heatmap hidden while typing (her call 4 Oct — no 14-day strips) · "SAME BILL AGAIN · 1 TAP → REVIEW" row (violet, past bills: name, ₹, items, last date) above "QUICK USUALS" row · ghost example typed in the field · own keypad (digit row).
- Personal room: 10A (only your calendar + current/best streak + days opened), 10B (no Paid by/Split rows; bills ask no questions).

## 3. Thinking
- While working: mono steps (✓ done, spinner on current), plain-words sarcasm tied to the real step (no git/sudo jokes, never joke about the final numbers).
- When done: steps fold into a muted "Show thinking ⌄" accordion (Claude-style; open shows steps under a thin left line). The A|AI loader is NOT used for thinking.

## 4. Cards (quick + bill)
- Quick card (04): AMOUNT big, then DESCRIPTION · PAID BY · SPLIT · DATE · CATEGORY. Confirm button.
- Bill card (06/09): shop name, date, item count, TOTAL; **"Paid by You" chip** under the header (prominent — guards the 3s auto-pick); rows numbered #1…; each row: name + qty, category tag (auto, per item) · split (ALL 3 or initials), amount; Taxes & charges line (GST/delivery/handling/packaging/tip; discount negative; subtotal skipped); "Save bill".
- Editing: NO row taps, NO chevrons. Every value on the card is its own tap target (name, amount, category, split, date, payer) → only that control opens inline (numpad / keypad on the word / name-chip grid / category picker / date strip).
- Dotted underline only on the FIRST card in a chat and on values AAI isn't sure about (fetched shop name, date, unreadable lines). Everything stays tappable without dots.
- Option grids everywhere: equal-width columns, 40px tall, 44px hit area; member initials 16px.
- Typed multi-item message → ONE itemised bill by default (09). Typed total with fewer items → "Rest of the bill" line = total − items, split all, and AAI says "₹X left over — split 3 ways. Tap it if that's wrong." No total → "Untitled bill" = sum. Secondary button "Add as N separate expenses instead".

## 5. Bill screenshots (05)
1. Screenshot(s) as thumbnails in the user's message. First time per phone: consent as an AAI reply ("read by Aryan AI and not stored" · OK, read it / Type items) (11A).
2. "Who paid?" — You · members in an equal grid; 3s ring on You, auto-picks You; touching the chat pauses it.
3. While reading: one split question per item ("Potato 1 kg · ₹40 — split with?"), pre-picked = previous answer (first: All), same 3s ring; "Same for the rest" full-width on every item until tapped → one-time warn toast (app's warn toast style): "<split> will apply to all N remaining items" + "Don't ask me again" + Cancel / Apply.
4. Fetched shop + item names are plain text with a subtle dotted underline; tap → keypad on that word.
5. Bill card; mismatch bar: "N item(s) failed · #7 on the bill" + "BILL ₹612 · ITEMS ₹572 · ₹40 NOT MATCHED" + FIX #7. Save disabled until matched.
- Long bills: keep per-item questions (her call).

## 6. Save + Undo
- All paths (typed quick, typed bill, screenshot bill, same-bill-again) save through the Add screen's own functions (`addExpense` / `addItemisedExpenseGroup`), `source: 'text' | 'bill'`, synced copies as usual. Stay in the chat (no SaveMoment overlay).
- Saved card locks: one big tilted teal "ADDED" stamp (room · date / ADDED / ★ SPLITEASE ★) over the LEFT label column only — values stay readable; chevrons/dots removed.
- Footer: "SAVED TO <ROOM> · JUST NOW" + Undo (app pink #FF8FB5 / light #D23B72, soft fill) + 5s pink shrinking bar, then locks. Undo deletes the expense (+ synced copies) and returns the card to editable.
- Offline: amber "SAVED · ON PHONE" stamp + "WILL SYNC WHEN ONLINE"; turns into teal ADDED when synced (11D).

## 7. Chats + errors
- A chat becomes read-only 1 minute after it is closed (her call 4 Oct; replaces the old 2-hour life): reopening within that minute continues it, after that it sits read-only in the past-chats sidebar (08) grouped Active / Earlier today / Yesterday (drop the "time left" on active ones — there is no countdown while it is open). Tapping an added card in an old chat opens that expense in History (History stays the source of truth).
- Errors are AAI replies: tinted box + the app's stamp (UNCLEAR violet, LIMIT amber, OFFLINE grey, DOWN pink, WAIT/SLOW amber, NOT A BILL pink), plain reason, 2 buttons, DETAILS mono line. "Type items" always offered.
- Edge cases (11): brand-new room (empty heatmap, no usual rows until 3 similar entries), shared room with only you (no split questions + "Invite roommates" chip).

## 8. Copy banks
Greetings (≥5 per context, rotate, no repeats in a row): late night, morning, nothing logged 2+ days, coming back, month-end, after a big day — lines as approved in chat 4 Oct (e.g. "Raat ke 1 baje? Kya mangaya?", "3 din se khaali hai. Catch up?", "Mahina khatam. Sab likha hai?").
Heatmap lines (app OPENS, sarcastic, rotate):
- "Ravi's opened the app 9 days straight. Very organised. Or very bored."
- "Meera's been gone 4 days. Probably living off Maggi and vibes."
- "You opened it 3 times today. The app is flattered."
- "Nobody opened yesterday. The expenses didn't stop though."
- "6 days straight. Past you did 14. Just saying."
- "You and Ravi, tied at 18. Meera is not in this race."
- "Fresh room. Zero streaks. Very peaceful. Won't last."
- "Today's still empty for you. Ravi's already judging."
Steps: as on the boards ("parsing 'cig 20'… 119th time. Not judging.", "counting roommates… still 3.", "rounding paise… odd paisa goes to Meera. Again.", "reading screenshot… whoever picked this font owes me ₹10.", "checking total… items ₹948, bill ₹1,240. Kisi ne chupke se khaya.", "spotted GST… the government also ate.").

## 9. Data
- New: per-member daily app-open record for the heatmap, e.g. `rooms/{code}/opens/{memberId}_{yyyy-mm-dd}` `{memberId, day, count, last}` — written once per app open (app load, or back after 30+ min; debounced 60s) by the phone's chosen member (built + rules deployed on the TEST project, 4 Oct). Everyone in the room sees everyone (no toggle — her call). Needs a Firestore rules addition → her yes before the live rules deploy.
- Chats: kept on the phone (IndexedDB/localStorage) — editable until 1 min after close, read-only after; nothing new in Firestore.
- Free Gemini tier for bills is fine (≈6 entries/day, ~⅓ bills); LIMIT reply covers the cap.

## 10. Accessibility (applies across the whole app, her call 4 Oct)
- Minimum 11px for any text people read (labels, mono meta, chips). Only decorative stamp micro-text and 16px initial badges may go smaller.
- Contrast ≥ 4.5:1 for text: dark muted text ≥ #8D89A6 on #100F1A; light muted ≥ #5F5C79 on #F4F4F8.
- 44px hit areas, real buttons, aria-labels on icon buttons, role=status on the loader, aria-expanded on Show thinking, role=alertdialog on the warn toast.
- Do an app-wide pass (Dashboard, Add, History, Settings, onboarding, AAI) for font sizes < 11px and low-contrast greys.
