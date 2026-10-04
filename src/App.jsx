import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useRoomContext } from './context/RoomContext';
import useRecordOpen from './hooks/useRecordOpen';
import FloatingNav from './components/layout/FloatingNav';
import UpdateToast from './components/layout/UpdateToast';
import LandingScreen from './components/onboarding/LandingScreen';
import CreateScreen from './components/onboarding/CreateScreen';
import JoinScreen from './components/onboarding/JoinScreen';
import ShareScreen from './components/onboarding/ShareScreen';
import PersonalScreen from './components/onboarding/PersonalScreen';
import DashboardScreen from './components/dashboard/DashboardScreen';
import AddScreen from './components/add/AddScreen';
import HistoryScreen from './components/history/HistoryScreen';
import SettingsScreen from './components/settings/SettingsScreen';

import { lazy, Suspense, useEffect } from 'react';

// Redesign foundations preview — dev/test builds only (MODE is replaced at build time, so
// the production bundle doesn't include it).
const FoundationsPage = import.meta.env.MODE !== 'production'
  ? lazy(() => import('./components/dev/FoundationsPage'))
  : null;

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const { roomCode, loading } = useRoomContext();
  useRecordOpen();

  if (loading) {
    return (
      <div className="se-page" style={{ display: 'grid', placeItems: 'center' }}>
        <span style={{ fontFamily: 'var(--se-font-display)', fontWeight: 800, fontSize: 30, letterSpacing: '-.03em' }}>
          Split<span className="se-grad-text">Ease</span>
        </span>
      </div>
    );
  }

  // If user is in a room → show app with bottom nav
  // If not → show setup pages (no bottom nav)
  const inRoom = !!roomCode;

  return (
    <div className="app-container">
      <ScrollToTop />
      <UpdateToast />
      <AnimatePresence mode="wait">
        <Routes>
          {/* Setup routes (no bottom nav) */}
          <Route path="/" element={inRoom ? <Navigate to="/dashboard" replace /> : <LandingScreen />} />
          <Route path="/create" element={<CreateScreen />} />
          <Route path="/join/:code?" element={<JoinScreen />} />
          <Route path="/personal" element={<PersonalScreen />} />
          <Route path="/share/:code" element={inRoom ? <ShareScreen /> : <Navigate to="/" replace />} />

          {/* App routes (with bottom nav) — redirect to landing if not in room */}
          <Route path="/dashboard" element={inRoom ? <DashboardScreen /> : <Navigate to="/" replace />} />
          <Route path="/add" element={inRoom ? <AddScreen /> : <Navigate to="/" replace />} />
          <Route path="/history" element={inRoom ? <HistoryScreen /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={inRoom ? <SettingsScreen /> : <Navigate to="/" replace />} />
          {FoundationsPage && (
            <Route path="/foundations" element={<Suspense fallback={null}><FoundationsPage /></Suspense>} />
          )}
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
  const hideOn = ['/share', '/create', '/join', '/personal', '/foundations', '/add'];  // /add has its own close button
  // Guard 1: not inside a room yet
  if (!roomCode) return null;
  // Guard 2: setup/landing routes
  const shouldHide = hideOn.some(p => location.pathname.startsWith(p)) || location.pathname === '/';
  if (shouldHide) return null;
  return <FloatingNav />;
}


export default function App() {
  useEffect(() => {
    const handleFocusChange = () => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.getAttribute('contenteditable') === 'true'
      );
      if (isInput) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    };

    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    const handleResize = () => {
      if (window.visualViewport) {
        const isMinified = window.innerHeight - window.visualViewport.height > 150;
        if (isMinified) {
          document.body.classList.add('keyboard-open');
        } else {
          const activeEl = document.activeElement;
          const isInput = activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.getAttribute('contenteditable') === 'true'
          );
          if (!isInput) {
            document.body.classList.remove('keyboard-open');
          }
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
