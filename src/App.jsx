import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useRoomContext } from './context/RoomContext';
import BottomNav from './components/layout/BottomNav';
import LandingPage from './components/setup/LandingPage';
import CreateRoom from './components/setup/CreateRoom';
import JoinRoom from './components/setup/JoinRoom';
import ShareRoom from './components/setup/ShareRoom';
import PersonalSetup from './components/setup/PersonalSetup';
import DashboardPage from './components/dashboard/DashboardPage';
import AddExpense from './components/expenses/AddExpense';
import ExpenseList from './components/expenses/ExpenseList';
import SettingsPage from './components/settings/SettingsPage';
import ReviewPage from './components/expenses/ReviewPage';
import FloatingBanner from './components/layout/FloatingBanner';
import { useClipboardIngestion } from './hooks/useClipboardIngestion';

import { useEffect } from 'react';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const { roomCode, loading } = useRoomContext();

  if (loading) {
    return (
      <div className="setup-page">
        <div className="setup-container text-center">
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💰</div>
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is in a room → show app with bottom nav
  // If not → show setup pages (no bottom nav)
  const inRoom = !!roomCode;

  return (
    <div className="app-container">
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Routes>
          {/* Setup routes (no bottom nav) */}
          <Route path="/" element={inRoom ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/create" element={<CreateRoom />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/join/:code" element={<JoinFromLink />} />
          <Route path="/personal" element={<PersonalSetup />} />
          <Route path="/share/:code" element={inRoom ? <ShareRoom /> : <Navigate to="/" replace />} />

          {/* App routes (with bottom nav) — redirect to landing if not in room */}
          <Route path="/dashboard" element={inRoom ? <DashboardPage /> : <Navigate to="/" replace />} />
          <Route path="/add" element={inRoom ? <AddExpense /> : <Navigate to="/" replace />} />
          <Route path="/history" element={inRoom ? <ExpenseList /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={inRoom ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/review" element={inRoom ? <ReviewPage /> : <Navigate to="/" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={inRoom ? '/dashboard' : '/'} replace />} />
        </Routes>
      </AnimatePresence>

      <ShowNavGuard />
    </div>
  );
}

function ShowNavGuard() {
  const location = useLocation();
  const { roomCode } = useRoomContext();
  const hideOn = ['/share', '/create', '/join', '/personal'];
  // Guard 1: not inside a room yet
  if (!roomCode) return null;
  // Guard 2: setup/landing routes
  const shouldHide = hideOn.some(p => location.pathname.startsWith(p)) || location.pathname === '/';
  if (shouldHide) return null;
  return <IngestionManager />;
}

function IngestionManager() {
  const { pendingCount, ingestionError, ingestionSuccess, clearIngestionError, clearIngestionSuccess } = useClipboardIngestion();

  return (
    <>
      {ingestionError && (
        <div className="ingestion-banner">
          <div className="ingestion-banner-content">
            <span className="ingestion-banner-icon">⚠️</span>
            <span>{ingestionError}</span>
          </div>
          <button 
            className="ingestion-banner-close" 
            onClick={clearIngestionError} 
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
      )}
      {ingestionSuccess && (
        <div className="ingestion-banner" style={{ background: 'rgba(0, 206, 201, 0.15)', color: 'var(--success)', borderColor: 'rgba(0, 206, 201, 0.25)' }}>
          <div className="ingestion-banner-content">
            <span className="ingestion-banner-icon">✅</span>
            <span>{ingestionSuccess}</span>
          </div>
          <button 
            className="ingestion-banner-close" 
            style={{ color: 'var(--success)' }}
            onClick={clearIngestionSuccess} 
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
      )}
      <FloatingBanner pendingCount={pendingCount} />
      <BottomNav pendingCount={pendingCount} />
    </>
  );
}

/**
 * Handle deep-link join: /join/ROOMCODE
 * Auto-joins the room from the URL parameter
 */
function JoinFromLink() {
  const { joinRoomSession, roomCode } = useRoomContext();
  const params = new URL(window.location.href);
  const code = window.location.pathname.split('/join/')[1]?.toUpperCase();

  if (roomCode) {
    return <Navigate to="/dashboard" replace />;
  }

  if (code && code.length === 6) {
    // Attempt to join via the code
    joinRoomSession(code);
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/join" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
