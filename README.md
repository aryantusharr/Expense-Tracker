# SplitEase 💸

SplitEase is a modern, beautifully designed Progressive Web App (PWA) for tracking personal expenses and splitting bills with roommates or friends. Built with React and Vite, it features an iOS-inspired, glassmorphic UI with buttery-smooth animations and instant, offline-first performance.

[**Live Demo**](https://splitease-7bb6c.web.app)

---

## ✨ Features

- **📱 PWA Ready**: Install it directly to your home screen on iOS or Android for a native app experience.
- **🌗 Smart Theming**: Fully responsive Light and Dark modes with instant toggling.
- **🔄 Explicit Profile-Sync**: Explicitly map shared room roommate profiles to personal rooms. Synced expenses appear automatically, show a dynamic `🔄 Synced from [RoomName]` badge, and are maintained as read-only copies to prevent duplicate entries.
- **📥 CSV Bulk Import Engine**: Robust, case-insensitive column mapper to import historical expense data in bulk. Includes categories, paid by, and split mapping with a multi-batch (500 doc chunking) visual progress loader.
- **📈 Spending Matrix**: A powerful, horizontally scrollable pivot table that breaks down expenses by category and tracks month-over-month trends.
- **🧑‍🤝‍🧑 Personal & Shared Rooms**: Track your own solo budget or invite roommates to automatically calculate who owes whom.
- **🧮 Smart Settlements**: A settlement engine that minimizes the total number of transactions needed to settle debts between friends.
- **🔄 Interactive 3D Balance Cards**: Flip cards with a 🔄 visual indicator to switch between current month stats and overall historical balances.
- **⚡ Optimistic CRUD & Snappy Timings**: Fire-and-forget background Firestore writes and tuned transition animations to make the UI feel instantaneous.

---

## 📂 Project Structure & Working Tree

```text
Expense-Tracker/
├── public/                 # Static assets, icons, and manifest.json
├── src/
│   ├── assets/             # SVG icons and static images
│   ├── components/         # Modular React Components
│   │   ├── categories/     # Category CRUD and scrollable lists
│   │   │   └── CategoryManager.jsx
│   │   ├── common/         # Global reusable UI (modals, swipe handlers)
│   │   │   ├── ConfirmModal.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── SwipeableItem.jsx
│   │   │   └── SwipeableItem.css
│   │   ├── dashboard/      # Main dashboard stats, charts, balance flip cards
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── Dashboard.css
│   │   │   ├── ExpenseChart.jsx
│   │   │   └── SettlementList.jsx
│   │   ├── expenses/       # Add expenses and history lists (swipe-to-delete)
│   │   │   ├── AddExpense.jsx
│   │   │   ├── ExpenseList.jsx
│   │   │   └── Expenses.css
│   │   ├── layout/         # Core layout, custom headers, and aligned bottom nav
│   │   │   ├── BottomNav.jsx
│   │   │   ├── BottomNav.css
│   │   │   └── Header.jsx
│   │   ├── settings/       # App preferences, data exports, and CSV importer
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── Settings.css
│   │   │   ├── ImportCSVModal.jsx
│   │   │   └── ImportCSVModal.css
│   │   └── setup/          # Onboarding, join code entry, landing screen
│   │       ├── CreateRoom.jsx
│   │       ├── JoinRoom.jsx
│   │       ├── LandingPage.jsx
│   │       ├── PersonalSetup.jsx
│   │       ├── Setup.css
│   │       └── ShareRoom.jsx
│   ├── context/            # React Context stores for theme and data subscriptions
│   │   ├── RoomContext.jsx
│   │   └── ThemeContext.jsx
│   ├── services/           # Firebase Firestore config and CRUD methods
│   │   ├── csvImportService.js
│   │   ├── expenseService.js
│   │   ├── firebase.js
│   │   └── roomService.js
│   ├── utils/              # Helper utilities and data exporters (PDF, Excel)
│   │   ├── excelExport.js
│   │   ├── helpers.js
│   │   ├── pdfExport.js
│   │   └── splitCalculator.js
│   ├── App.jsx             # Main Router and routes definition
│   ├── index.css           # Global custom iOS design system & variables
│   └── main.jsx            # React root mount definition
├── eslint.config.js
├── firebase.json
├── package.json
└── vite.config.js
```

---

## 🛠️ Tech Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite
- **Database / Backend**: Firebase Firestore
- **Styling**: Vanilla CSS (CSS Variables, custom Glassmorphism, and responsive layout)
- **Animations**: Framer Motion
- **Charts**: Chart.js (`react-chartjs-2`)
- **Data Exporting**: ExcelJS & jsPDF
- **Hosting**: Firebase Hosting

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/splitease.git
   cd splitease
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Firebase credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

---

Designed and built with ❤️ by Tushar.