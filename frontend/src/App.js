import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginCard from "./components/auth/LoginPage";
import PortfolioPage from "./pages/PortfolioPage";
import EntityPage from "./pages/EntityPage";
import SectorPage from "./pages/SectorPage";
import NotificationPage from "./pages/NotificationPage";
import ToastContainer from "./features/notifications/components/ToastContainer";
import { usePriceAlerts } from "./features/notifications/hooks/usePriceAlerts";
import { useNewsNotifications } from "./features/notifications/hooks/useNewsNotifications";
import { useNotificationSocket } from "./features/notifications/hooks/useNotificationSocket";

function App() {
  // Activate price alert monitoring (polls every 60 seconds)
  usePriceAlerts({
    pollingInterval: 60000, // 1 minute
    enabled: true,
  });

  // Activate news monitoring (polls every 5 minutes)
  useNewsNotifications({
    pollingInterval: 300000, // 5 minutes
    enabled: true,
  });

  // Activate WebSocket for real-time notifications (optional - app works without it)
  // Use a consistent client ID (in production, use actual user ID from auth)
  const clientId = `client-${typeof window !== 'undefined' ? window.localStorage.getItem('clientId') || (() => {
    const id = `user-${Date.now()}`;
    window.localStorage.setItem('clientId', id);
    return id;
  })() : 'default'}`;

  const { isConnected, hasError } = useNotificationSocket(clientId, {
    autoConnect: false, // Temporarily disabled - WebSocket hanging on Windows
    maxReconnectAttempts: 3, // Reduced attempts to fail faster in development
    onConnect: () => console.log('📡 Real-time notifications connected'),
    onDisconnect: () => console.log('📡 Real-time notifications disconnected'),
    onError: (error) => {
      // Suppress error messages in development when backend is not running
      if (process.env.NODE_ENV === 'development') {
        console.log('💡 Tip: Start the backend server to enable real-time notifications');
      }
    },
  });

  // Log connection status for debugging (development only)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (isConnected) {
        console.log('✅ WebSocket Status: Connected');
      } else if (hasError) {
        console.log('⚠️ WebSocket Status: Unavailable (app will work without real-time updates)');
      }
    }
  }, [isConnected, hasError]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginCard />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/entity" element={<EntityPage />} />
        <Route path="/sector_page" element={<SectorPage />} />
        <Route path="/notifications" element={<NotificationPage />} />
        <Route path="/" element={<LoginCard />} />
      </Routes>
      {/* Global Toast Notification Container */}
      <ToastContainer />
    </Router>
  );
}

export default App;