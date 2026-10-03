# Aryan AI (AAI) — tech plan

Status: **draft, waiting for her approval** (written 3 Oct 2026). Nothing is built yet. Spec: `docs/AAI-Handoff.md` (§ numbers below refer to it). Design: canvas rows "Aryan AI (AAI)", "AAI mark · looping loader", "AAI short loader & small mark". Before building each screen, read that board's source and match it, don't guess from the written spec.

---

## 1. HLD — how AAI fits in

```
Dashboard header ── AaiPill ──tap──▶ AaiSheet (portal, sits above the nav)
                                         │
              ┌──────────────────────────┼─────────────────────────────┐
         text in the AAI field      Paste payment tile           Bill screenshot tile
              │                          │                            │
        src/aai/parse.js  ◀── upi.js (reads payment text)     photo picker / pasted image / Android share
       (on the phone, no network)                                     │
              │                                                 billRead.js ──▶ Firebase AI Logic (Gemini)
              ▼                                                       │          App Check token attached
         Intent  ──▶ answer card (glass, style A) ◀── billReview ◀────┘
              │
     Confirm ─▶ the EXISTING save functions: addExpense / addItemisedExpenseGroup / updateExpense / deleteExpense
              ▶ sheet closes → existing SaveMoment → toast "Added ₹450 Dinner · Share"
```

- **Where the code lives.** UI goes in `src/components/aai/`. Pure logic (no React) goes in `src/aai/`, so it can be tested with Node. One `AaiProvider` sits next to the existing Room/Toast/Keyboard providers in `App.jsx`. It holds the pill state (idle / waiting / reading / error), the draft text, the bill being read, and the bill queue. That's what lets the sheet close while a bill is still being read.
- **Data in.** AAI reads what the app already has loaded from `RoomContext` (room, users, categories, expenses). It reuses the existing helpers: `splitCalculator`, `settlementEngine`, `dashboardData`, `categoryGuess` (the Hinglish words + learned picks) and `recurringExpenses`. AAI doesn't make any extra Firestore reads.
- **Data out.** All saving goes through the save functions we already have, with the same document shape. So personal-room sync, the "usage count" logic, History and exports all keep working without changes.
- **Offline.** Text, chips, balances and commands work offline (they use the Firestore cache, and saves queue like they do today). Bill reading needs internet. When offline, the screenshots wait in IndexedDB on the phone (`utils/indexedDBHelper.js`) and get read once the phone is back online.

### Firestore impact
- **Just one new optional field: `source: 'text' | 'paste' | 'bill'`** on expenses created by AAI. Older expenses don't have it, and nothing breaks if it's missing.
- **The live rules don't need to change.** `validExpense` in `firestore.rules` only checks the required fields and allows extra ones, so `source` gets through. I'll check this on the test project.
- Old app versions just ignore the field. Personal-room copies don't copy `source` (the sync builds its own field list), which is fine.
- ⚠ "Mark settled" needs a decision first, see Brainstorm #1.
- New localStorage keys (new names, so nothing existing is affected): `splitease_aai_consent`, `splitease_aai_chips` (chips hidden today), `splitease_aai_draft`, `splitease_aai_last` (what AAI added most recently, used by undo).

### Gemini + App Check setup (no server, zero cost)
- **Firebase AI Logic**, using the "Gemini Developer API" backend (free, works on the free Spark plan). It ships in the `firebase` package we already have (`firebase/ai`), so there's no new dependency. The model name lives in one constant, currently the free Flash model (e.g. `gemini-2.5-flash`). I'll check which models are free when we build, because Google retires model names over time.
- **The AI code only loads when it's needed.** `billRead.js`, `firebase/ai` and App Check load only the first time someone taps Bill screenshot. That keeps the app's first load just as fast for everyone, and the reCAPTCHA script only loads for people who actually use bill reading.
- **App Check uses reCAPTCHA v3**, which is free and needs no billing. reCAPTCHA Enterprise is Google's recommended option, but it can need a billing account. App Check gets **enforced on AI Logic only, never on Firestore.** Enforcing it on Firestore would lock out the other users' older app versions.
- **Per-user rate limit** gets set in the AI Logic console (e.g. 10 requests/min). Even with App Check, the Firebase key is public, so this adds a second guard.
- **One request per bill.** All the screenshots of one bill (up to 4) go in a single request, and AAI asks the model to merge overlapping parts. This uses the daily quota 4× more slowly and handles a long Zepto bill split across several screenshots. Each image is shrunk on the phone first (about 1600px on the long edge, JPEG at 0.8 quality). Drawing it onto a canvas also turns iPhone HEIC photos into JPEG.
- **Structured answer.** The model is told to reply only in a fixed JSON format (`responseSchema`): `{ isBill, merchant, date, items:[{name, qty, amount, unclear, box}], charges:[{label, kind: tax|delivery|platform|packaging|service|tip|discount|roundoff, amount}], subtotal, total }`. The phone then works out the "Taxes & charges" line (only Subtotal is skipped), the mismatch amount, and which lines are flagged. AAI never trusts the model's maths.

