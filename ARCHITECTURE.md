# SplitEase — architecture map

Find any screen in under 30 seconds. Screen names match the canvas ("Final app" page).

## Screens → folders

| Screen (route) | Folder | Start reading at |
|---|---|---|
| Landing `/` | `src/components/onboarding/` | `LandingScreen.jsx` |
| Create room `/create` | `src/components/onboarding/` | `CreateScreen.jsx` (uses `ChatScreen.jsx`, `useChat.js`) |
| Join room `/join/:code?` | `src/components/onboarding/` | `JoinScreen.jsx` |
| Personal setup `/personal` | `src/components/onboarding/` | `PersonalScreen.jsx` |
| Share room `/share/:code` | `src/components/onboarding/` | `ShareScreen.jsx` |
| Dashboard `/dashboard` | `src/components/dashboard/` | `DashboardScreen.jsx` → `parts/` |
| Add Expense `/add` (Quick + Items) | `src/components/add/` | `AddScreen.jsx` → `QuickPane.jsx` / `ItemsPane.jsx`; logic in `useAddController.js` |
| History `/history` | `src/components/history/` | `HistoryScreen.jsx` |
| Settings `/settings` | `src/components/settings/` | `SettingsScreen.jsx` |
| Aryan AI chat (opens from the Dashboard pill) | `src/components/aai/` + `src/aai/` | `components/aai/chat/AaiChat.jsx`; guide: `docs/AAI.md` |
| Foundations preview `/foundations` (dev/test builds only) | `src/components/dev/` | `FoundationsPage.jsx` |

Routes live in `src/App.jsx`. Bottom navigation: `src/components/layout/FloatingNav.jsx`.

## Everything else

| Folder | What lives there |
|---|---|
| `src/components/ui/` | Shared building blocks: Button, Chip, Sheet, Toast, Numbers, CategoryIcon, in-app Keyboard |
| `src/context/` | `RoomContext` (current room, users, expenses, saved rooms) and `ThemeContext` |
| `src/services/` | All Firestore access: rooms, expenses, CSV import, app opens. Nothing else talks to Firestore. |
| `src/utils/money/` | Split and settlement maths (`splitCalculator`, `settlementEngine`) |
| `src/utils/expenses/` | Add-flow helpers: category guessing, recurring expenses, remembered defaults, recent descriptions |
| `src/utils/sync/` | Copying shared expenses into linked personal rooms |
| `src/utils/export/` | PDF and Excel reports |
| `src/utils/device/` | Phone features (haptics) |
| `src/utils/helpers.js` | Small general helpers (currency, dates, share links, colours) |
| `src/hooks/` | `useExpenseForm`, `useRecordOpen` |
| `src/aai/` | Aryan AI logic with no React (parsing, bill reading, chat model). Testable with Node. |
| `src/styles/` | Design tokens (`tokens.css`), motion, shared UI and keyboard styles |
| `src/design/` | Category icon set |
| `src/version/` | Version number and What's-new release notes |
| `scripts/` | Backup, restore, anonymise and data-check scripts (never pointed at live without a "yes") |
| `public/` | PWA files: `sw.js`, `manifest.json`, icons, fonts |
| `docs/` | Design system, AAI guide, archive |

## Conventions
- **One folder per screen.** Each screen keeps its CSS next to it, with the same name stem.
- **Components `PascalCase.jsx`, logic `camelCase.js`, hooks `useThing.js`, tests `thing.test.js` beside the code.**
- **Every file starts with a one-line plain-English header** saying what it is for.
- **Styling uses tokens** from `src/styles/tokens.css` (`--se-*`), not hard-coded colours.
- **Firestore field names, collection names and localStorage keys never change** (existing users' data depends on them).
- **Refactor commits move or split code only; no behaviour change.** Tests, lint and a build must pass after each one.

## Guardrail
`npm run lint` warns (it does not fail) when a source file passes 400 lines of code, so new bloat shows up early. Over the limit today: `AaiChat.jsx` (590) and `Keyboard.jsx` (446). The table below also lists the next-largest files by raw line count.

## Split candidates (next tidy-up)
Largest files first. Split one per commit, keep exports the same, run tests and a build after each.

| File | Lines | Suggested seams |
|---|---|---|
| `components/aai/chat/AaiChat.jsx` | 664 | chat state + flow into a `useAaiChat` hook; message list; save/undo handlers |
| `components/ui/Keyboard.jsx` | 513 | provider, QWERTY keys, numeric keypad, text-field components |
| `components/aai/chat/Chat.css` | 425 | one stylesheet per card or part (cards, composer, drawer, errors) |
| `components/aai/chat/Cards.jsx` | 410 | quick card and bill card as two files |
| `components/dashboard/DashboardScreen.css` | 407 | by card, next to `parts/` |
| `utils/export/pdfExport.js` | 337 | cover, tables and footer helpers |
| `components/settings/SettingsScreen.css` | 333 | by section |
| `components/settings/ImportWizard.jsx` | 330 | one file per wizard step |
| `services/csvImportService.js` | 327 | parse, mapping and write steps |
| `components/settings/ProfileSync.jsx` | 311 | pill and setup sheets |
| `aai/billParse.js` | 305 | sums/charges and error mapping |
| `components/add/useAddController.js` | 302 | save logic separate from form state |

Not used by the app any more but still tested: `src/aai/chips.js`, `src/aai/commands.js` (see `docs/AAI.md`).
