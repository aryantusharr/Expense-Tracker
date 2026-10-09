# SplitEase

A phone-first web app (PWA) for tracking your own spending and splitting bills with friends or flatmates. Add it to your iPhone or Android home screen and it works like a native app.

**Live app:** https://splitease-7bb6c.web.app · **Version:** 3.0 · [MIT licence](LICENSE)

---

## What it does

- **Personal and shared rooms.** Track your own budget, or share a room with a short code so everyone sees who owes whom. There are no accounts to create: the room code is the key.
- **Quick and detailed expenses.** Type an amount, pick a category, choose who paid and who shares it. A bill can also be entered item by item, each with its own people.
- **Aryan AI.** A chat that logs an expense or a whole bill from plain words ("dinner 840 with Riya and Sam"). It can also read a bill from screenshots: shop, date, items and taxes. Each item gets its own split before you save. It learns your categories and descriptions over time.
- **Smart settlements.** Works out the fewest payments needed to settle everyone up.
- **Dashboard, History and Spending matrix.** Monthly balances, category charts, searchable history, and a month-by-category table.
- **Import and export.** Bring in old data from CSV; export to PDF or Excel.
- **Light and dark themes**, a custom in-app keypad for amounts, and your phone's own keyboard for text.

## How it is built

React 19 · Vite 8 · Framer Motion · Chart.js · react-router 7 · Firebase Firestore and Hosting. Bill reading uses Gemini through Firebase AI Logic, protected by App Check. There is no Firebase Auth: access is by room code, enforced by [`firestore.rules`](firestore.rules).

```text
src/
├── aai/           Aryan AI brain: parsing, splits, bill reading (pure logic + tests)
├── components/    Screens: dashboard, add, history, settings, aai chat, onboarding
├── services/      Firestore reads and writes
├── design/        Category icons
├── styles/        Tokens and shared styles
└── version/       Version, build number and the "What's new" notes
public/            Manifest, icons, service worker
scripts/           Backup, restore and data-check tools (Node)
docs/              Design system, Aryan AI plan, QA checklist
```

## Run it yourself

You need [Node.js](https://nodejs.org/) and your own Firebase project (Firestore enabled).

```bash
git clone https://github.com/aryantusharr/Expense-Tracker.git
cd Expense-Tracker
npm install
```

Create a `.env` file (it is git-ignored) with your Firebase web config:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app locally against the test project |
| `npm test` | Run the unit tests (Aryan AI brain and add-screen helpers) |
| `npm run lint` | Check the code style |
| `npm run build:test` | Build against the test project |
| `npm run build` | Production build (needs the live project's env file) |

Bill reading needs `VITE_RECAPTCHA_SITE_KEY` (an App Check reCAPTCHA key) and `VITE_AAI_BILLS_LIVE=yes` in a production build; without them the chat still works for typed expenses.

## Releasing

Bump `version` and `splitEaseBuild` in `package.json`, rewrite `RELEASE` in `src/version/version.js`, build, deploy the Firestore rules first, then Hosting. Take a backup with `scripts/backup-rooms.mjs` before touching live data.

## A note on privacy

Room codes are access keys. Never commit a real code, a `.env` file or a backup. Data lives in Firestore under the room code, and anyone with the code can open that room.