### PWA / manifest changes
- `manifest.json` gets a `share_target` so Android users can Share → SplitEase. It takes images (POST multipart to `/aai-share`) **and text**, which means a GPay/PhonePe "share receipt" text works too (see Brainstorm #9). iPhone ignores this; nothing changes there.
- `sw.js` catches that POST, saves the shared files/text in the Cache API, then sends the app to `/dashboard?aai=share`, which opens the sheet with the shared bill or payment.
- The cache name already gets stamped at every build, so there's nothing to bump by hand. The version goes to **v2.2.0**, with release notes in `src/version/version.js`.

### Test setup (test project `splitease-test-2026` only)
- Turn on AI Logic + App Check on the **test project** first. The live project only changes at release, with your yes for each step.
- **Localhost:** App Check "debug token" (registered in the console, kept in `.env.development.local`, which git ignores).
- **iPhone:** bill reading and clipboard need HTTPS, so we test those on a test **preview channel** (`hosting:channel:deploy`). The reCAPTCHA key will list `localhost` + `web.app` so preview links work. Wi-Fi testing (`--host`) is still fine for the text features.
- **Parser tests:** `node --test src/aai` uses Node's built-in test runner, so no new packages. There are about 120 example sentences (§3 below). I add `npm run test:aai`.
- Test data: only rooms named "Test …" (D4NYY3, MB739V, plus a new "Test AAI" room if needed). Test expenses start with "Test". Nothing in the test project gets deleted without asking you.

---

## 2. LLD — components per screen

| Screen (board) | Components | Notes |
|---|---|---|
| Dashboard header | `AaiPill` (50×14 slot pill, `Buddy size="xs"`, 44×44 hit area, 4 states) | Placed left of the avatar in `DashboardScreen.jsx`. Only the buddy moves (CSS transform loop, 3s). The loop pauses while the sheet is open or the app is in the background. |
| Sheet | `AaiSheet` (own bottom sheet, ✕ only, radius 30), `BigBuddy` (8×, blink 4s, bob, blush), `SpeechBubble` (greeting + rotating line ≤24 chars), `AaiTiles` (Bill screenshot · Paste payment), `AaiField` (the existing `TextField`, Done label = **Ask**), `SuggestChips` | Uses the existing `KeyboardProvider` tray and opens focused. The draft is saved when the sheet closes. |
| Answer area | `QuestionEcho` + `AnswerCard` with 10 variants: `ExpenseCard`, `PaymentCard`, `ManyCard`, `RepeatCard`, `BalanceCard`, `SpendCard`, `RemindCard`, `SettleCard`, `EditUndoCard`, `ShareCard`, plus `UnknownCard` and `PickPersonCard` | Card rises and un-blurs (.45s). Buttons: Confirm (gradient) + Edit (glass). |
| Edit in card | `EditAmount` (−50 −10 +10 +50 + numpad), `EditPeople` (monogram toggles), `EditCategory` (36 icons, reused), `EditDate` (reuses `add/DateChips.jsx`) | Tapping a value gives it a dashed violet outline, and only that control opens. |
| Bill: consent | `BillConsent` (A\|AI mark + mini demo: screenshot → slot → receipt "READ BY A\|AI") | Shown once (`splitease_aai_consent`). |
| Bill: reading | `BillReading` (thumbnails, slot buzz, "READING…", ghost lines, torn edge, `AaiMark variant="loop" scale=1.3`, Cancel) | The sheet can close while reading; the pill switches to its reading state and a toast says when the bill is ready. |
| Bill: review | `BillReview` (mismatch strip + Fix, mono receipt 12.5px with split initials, flagged lines, taxes toggle, Save disabled until the total matches) | Saves through `addItemisedExpenseGroup` with `source:'bill'`. |
| Bill: errors | `BillError` (paper stuck in the slot + `Stamp` double ring, 4 colours) | See the mapping table below. |
| Loaders | `AaiMark` with variants `loop` (L1, 8s), `short` (1.6s), `small` (32/24/16), `static` (reduced motion) | One component. Safari rules from §11 below. |

**Logic modules (`src/aai/`):** `parse.js` (sentence → intent), `upi.js` (payment text), `answers.js` (balance / spend / settle numbers), `chips.js` (SG-A list), `commands.js` (undo / change / remove / remind / settle), `billRead.js` (AI call + error mapping), `billMath.js` (charges, mismatch, spreading tax over items), `billQueue.js` (IndexedDB queue), `share.js` (WhatsApp text via `wa.me/?text=` or `navigator.share`), `greeting.js` (bubble line).

### Parser rules (run in this order; each step removes the words it used)
1. **Split the input into several expenses** on newlines, `,` or ` and ` when each part has its own amount → "3 expenses or 1 bill?". Pattern `name total: item amt who, …, rest who` → itemised bill.
2. **Commands first:** `undo` · `change last to N` · `remove <name> from <desc>` · `remind <name>` · `settle all` / `settle karo` · `kitna dena hai` / `how much do i owe` · `<category> this month` / `last month` / `biggest spend`.
3. **Date:** `today/aaj`, `yesterday/kal`, `parso` (day before yesterday), `2 oct` / `oct 2` / `2/10`, `last friday`, `friday`. `kal` always means yesterday (expenses are in the past). Future dates are pushed back one week/year.
4. **Split ratio:** `60/40`, `50-50`. This comes before the amount so `60/40` isn't read as a number.
5. **Amount:** `₹450`, `450rs`, `rs 450`, `4.5k`, `1,200`, `120+80` (uses the existing `amountExpr` maths). If several plain numbers are left: a number next to ₹/rs wins, otherwise the largest one, and the card flags the amount so you can tap and check it.
6. **Payer:** `<name> paid`, `paid by <name>`, `<name> ne diya`, `maine diya` / `i paid` / `paid` → the phone owner. If AAI doesn't know who owns the phone, it shows the existing IdentitySheet once.
7. **People:** `with a b`, `all/sab/everyone`, `me+ravi`, `not/except/bina meera`, `only meera`. Names match room members by start of name, ignoring case, the "Test " prefix and one typo. If two members match → `PickPersonCard`. If none match → "Priya isn't in this room · pick". Default: everyone in the room.
8. **Description** = the words left over, minus filler words (`for, ka, ki, ke, on, the, paid, diya, rupees`). **Category** = `guessCategory(desc, learned, categories)`, same as on Add.
9. **Personal room:** people/split/settle are ignored, and the card shows "₹X LEFT AFTER".

Test examples (examples; the real test file has about 120 and runs against a fake room Ravi/Meera/You):

| Input | Expected |
|---|---|
| `paid 450 dinner with ravi` | ₹450 · Dinner · Food · payer me · split me+Ravi |
| `ravi paid 1,200 groceries all` | ₹1200 · payer Ravi · split all · Groceries |
| `chai 40 kal` | ₹40 · Chai · yesterday · split all |
| `4.5k rent paid by meera` | ₹4500 · payer Meera · Rent |
| `auto 120+80 me+ravi` | ₹200 · Auto · Travel · me+Ravi |
| `swiggy 640 not meera` | ₹640 · split me+Ravi |
| `petrol 2000 60/40 ravi` | ₹2000 · me 60% / Ravi 40% (*see Brainstorm #8*) |
| `maine diya 300 sabzi 2 oct` | ₹300 · payer me · Sabzi · 2 Oct |
| `3 samosa 60` | ₹60 · "3 samosa" · amount flagged |
| `chai 20, auto 50, milk 68` | ManyCard "3 found · ₹138" |
| `dmart 1240: atta 320 all, chips 90 me+ravi, rest all` | bill ₹1240, 3 lines, rest ₹830 |
| `paid to priya 200` | "Priya isn't in this room · pick" |
| `undo` / `change last to 500` | EditUndoCard |
| `kitna dena hai` | BalanceCard |
| `food this month` | SpendCard Food · Oct · ₹ · % vs Sep |
| `hello` | UnknownCard "Add as expense ₹—?" |

**Live preview:** parsing runs 150ms after the last key press. A card shows once an amount is found; before that, the chips show. Ask is only needed for questions and commands.

**Payment text (`upi.js`):** a regex per app (GPay / PhonePe / Paytm / BHIM, plus a generic UPI fallback) finds the amount, who was paid, the UPI ref and the date/time. If the person paid is a room member, AAI offers "Record as settle-up" (see #1). Otherwise it's an expense to that merchant. **I need real copied samples from you** to write these.

### Chip triggers (SG-A, max 8, computed on the phone, ordered by this table)
| Group | Chip | Shows when | Tap → |
|---|---|---|---|
| Urgent | Copied payment | Android: clipboard has UPI text (permission granted) · iPhone: always shows "Paste copied text" | PaymentCard |
| | Bill waiting | queue has a bill (offline / limit) | reading |
| | Undo last | AAI added something < 10 min ago | EditUndoCard |
| | Possible duplicate | same amount + description within 24h | card with Delete one |
| Money owed | Remind X | X has owed you > ₹0 for 7+ days | RemindCard |
| | Settle all | 2+ open settlements | SettleCard |
| | Month-end settle | last 3 days of the month and balances not zero | SettleCard |
| Habits | Same as yesterday | yesterday's expense not repeated today | RepeatCard |
| | Usual now | `detectRecurringExpenses` + time of day (±1h of usual) | ExpenseCard |
| | Rent due | recurring expense due in ≤ 3 days | ExpenseCard |
| | Not logged today | after 8pm, no expense today | focuses the field |
| | Repeat last bill | last itemised bill < 14 days ago | bill review copy |
| Questions | Kitna dena hai · This month · Biggest spend (after the 10th) · vs last month · Budget left (personal) | always (fill the empty slots) | Balance/SpendCard |

A chip that's been used or long-press dismissed stays hidden until midnight (stored in `splitease_aai_chips`).

### Error code → error screen
| What `billRead.js` sees | Code | Screen (§8) | Extra behaviour |
|---|---|---|---|
| `navigator.onLine === false` or a network `TypeError` | NET | OFFLINE (grey) | bill goes into the IndexedDB queue, pill shows "waiting" |
| No reply within 30s (AbortController) | 408 | SLOW (amber) | Try again |
| HTTP 429 + quota type `PerDay` | 429 · QUOTA | LIMIT (pink) | bill queued for tomorrow, pill shows the limit state |
| HTTP 429 per minute | 429 · RATE | WAIT (amber) | countdown from `RetryInfo.retryDelay` (fallback 10s) |
| HTTP 500/503, or App Check failed | 503 | DOWN (pink) | Try again (App Check problems also show up here, so users never see "security" errors) |
| JSON OK, `isBill:false` or no items + no total | PARSE | NOT A BILL (pink) | Pick another |
| Items found but some `unclear:true`, or a missing total | OCR | UNCLEAR (violet) | Fix by hand → review screen with those lines flagged |
| Reply isn't valid JSON | PARSE | NOT A BILL | retried once silently first |

The text parser never shows these screens.

### Loaders
- `AaiMark.jsx`: one inline SVG. The slot→underline is **one path, and only `stroke-dashoffset` animates** (dasharray stays fixed, round caps/joins). Showing and hiding uses opacity on wrapper `<g>`/`<div>` elements, never on the `<svg>` itself. The buddy is hidden with overflow masks, not animated clip-path. It has `role="status"` + `aria-label`, and with reduced motion it shows static A|AI with a 2.4s glow pulse.
- Where it goes: room loading (`RoomContext` loading), joining a room, sync/import progress, PDF/Excel generation, pull-to-refresh (if there is one), plus AAI reading. In Phase 3 I'll list the current loading spots before swapping any of them.

---

## 3. Phases — one chat per step, with the model to use

Each step is meant to fit in one fresh chat. **Sonnet** works for logic and wiring. **Opus** is worth it where the work is about matching the canvas exactly or tricky Safari animation. At the end of each step I update PLAN.md and give you a ready-to-paste first message for the next chat.

| # | Step (one chat) | Model | Size | Done when |
|---|---|---|---|---|
| 1a | Parser + answers + upi + chips logic, Node tests, no UI | Sonnet | M | `npm run test:aai` green |
| 1b | Pill + buddy + sheet + bubble + AAI field (Ask) + tiles (bill tile shows "soon") | **Opus** | M | matches the canvas in dark + light at 390×844 |
| 1c | Answer cards + in-card edit + Confirm → save moment → toast/Share; commands (undo/change/remove), remind, settle | Sonnet | L | text-only AAI fully works on the test room |
| 1d | Chips on screen + Paste payment + Android share target (text) | Sonnet | S | chips order checked against the table |
| 2a | **You + me:** AI Logic + App Check on the TEST project (console, ~15 min of your clicks), `billRead.js` + error mapping + a dev-only test page | Sonnet | S | a sample bill returns JSON on localhost |
| 3a | `AaiMark` (L1 loop, short, small, static), Safari rules | **Opus** | M | smooth in Safari + iPhone preview, no flicker |
| 2b | Consent + reading + review + errors + queue (uses `AaiMark` from 3a) | **Opus** | L | 5 sample bills read, every error screen forced once |
| 3b | Swap the app's loaders for `AaiMark`; motion/haptics polish; reduced motion | Sonnet | S | |
| 4 | iPhone pass on a test preview channel (Home-Screen PWA, clipboard, photos, offline) → fix list → fixes | Sonnet | M | your OK |
| 5 | Release: live backup → AI Logic + App Check on LIVE (your yes) → v2.2.0 + What's new + privacy line → merge + deploy (your yes) | Sonnet | S | live works on your phone |

Order change from your list: **3a (the mark) moves before 2b**, because the reading screen is built around the big looping mark. 1a also comes first on its own: it's pure logic, cheap on Sonnet, and every card depends on it.

---

## 4. What I need from you

1. **Decisions** (Brainstorm #1–#3 below; the rest I'll decide unless you say otherwise).
2. **Firebase console, test project first** (in the built-in browser; I'll walk you through each click):
   - AI Logic → Get started → **Gemini Developer API** (turns on the APIs, free).
   - AI Logic → settings → per-user rate limit ≈ 10/min.
   - Make a reCAPTCHA v3 key (google.com/recaptcha/admin) with domains `localhost`, `web.app`, `splitease-test-2026.firebaseapp.com`. The **site key** is public, so it's fine to paste it in chat. The **secret key** goes only into Firebase → App Check → register the web app.
   - App Check → Apps → add a debug token (I generate it, you paste it in).
   - App Check → APIs → Firebase AI Logic → **Enforce** (after one successful test). **Don't enforce Firestore.**
   - If the Firebase browser key has API restrictions (Google Cloud → Credentials), add the Firebase AI Logic API to them. I'll check.
   - The same steps on the live project at release (with your yes), with domain `splitease-7bb6c.web.app` + any custom domain.
3. **Samples:** 3–5 copied payment texts from GPay / PhonePe / Paytm (change the names), and 4–6 bill screenshots (Zepto/Blinkit/Swiggy/restaurant/DMart, personal details cropped out). These get sent to Gemini on the test project.
4. **Privacy policy:** I couldn't find one in the app. Where should the line go (a Settings row → small sheet)? Draft:
   > "Bill screenshots you choose to read are sent to Google's Gemini API (through Firebase) to find the items and total. SplitEase doesn't save your screenshots; only the items you confirm are saved to your room. Google processes them under its Gemini API terms. Text you type to AAI is understood on your phone and never sent anywhere. Bill reading is protected by Google reCAPTCHA."
5. **Board screenshots** only if I can't read the canvas boards with the Artifact tool when building a screen.
6. Does any of your 3 users use Android? If not, I'd skip the share target and Android-only clipboard chip for now (saves a step).

---

## 5. Brainstorm — risks, unclear bits, simpler ideas

**Needs your decision**
1. **"Mark settled" has nowhere to be saved.** The app never records settlements; balances are always worked out from expenses. Options:
   - **A (my pick):** save a settlement as a normal expense (paid by Ravi, split only to you, ₹640) with `source:'settle'`. Balances fix themselves with no schema change. To make it work: hide it from spend totals, charts, budget, exports and personal-room sync (otherwise it shows up as spending), and show it in History as a "Settled" row. Older app versions would still count it as spending until they update (the update toast makes that quick).
   - B: drop "Mark settled" and keep Remind only. Simplest, but there's less point to the Settle card.
   - C: add a new `settlements` collection. That's a new data model and a rules change, which goes against "same data model". I'd avoid this.
2. **"Not stored" on the consent screen may not be accurate.** On the free Gemini tier, Google's terms allow it to keep and use what's sent to improve its products. Options:
   - **A (my pick):** keep the free tier and change the copy to "Bills are read by Aryan AI. SplitEase doesn't save your screenshots."
   - B: switch to the paid Vertex AI backend (Google doesn't use the data, but it needs the Blaze plan with a card; the cost would be tiny but not zero).
3. **Pasting a UPI payment to a roommate is really a settle-up, not a shared expense.** Card 2 ("To Ravi Kumar ₹640") should ask "Settled with Ravi?" when the person paid is in the room, and "Expense?" when it's a shop. This depends on #1.

**Unclear in the spec (my default in brackets)**
4. "Type items instead / Type items" from the bill screens: where does it go? [an empty review receipt inside AAI, so you stay in the sheet. Add Items would leave AAI, and the spec says AAI isn't on Add]
5. §9 "Install how-to card / One-tap Install": where does it show? [a chip in the Habits group, only when the app runs in a browser tab rather than installed]
6. Which expense does "change last" mean? [the last one this phone added through AAI in the past 24h, otherwise the room's newest]
7. "TAP TO FIX" screenshot snippet: this needs Gemini to say where each line is on the image. That works most of the time but not always. [when the position is missing, show the flagged line without a snippet]
8. `60/40`: whose 60? [the payer's 60, the named person's 40; the card shows it so you can check]

**Simpler / faster for users**
9. **Android text share:** GPay/PhonePe "Share receipt" → SplitEase gives you a ready payment card in 2 taps, with no clipboard prompt. It's nearly free once the share target exists.
10. **Number row on the AAI keyboard.** Sentences mix words and numbers ("paid 450 dinner"), and switching ABC↔123 costs taps every time. I suggest a digits row above QWERTY, for the AAI field only. That needs a design call from you.
11. **Screen height.** Keypad + chips + card + tiles + bubble + big buddy is a lot for 844pt. When a card shows, the tiles and bubble could shrink into one row. I'll check against the board and tell you if it doesn't fit; I won't improvise.
12. **iPhone can't read the clipboard by itself.** So "Payment copied — add it?" (bubble) and the "Copied payment" chip can only appear on Android. On iPhone it's always "Paste copied text". The spec mostly says this already; the bubble line just needs to follow the same rule.
13. **Real printing vs. print animation.** Showing receipt lines "as they arrive" means streaming broken-up JSON, which is fragile. Simpler: show ghost lines while waiting (3–8s), then print the real lines with the existing stutter-print animation. It looks the same and is far more reliable. "READING 2 OF 3" becomes a thumbnail highlight that moves along with the animation (since it's one request per bill).
14. **The daily limit is shared by everyone using the project.** That's fine for 3 users, and the per-user cap stops one person (or a stranger) from using it all up.
15. **Battery:** the pill loop runs forever on the Dashboard. It's transform-only CSS and pauses when hidden, and with reduced motion it's static.
16. The L1 loader shows "GPT? Claude? Gemini?" as tags, while §1 says never name the provider in the UI. That's fine as a joke (names only, no logos). Just confirming you're OK with it.
