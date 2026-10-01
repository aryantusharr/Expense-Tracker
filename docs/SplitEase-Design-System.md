# SplitEase — Design System (v4 · Dashboard + Add Expense + History + Settings)

Source of truth: canvas *SplitEase Dashboard Redesign* (https://claude.ai/artifact/GDZtygngsFojuKiobhL9n4), page "Final app". Dashboard finalised 30 Sep 2026; Add Expense + icons finalised 30 Sep 2026. Use this for every other screen (History, Settings, onboarding, import/export).

## 1. Look
Aurora Glass: deep navy page with 3 slow-drifting blurred light orbs (violet / teal / pink), frosted-glass surfaces, bold numerals. Premium, not calm; one clean treatment per feature.

## 2. Colour tokens
| Token | Dark | Light |
|---|---|---|
| bg | #07071A | #F4F4F8 |
| ink (text) | #F4F3FF | #15142B |
| ink-2 | #D9D6F5 | #403F5C |
| muted | #B9B6DA | #5C5B75 |
| muted-2 (labels) | #9E9BC0 | #6F6E88 |
| glass fill | rgba(255,255,255,.06) | rgba(255,255,255,.82) |
| glass border | rgba(255,255,255,.12) | rgba(21,20,43,.07) + soft shadow |
| brand violet | #8B7CFF | #5B4BD6 |
| brand teal | #5FD4C4 | #0A8577 |
| owed / positive | #9BEADF (num #B5F2E9) | #0A8577 (num #0A7A6D) |
| owe / negative | #FFA3C2 (num #FFB8CF) | #D23B72 (num #C22F66) |
| warning (not logged) | amber #F2B45C on faint stripes | #A65A00 on #FFFAF2 |

Brand gradient text: #B3A8FF → #8B7CFF → #5FD4C4 (light: #5B4BD6 → #6D5DF5 → #0A8577). Lifetime spend uses it reversed (teal → violet).
Member colours: Asha #8B7CFF · Ravi #5FD4C4 · Meera #FF8FB5 (card gradients #6D5DF5→#3A2CA8, #1A8A7E→#0E534C, #C24F7E→#7E2A4E).
Rule: green/teal = money coming to you, pink = you owe. Never use accent colours for anything else.
Receipt paper: #FBFAFF paper, #15142B ink, #6F6E88 secondary, #B9B6DA dashes, remaining #B0305F — same in both themes.

## 3. Background
Orbs: 300/280/220px, blur 70px, 14–19s drift loops. Dark alpha .55/.35/.25, light .22/.18/.14.
Month-tinted sky: tapping a month re-hues the orbs (1.6s cross-fade); current month = brand violet/teal/pink; personal over-budget month = pink sky.

## 4. Type
- Sora — UI text (400/500/600/700). Screen title 24/600; body 13–15.
- Unbounded — hero & key numbers only (800, −0.03/−0.04em). Hero 56, month total 44, lifetime 34, card balance 28, list amounts 15–18.
- JetBrains Mono — labels, data, chips, receipts (10–11px, uppercase, .06–.12em tracking).
- Rupee sign smaller and muted before big numbers.

## 5. Shape & spacing
Page padding 20px, section gap 22px, content top 58px, bottom 150px (nav clearance).
Radii: hero/major cards 32 · list cards 24 · balance cards 26 · small cards 20–22 · chips 999 · monogram = 32% of size.

## 6. Components
- **Monogram**: tinted rounded square — bg = member colour 20% over #0E0D22 (light: over #FFF), 1px border 50%, initial in member colour (light: 65% mixed with ink), Unbounded 700. Sizes 28/36/40/44. Stacked groups overlap −10px with a 2.5px ring in the card colour.
- **Section heading**: outline pill 32px — 1px border (rgba 255/.28 dark, 21,20,43/.22 light), line icon (teal) + title 13/600 + mono count. Icons: ⇄ settlements, wallet balances, grid matrix.
- **Hero (owed/owe) card**: solid dark surface fading from teal (owed) or pink (owe) at top, stronger border; label chip with arrow, Unbounded digits (solid colour), stacked counterparty monograms + sentence, "you paid" ring top-right (76px, 7px stroke, % of own share paid), net bars below.
- **Net bars**: slim 8px pills with soft glow from one dashed centre line; teal right = owed, pink left = owes; rounded outer end only.
- **Settlement row**: glass row 24 radius — counterparty monogram with corner badge (↙ teal when they pay you, ↗ pink when you pay, → neutral), sentence, amount with +/− in accent; row tint + border in accent.
- **Balance card (paid meter)**: 200px, wallet stack (tap to fan, SEP | ALL toggle top-right to flip). Top: member tint base, member gradient fills left→right by % of share paid; name, YOU tag, balance (Unbounded 28), "% PAID". Bottom: solid panel with PAID / SHARE and "Last · …". Back = all-time on a light face.
- **SEP | ALL toggle**: 30px segmented pill, active segment white with ink text.
- **Month card**: mono month label, "vs Aug ₹…" text + % pill (teal down / pink up), odometer total, Lifetime spend card (tinted, gradient number), tappable bar chart.
- **Spending matrix**: table, sticky category column, no cell boxes, faint tint on selected month column, MoM % under values.
- **Not-logged banner**: 40px, amber tinted chip "NOT LOGGED" with blinking warning icon + scrolling "NAME · LAST ENTRY date"; when everyone logged: teal bar with tick "EVERYONE LOGGED TODAY · ROOM IS IN SYNC".
- **Nav**: glass pill (Dashboard / History / Settings) with sliding highlight + separate round gradient Add button (breathing glow).
- **Budget ring (personal)**: Spent is the hero inside the ring; left-to-spend secondary.
- **Segmented mode pill** (Quick / Items): glass pill, 72px segments, sliding violet→teal gradient highlight with glow.
- **Slips table (paid by / split with)**: mini receipt bill = payer (PAID BY, name large in payer colour, 4px colour strip on top, glow); seats = monograms, payer seat ringed in their colour; each included person gets a ₹ slip that slides out, left-out people grey out and their slip tucks back. Compact strip form sits above the keypad.
- **Receipt paper**: mono type, dashed rules, dotted leaders, zigzag bottom edge, grey outlined split initials, C stamps before item names.

## 7. Motion & haptics
Entrances: rise + un-blur (1s, cubic-bezier(.16,1,.3,1)), staggered. Springy presses (scale .93). Hero digits drop in; month total rolls like an odometer; bars grow from baseline; ring sweeps 1.4s. Content must be visible without animation.
Payer change: old name flips away (rotateX 90°, blur 6px, scale .6), new one springs in (cubic-bezier(.34,1.8,.5,1)).
Mode swipe: track slides .6s cubic-bezier(.34,1.15,.64,1); off-screen side fades to .3 and scales .94.
Save: printer slot buzz → stutter print (~3s, 4 stops with 1–2px twitch + brightness flicker) → receipt flies into History (.85s) → nav bounce (.7s) + History pop + "+1".
Haptics: identity pick [12,40,12] · stack [10,30,10] · flip 12ms · month 8ms (over budget [8,40,8]) · tab 6ms · Add 18ms · mode swipe 10ms · print ticks 6ms · landed [12,40,18] · invalid save [30,40,30] · typing 3ms.

## 8. Copy rules
Plain, short. "You're owed / You owe", "Ravi pays you", "Lifetime spend", "vs Aug ₹…", "What was it for?", "Enter an amount first", "Start adding items". No emoji anywhere in the UI (categories use the icon set). Test data uses the "Test" prefix.

## 9. Add Expense (finalised 30 Sep 2026)
Final boards: Final app page → Add expense · Shared / Personal · Dark / Light.
- **One screen, two modes**: Quick ⇄ Items via the segmented pill or a horizontal swipe.
- **Amount page**: odometer ₹ amount, live expression line, +₹50/100/200/500 chips, suggestion row (↻ recurring chips fill amount, description, category), keypad with operators ÷ × − + in the LEFT column, ⌫ bottom-right, slips strip above the keypad, Done folds it into the amount card.
- **Quick form**: glowing amount card (sheen sweep, gradient digits, "₹X EACH · N" pill, pencil), description, category chips (AUTO tag + glow), date strip (Today / Yday / 3 days + Pick date), slide to add. Paid by / split is not repeated here.
- **Items**: empty state = muted "NEW BILL" receipt + panel with Bill name + Total only (payer is set per item); typed text appears on the bill live in full ink; "Start adding items" enables when both set and the receipt un-mutes. Then receipt lines with × remove, Add item → panel (Description, Amount, category chips, slips) → Print to receipt → Save bill when fully split.
- **Validation**: slide dimmed with "Enter an amount / Add a description"; early tap = shake + pink hint toast.
- **Empty start**: ₹0, "What was it for?", category unpicked ("auto-picks from your description").
- **Personal room**: no paid by / split anywhere, no initials on receipt lines, pill reads PERSONAL.

## 10. Icons (finalised 30 Sep 2026)
- **App = A · line icons**: 24px grid, 1.75–1.9 stroke, round caps, drawn in the category colour inside a tinted squircle (colour 18–20% over #0E0D22 / #FFF, 45% border). 8 accent tints cycle: #8B7CFF #5FD4C4 #FF8FB5 #F5C26B #6EC1FF #A8E06B #FF9A76 #C9A7FF (deepen amber/lime in light).
- **Printed receipts only = C · stamps**: same glyphs in ink #3B2F6B inside a circular double-ring stamp, slight rotation (−7…+7°), worn edge (feTurbulence displacement).
- The 32-icon set replaces the emoji picker for custom categories: Food & Dining, Groceries, Coffee & Tea, Snacks, Transport, Fuel, Rent, Electricity, Wifi, Recharge, Water, Gas, Shopping, Clothes, Health, Gym, Movies, Party, Travel, Flights, Stay, Gifts, Books, Pets, Laundry, Repairs, House help, Salon, Subscriptions, Insurance, Kids, Other.

## 12. History (finalised 1 Oct 2026)
Final boards: Final app page → History · Shared / Personal / Empty · Dark / Light.
- **Structure = 1k month stack**: the current month's summary card (month, count, big total, your net — personal: "left of budget", sparkline in the month tint) sits on top of a stack of earlier months (peeking 20px, scaled 5% per step). Tap → the stack fans (70px steps, later months on top); tap a month → it comes to front and the list switches. Scrolling shrinks/fades the stack; a slim sticky bar takes over with month · total · net.
- **Rows = 2c**: glass card, category A-icon squircle, description, "X paid · split N" (personal: "Just you"), bold Unbounded amount, and under it your share — teal "you get ₹X" / pink "your share ₹X" / muted "personal".
- **Itemised bills = 3e**: parent card with a printer slot "TAP TO PRINT N ITEMS"; the sub-receipt stutter-prints downward exactly like the Add Expense save (2.4s, 4 stops, slot buzz, "PRINTING…", tick haptics); lines carry C stamps + split initials + total. Editing a bill opens the Items side of Add Expense pre-filled.
- **Search = 4f**: 40px round glass button; tap → grows across the header (title fades), suggests filter chips as you type (payer, category, etc.); an applied filter is a removable chip, non-matching rows fade to .25, and the orbs tint to the filter colour.
- **Delete = 5b + 7a copy**: drag a row left; a dashed pink layer reads "KEEP PULLING" → past −170px "RELEASE TO TEAR" (scissors pop, 12ms tick). Release: the row tears into two jagged halves that fly apart ([20,40,30] haptic), the list closes up, Undo toast says whose personal rooms it also leaves.
- **Edit = 6b**: tap a row → sheet with the expense as a receipt (description, category, date, paid by, split, amount); tap one line → dashed violet outline + caret and only its control appears (amount ± chips, category icon chips, date strip); Cancel / Save changes.
- **Synced rows (personal) = 8b**: faint rotated "COPY" stamp + small lock, "Synced from Room"; swiping shakes gently ([8,30,8]) and a toast says to edit it in the shared room.
- **Empty state = 9a + 9b**: printer bar with a blank swaying receipt "NO EXPENSES YET" (ghost lines pulse), "Your first expense will print here" + Add button, arrow "LANDS HERE" to the pulsing History tab.

## 13. Settings (finalised 1 Oct 2026)
Final boards: Final app page → Settings · Shared / Personal · Dark / Light.
- **Structure = S1b**: room ID card on top (mono label "SHARED ROOM · 3 MEMBERS", room name 22/700, overlapping member monograms), then sections with outline pill headings: Categories · Appearance · Data · Room.
- **Profile sync = S3g + S3d (in the pill)**: pill "SYNCING TO MY ROOM" with a blinking teal dot; ₹ slips flow along a thin pipe on the pill's bottom edge. Off = grey pill "SYNC OFF · TAP TO SET UP", no flow. Tap → sheet: SYNC ON stamp, "A → My room" with a flowing dotted link, rules (copies read-only + COPY stamp · edits/deletes follow · ₹0 share removes copy), Change / Turn off (confirm: "copies already there stay"). Setup = 3 steps with a gradient step bar: who are you (monograms) → which personal room (cards; empty case offers create) → copy past expenses (receipt preview: count + your share) → SYNC ON stamp + timed message. Shared rooms only.
- **Join code = S2c**: receipt-style card (dark paper #1C1B36 in dark, white paper in light), "ROOM · JOIN CODE", code in Unbounded with .22em tracking; tap → COPIED stamp + toast.
- **Categories = S4a + S4c**: icon-squircle rows with expense counts, bin + ⋮⋮. Tap ⋮⋮ to lift (scale 1.04, shadow, tint), tap another ⋮⋮ to swap. Bin → inline confirm "N expenses move to Other" → Tear it off (jagged tear) → toast. "+ Add category · 32 icons" → sheet: name + 32-icon A picker (selected lifts with colour ring) → new row prints in ("NEW · 0 EXPENSES").
- **Appearance = S5f**: brass pull-cord hanging into the card (idle sway); pull → spring bounce + click haptic [6,20,14] + circular screen wipe to the other theme.
- **Data = S6a**: Export report → scope chips (All time / This month / Pick month) → report receipt stutter-prints from a buzzing slot → Save as PDF / Excel. Import CSV → wizard (step bar): before you start (required columns + tick) → upload (dashed drop zone) → match people → split groups (tick monograms) → match categories (→ A icons) → preview (READY / SKIPPED chips, bad rows in pink with reason) → importing (paper feeds from the slot, count + %) → "N IMPORTED" stamp, skipped list, download failed rows. Personal: no people/split steps. "N expenses imported" banner for 7 days.
- **Room**: Switch room; Room name ✎ → rename sheet.
- **Personal room**: card "PERSONAL ROOM · JUST YOU", no members, no sync; monthly budget bar (spent / left, teal→violet) → budget sheet (±₹500 / ₹1,000, Save).

## 11. Canvas process
Pages: Explorations (current feature only) · Final app (approved screens, dark + light) · Rejected (organised by feature). When a part is finalised its variants move to Rejected; when a feature is finalised its finals go to Final app and everything else to Rejected. Open items for later screens: remove/delete room (Landing).

## 14. Onboarding (finalised 1 Oct)
- **Landing (O1f):** gradient brand band with floating receipt slips; glass sheet lists rooms (colour dot, type, balance). "Start something new" uses Cf orbit keys — Create / Join / Personal, round keys with a gradient ring in each member colour.
- **Create (O2g):** chat — how many share it (2–6) → room name → your name → "Invite roommates". Progress bar under the header; answers are tap chips, bot shows a typing indicator.
- **Share (O3f):** cream invite postcard (italic serif "Join <room>!", code K7Q2XP, ₹ stamp box, seats); Copy/Share stamps green "COPIED". Link to go to the room.
- **Join (O4a + j + f):** paper strip with 6 cells + own 32-key keypad (no system keyboard), Paste code, ⌫. Wrong code → card shakes + pink "NO ROOM" stamp. Right code → holes punched in sequence + green "ADMIT" stamp → room preview line → "Enter TestRoom1".
- **Personal (O5h):** chat — name → budget (₹8,000 / ₹5,000 / Not now) → "Start tracking".
- Boards: App-Onboarding / App-Onboarding-Light.
- **Added from the current app (E3):** chat asks roommate names after your name (N−1 chips); duplicate room name → your bubble struck through + pink TAKEN stamp, bot suggests others or "Join TestRoom1 instead"; "Go to room" after Share → sync sheet (Not now / Set up) → which one is you + which personal room (past expenses copied warning) → SYNC ON receipt; each room row has a ⚙ gear → sheet: Open room · Copy join code · Delete for everyone (pink, confirm card) · Remove from this device (red, last); Personal → "I already have a code" → Join strip in personal mode, shared code stamps SHARED ROOM. Toasts sit at the top.

## 15. Import / export (finalised 1 Oct)
- **PDF report = E1e Magazine**, A4 landscape, white paper for print. P1 cover: serif italic lead-in + huge Unbounded total, facts column (biggest category, settle up, avg/day, lifetime + bars), members with all-time balance. Personal cover: spent vs budget bar instead of balances. P2 expenses per month (serif month heading, share columns, balance row). P3 spending matrix with ▲/▼ % vs previous month. Needs Sora / JetBrains Mono / serif embedded in jsPDF for ₹ (today prints "Rs.").
- **Excel**: same columns/data (S.No, Date, Description, Category, Amount). Violet header row, frozen, autofilter, ₹ Indian number format, bold Total row; tab = Expenses or month. Needs xlsx-js-style. All alert() pop-ups → app toasts (saved / nothing to export / no expenses in month / couldn't export).
- Boards: Report-PDF, Report-Excel.

## 16. Motion system (1 Oct) — board Motion-System
- Durations: --dur-quick .2s · --dur-medium .45s · --dur-slow .9s · --dur-moment 1.4s. Curves: --ease-soft cubic-bezier(.34,1.3,.64,1) · --ease-strong (.34,1.6,.64,1) · --ease-out (.4,0,.2,1).
- Core moves (anywhere): pop, print, stamp, tear, sheet, shake. Signature (only there): flip card (dashboard balances), pull-cord (theme), slot buzz (report + import), flowing slips (sync pill + landing).
- Haptics: tap [8] · select [12] · success [10,40,10] · error [30,30,30] (iOS Safari ignores vibrate).
- Reduced motion: ambient stops; print/tear/sheet/flip/pop/shake → .2s fade; stamps kept without overshoot.
