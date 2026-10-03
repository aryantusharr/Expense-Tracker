# Aryan AI (AAI) — build handoff for Claude Code

Written 3 Oct 2026 from the design project. The SplitEase redesign is already live; **AAI is the only feature left to build**.
Design source of truth: Claude Design canvas "SplitEase Dashboard Redesign" → Final app page, rows "Aryan AI (AAI) · in-app assistant · Dark / Light" + "AAI mark · looping loader" + "AAI short loader & small mark" (https://claude.ai/artifact/GDZtygngsFojuKiobhL9n4 — private; ask Shatakshi for screenshots of any board you need).

---

## 1. What AAI is
An assistant **inside the PWA** (no WhatsApp bot, no backend server, zero cost, free forever) that does what a bot would: log an expense from a sentence, paste a UPI payment, read bill screenshots into an itemised bill, answer balance/spend questions, remind via WhatsApp share, mark settled. **Not a chat screen**: one answer at a time, everything ends on the existing save system. Name in UI: "Aryan AI" on first mention (consent), "AAI" everywhere else; never name the provider in the UI.

**Hard rules:** works on iPhone Safari (priority), Android and Home-Screen PWA · existing rooms/data keep working · premium in light and dark · no voice · no in-app camera · no paying via UPI from the app · no on-device bill-reading fallback · not on the Add Expense page.

## 2. Entry — the pill (Dashboard only)
- 50×14 pill, radius 999, #12112E (light: white), 1px teal 45% border, soft teal glow; black slot across the middle; the **receipt buddy** (small slip with two dot eyes) rises fully out of the slot and sinks back, 3s loop. Invisible 44×44 hit area. Left of the identity avatar in the header.
- States: idle · something waiting (buddy stays up longer + small pulsing teal dot) · reading with sheet closed (buddy up, eyes look down, slot glow pulses) · limit/error (buddy half-peeks, pink slot + border).
- Buddy colours: dark mode white #FBFAFF with ink eyes; **light mode OLED black #000 with off-white eyes #E9E7F5** (everywhere).

## 3. The sheet
Bottom sheet radius 30, rgba(18,17,46,.97) (light: white .96). Top → bottom:
1. Big buddy (8×) on the left of the top edge rising out of a wide glowing slot; blinks every 4s, bobs; blush + smile.
2. Paper speech bubble: "Hi {name}!" + line 2 rotating by context ("Kya add karein?" default, "Chai ka hisaab?" morning, "Payment copied — add it?", "Settle karein?" month-end; personal room: "Kya track karein?"). ≤24 chars.
3. 40px glass ✕ at top-right beside the bubble — **the only way to close** (no swipe/tap-outside). Text typed is kept as a draft.
4. Two tiles: Bill screenshot · Paste payment.
5. Input: receipt-paper field, **the app's own keypad** (no system keyboard), Done renamed **Ask**.
6. Suggestion chips (SG-A) right above the keypad.
- Opens with keypad up and field focused. **After Confirm the sheet closes** and the existing save animation plays; then a toast "Added ₹450 Dinner · You get ₹300 back · Share" (5s bar) — Share opens WhatsApp with the summary.

## 4. Text understanding — on the phone, no AI, never hits a limit
English + Hinglish:
- Amount: `450`, `₹450`, `450rs`, `4.5k`, `1,200`, `120+80`.
- Payer: default phone owner; `ravi paid`, `paid by ravi`, `maine diya`.
- Split: `with ravi meera`, `all`/`sab`, `me+ravi`, `not meera`, `only meera`, `60/40`.
- Description = leftover words; category via the existing Hinglish keyword map (chai, sabzi, auto, kirana, petrol, zepto, swiggy…).
- Date: `yesterday`/`kal`, `2 oct`, `last friday`; default today.
- Many at once (commas/newlines) → "3 expenses or 1 bill?". Items: `dmart 1240: atta 320 all, chips 90 me+ravi, rest all` → itemised bill.
- Commands: `undo`, `change last to 500`, `remove meera from dinner`, `remind ravi`, `settle all`, `kitna dena hai`, `food this month`.
- **Live preview:** card appears once an amount is recognised and updates ~150ms after the last key; Confirm straight from it. Ask needed only for questions/commands. Before an amount, chips show instead.
- Unknown text → "Couldn't understand · Add as expense ₹— ?" with fields; never a dead end. Name not in room → "Priya isn't in this room · pick".

## 5. Answer cards (glass card style A)
Question echo (mono, muted) → glass card radius 18 (title 13/700, detail 10.5, Unbounded amount) → Confirm (gradient) + Edit (glass).
| # | Function | Card | Button |
|---|---|---|---|
| 1 | Type it | Dinner · ₹450 · paid by you · split 3 · ₹150 each | Confirm |
| 2 | Paste payment | To Ravi Kumar · ₹640 · UPI · date/time | Confirm |
| 3 | Many at once | 3 found · ₹390 | 3 expenses / 1 bill |
| 4 | Repeat | Milk · ₹68 · same split as 1 Oct | Confirm |
| 5 | Balances | You owe Meera ₹210 · Ravi pays you ₹640 | Settle / Remind |
| 6 | Spend question | Food · October · ₹3,460 · +12% vs Sep | — |
| 7 | Remind | Message for Ravi · ₹640 | Share to WhatsApp |
| 8 | Settle plan | 2 payments settle all | Mark settled / Remind |
| 9 | Edit / undo | Dinner ₹450 → ₹500 | Confirm · Undo |
| 10 | Share summary | Added ₹450 Dinner | Share |
Edit = tap one value → dashed violet outline, only that control opens (amount: −50 −10 +10 +50 chips + numpad; people: monogram toggles; category icons; date strip).
Personal room: no people/split/settle; card shows "₹X LEFT AFTER" (budget).

## 6. Suggestion chips (SG-A)
Two-line glass chip: tinted icon squircle + action 11.5/700 + mono 8.5 live detail. Max 8, scroll sideways; used/dismissed hidden for the day; long-press = dismiss. One tap = card ready.
Order: urgent (copied payment/bill, undo within 10 min, duplicate) → money owed (remind > 7 days, settle all, month-end settle) → habits (same as yesterday, usual now by time of day, rent due within 3 days, not logged today, repeat last bill) → questions (kitna dena hai, this month, biggest spend after the 10th, vs last month, budget left [personal]). All computed on the phone.

## 7. Bill screenshots (the only part that uses AI)
- In: tile → system photo picker, multi-select up to 4 (iPhone). Android also: Share → SplitEase (manifest share_target). Pasted image works too.
- **Consent, first time only:** sheet with A|AI mark + animated mini demo (screenshot drops into the slot → receipt prints with "READ BY A|AI" + torn edge), "Bills are read by Aryan AI (AAI) and not stored", OK, read my bill / Type items instead.
- **Reading:** header still A|AI + "is reading your bill…" + ✕; thumbnails (active outlined teal) → slot buzz → "READING 2 OF 3…" → receipt lines print as they arrive, ghost lines pulse, torn edge + footer "A|AI IS READING YOUR BILL"; Cancel; big looping AAI mark (1.3×) below. Sheet can be closed while reading (pill shows reading state; toast when ready).
- **Review:** header "Review bill" + READ BY A|AI; mismatch strip "₹292 NOT MATCHED · Bill says ₹1,240 · items add to ₹948 · Fix"; receipt mono 12.5px with split initials (default all), flagged lines = dashed violet outline + screenshot snippet "TAP TO FIX"; Taxes & charges line; total; footer READ BY A|AI + torn zigzag edge; taxes toggle (One line · split all / Spread on items); Save disabled until total matches, "Save bill · fix ₹292 first" (fix part in warning pink). Saves in the **existing itemised format (shared groupId)**.
- Non-item lines: GST/CGST/SGST, delivery/platform/handling/packaging/service charge, tip → **counted** in Taxes & charges; discount negative; round-off ±; **only Subtotal is skipped**.
- Screenshots never stored (kept on the phone only while waiting for offline/limit).
- Under the hood: **Firebase AI Logic (Gemini, free tier) + App Check**, client SDK, no server. Privacy policy/Settings should mention Gemini; UI says AAI only.

## 8. Errors (layout = paper stuck in the slot + double-ring stamp)
| Case | Stamp | Title | Line | Buttons | Details |
|---|---|---|---|---|---|
| Daily limit | LIMIT | AAI's reading limit reached for today | AAI reads bills for free, with a daily limit. Your screenshots are kept for tomorrow. | Type items · OK | 429 · QUOTA |
| Too fast | WAIT | Too many bills too fast | AAI can read a few bills a minute. Try again shortly. | Try again in 0:08 (countdown from the API's retry time) · Type items | 429 · RATE |
| AI down | DOWN | AAI isn't responding | The reading service is having trouble, not your bill. | Try again · Type items | 503 |
| Slow net | SLOW | Took too long to read | Your internet seems slow… | Try again · Type items | 408 |
| Offline | OFFLINE | You're offline | Reading needs internet. AAI will read it when you're back. | OK · Type items | NET |
| Blurry/cut | UNCLEAR | Couldn't read some lines | Part of the screenshot is blurry or cut off… | Add screenshot · Fix by hand | OCR |
| Not a bill | NOT A BILL | This doesn't look like a bill | AAI couldn't find items or a total… | Pick another · Type items | PARSE |
Stamp colours: amber = wait/slow, pink = failed/limit, grey = offline, violet = unclear. Text parsing never uses these.

## 9. iPhone first, Android second
| Piece | iPhone | Android |
|---|---|---|
| Clipboard chip | "Paste copied text" → iOS Paste bubble | "Copied payment · ₹640 to Ravi · add?" |
| Bill in | Tile → Photos picker | Tile, or Share → SplitEase |
| Install | How-to card (Share → Add to Home Screen) | One-tap Install |
| Haptics | none | yes |

## 10. Speed targets (taps from Dashboard)
Log by text 2 + typing · suggested action 3 · paste payment 3 (Android) / 4 (iPhone) · bill screenshots 5 + fixes · Android share 3 + fixes · balance question 2 · remind 4 · mark settled 3.

## 11. AAI wordmark & loaders (the app's loading icon)
- Wordmark **A | AI**: Unbounded 800, "A" ink, 4px black rounded slot with white ring + teal glow, "AI" in brand gradient; tight gaps; laid out with flex from the letters. On paper: all ink, deep gradient #5B4BD6→#6D5DF5→#0A8577.
- **Long loop L1 (8s, bill reading & long waits):** peek (buddy lies sideways in the slot, slides out toward AI, ~9px face visible) → the slot **curls from its bottom end** under AI into a straight underline, the buddy **rides the moving end** and lands with it → thinking (head tilt −10°, eyes up, raised brow, sideways mouth, hand to chin, 3-dot trail) → text tags **GPT? → Claude? → Gemini?** one at a time, each fully gone before the next (names only, never logos) → buddy sinks into the underline → short pause → the underline's right end curls up and around AI and straightens back into the upright slot → loop. **No shake.**
- **Short loader (1.6s, < ~2s waits):** A|AI, buddy peeks out toward AI, blinks once, slips back.
- **Small mark (< 40px: buttons, rows, pull-to-refresh):** horizontal slot with the buddy peeking up and blinking; 32/24/16px.
- **Reduced motion:** static A|AI, slot glow pulses 2.4s.
- Build notes learned in design (Safari/iOS): draw the slot as one SVG path and animate **only stroke-dashoffset** (keep dasharray constant; fold hidden slack onto the upright slot; round caps + joins); hide/show with opacity on **wrapper elements**, not on the svg; hide the buddy with overflow masks, **not animated clip-path**. role="status" + task label.

## 12. Motion & haptics
Sheet open .5s spring · buddy rise 1.1s overshoot · bubble pop .45s · card rise + un-blur .45s · close: buddy sinks .3s, sheet drops .45s. Haptics (Android): pill 12 · chip 8 · confirm [10,40,10] · error [30,30,30] · print ticks 6. Reduced motion → .2s fades.

## 13. Data & compatibility
Same expense / itemised format. One new **optional** field: `source` (text / paste / bill). Old rooms unaffected. Text features work offline (Firestore cache); bill reading queues offline.

## 14. Accessibility
Pill: real button, aria-label "Open Aryan AI", 44px. ✕ aria-label "Close". Chips/tiles/cards real buttons. Buddy aria-hidden. Contrast ≥ 4.5:1.
