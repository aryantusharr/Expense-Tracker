import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

import { useEffect, useState } from 'react';

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

function FloatingClipboardButton({ manualProcessClipboard }) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const [iconState, setIconState] = useState('IDLE');

  if (!isIOS) return null;

  const handleTap = async () => {
    if (iconState !== 'IDLE') return;
    const status = await manualProcessClipboard();

    if (status === 'SUCCESS') setIconState('SUCCESS');
    else if (status === 'INCOME_ERROR') setIconState('INCOME_ERROR');
    else setIconState('UNRECOGNIZED');

    setTimeout(() => {
      setIconState('IDLE');
    }, 2000);
  };

  const getIcon = () => {
    switch (iconState) {
      case 'SUCCESS': return '✅';
      case 'INCOME_ERROR': return '⚠️';
      case 'UNRECOGNIZED': return <span style={{ color: '#ff4d4f' }}>✗</span>;
      default: return '📋';
    }
  };

  const getAnimation = () => {
    if (iconState === 'IDLE') return { scale: 1, rotate: 0, x: 0 };
    if (iconState === 'SUCCESS') {
      return {
        scale: [1, 1.2, 1.1],
        rotate: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.5 }
      };
    }
    return {
      x: [0, -6, 6, -6, 6, 0],
      transition: { duration: 0.4 }
    };
  };

  return (
    <motion.button
      onClick={handleTap}
      whileTap={{ scale: 0.9 }}
      animate={getAnimation()}
      style={{
        position: 'fixed',
        bottom: '120px',
        right: '20px',
        width: '50px',
        height: '50px',
        borderRadius: '25px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        color: 'white',
        zIndex: 50,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
      }}
    >
      {getIcon()}
    </motion.button>
  );
}

function IngestionManager() {
  const { pendingCount, ingestionError, ingestionSuccess, clearIngestionError, clearIngestionSuccess, manualProcessClipboard } = useClipboardIngestion();

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
      <FloatingClipboardButton manualProcessClipboard={manualProcessClipboard} />
    </>
  );
}

/**
 * Handle deep-link join: /join/ROOMCODE
 * Auto-joins the room from the URL parameter
 */
function JoinFromLink() {
  const { joinRoomSession, roomCode } = useRoomContext();
  // eslint-disable-next-line no-unused-vars
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
