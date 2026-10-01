import React from 'react';
import ReactDOM from 'react-dom/client';
import { RoomProvider } from './context/RoomContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import './index.css';
import './styles/tokens.css';
import './styles/motion.css';
import './styles/ui.css';
// App after the global styles so screen CSS can override base components.
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <RoomProvider>
          <App />
        </RoomProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
