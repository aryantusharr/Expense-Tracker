# QA pass 1 — 1 Oct 2026 (browser, iPhone 13 Pro 390×844, dark + light, test project only)

Walked: Landing → Create (taken name, roommates) → Share → sync sheet / Not now → Dashboard · Join (wrong code, personal code, D4NYY3, /join/CODE link) · Personal (typed budget, "I already have a code" with shared + personal code) · gear sheet → Delete for everyone · History (search, filter, edit, tear + Undo) · Add Quick + save · Settings (rename, add/edit/swap/delete category, theme, budget, sync off → set up, export PDF/Excel all time + month, import CSV shared + personal with bad rows).

## Bugs (fix)
| # | Sev | Where | What | Fix |
|---|-----|-------|------|-----|
| 1 | Major | Onboarding.css:6 | `.ob button` reset beats component classes → 2–6 count chips squashed to 11px, "Join X instead" chip unpadded, Share "Copy code / Share" render as bare text | `:where(.ob) button` |
| 2 | Major | pdfExport.js matrix | Month amounts drawn left-aligned from the cell's right edge → numbers sit in the next column and shaded rows paint over them (only "₹" shows) | right-align |
| 3 | Major | pdfExport.js cover | Total is all time (8 months) but text says "across 6 months", "since May", biggest category from 6-month window; matrix total ₹2,26,107 vs cover ₹3,88,798 | real span on cover; matrix titled "Last 6 months" |
| 4 | Major · perf | index.css body::before | Old design's 200%×200% rotating background still animates under every screen | delete |
| 5 | Major · perf | nav +, dashboard/add sheen, pulses | Infinite animations on box-shadow / `left` repaint every frame | same look via transform/opacity |
| 6 | Major · perf | orbs (all screens) | 3 large `filter: blur(70px)` orbs drifting + scaling per screen — heaviest thing on iPhone | radial-gradient orbs, no filter |
| 7 | Major · perf | Profile sync setup | 801 past expenses took ~80 s, only "Syncing…" (2 sequential requests per expense) | batched writes (same data) + "N / 801" progress |
| 8 | Major · UX | History search/filter | Only dims rows in the month on screen — can't find older expenses; no "no matches" | while searching, list matches from all months + count |
| 9 | Medium | Create chat | Duplicate roommate names accepted ("Test Asha" twice) | reject with TAKEN-style shake |
| 10 | Medium | many | Touch targets < 44px: category bin/⋮⋮ 28px, rows 32px, edit-sheet fields 25px, Landing rows 31px + gear 34px, pull-cord 22px | bigger invisible hit areas, no visual change |
| 11 | Medium | Import wizard | Next/Preview just dims when something is unmatched, no reason shown | hint line + highlight unmatched; pre-pick exact name matches |
| 12 | Medium | Share → sync sheet | Dead end when no personal room on the phone | reuse Settings' "Create a personal room" step |
| 13 | Medium · pre-existing | firebase.js | Memory-only Firestore cache → expense added offline is lost if the app is closed before reconnecting | IndexedDB cache (`persistentLocalCache`), same data |
| 14 | Medium · pre-existing (live too) | sync copies | Copies keep the shared room's category id → wrong category in the personal room | out of redesign scope — decide |
| 15 | Low | History tear | If the app is backgrounded within the Undo window, delete commits but Undo still shows | dismiss toast on flush |

## Polish
16 Empty room ring "100% you paid" · 17 Dashboard NET table truncates names ("Test A…") · 18 Sync receipt "1,17,092.90" → "₹1,17,093" · 19 "1 rows skipped" · 20 PDF name lacks room name; 4.3 MB for 59 pages → enable compression · 21 PDF split "T + T" initials → first names · 22 Export receipt lists 5 months but totals all; "1202 expenses" vs History 910 (lines vs bills) · 23 Excel dates are text → real dates · 24 Export buttons not disabled while the PDF builds · 25 Personal code on Join: add "Open as personal" button · 26 Manifest theme colour still old #6c5ce7 · 27 TAKEN: bot doesn't suggest names (spec)

## Passed
Join stamps (NO ROOM / PERSONAL / SHARED ROOM / ADMIT), /join link, Personal create + budget, Delete for everyone, profile pick, Quick add + save moment, edit sheet, tear + Undo, filter chips, rename, categories add/edit/swap/delete (copy already says "will show under Other"), theme toggle, budget sheet, sync off/on, Excel (violet frozen header, filter, ₹ format, Total row), import shared + personal with skipped rows + banner. No horizontal overflow, no unlabeled buttons. History renders 900+ expenses month-by-month (~70 ms).

## Not verifiable in the browser pane
Keyboard over chat inputs, safe areas on device, real offline, Add to Home Screen, pull-cord drag feel, frame rate (pane throttles when hidden). Haptics: iOS web ignores them.

## Test data changed (test project only)
D4NYY3: 5 "Test chai" deleted, "Test QA coffee" added, "Test item 31" 125→135, 4 "Test import" rows; Test B's sync moved N4EWMU → 9FQQ73 (801 copies). New personal room 9FQQ73 "Test Solo" (+2 imported). "Test QA Flat" created then deleted.

## Decisions settled by data
- PDF non-Latin names: live backup has 0 non-Latin characters and 0 emoji in names/descriptions → keep as is.
