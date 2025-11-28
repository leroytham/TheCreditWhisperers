import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginCard from "./components/auth/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import PortfolioPage from "./pages/PortfolioPage";
import EntityPage from "./pages/EntityPage";
import SectorPage from "./pages/SectorPage";
import NotificationPageEnhanced from "./pages/NotificationPageEnhanced";
import ToastContainer from "./features/notifications/components/ToastContainer";
import { usePriceAlerts } from "./features/notifications/hooks/usePriceAlerts";
import { useNewsNotifications } from "./features/notifications/hooks/useNewsNotifications";
import { useNotificationSocket } from "./features/notifications/hooks/useNotificationSocket";
import useAppStore from "./store/useAppStore";

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
  // Use a consistent client ID from Zustand store (persisted via middleware)
  const storeClientId = useAppStore(state => state.clientId);
  const clientId = `client-${storeClientId}`;

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
        <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
        <Route path="/entity" element={<ProtectedRoute><EntityPage /></ProtectedRoute>} />
        <Route path="/sector_page" element={<ProtectedRoute><SectorPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationPageEnhanced /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
      {/* Global Toast Notification Container */}
      <ToastContainer />
    </Router>
  );
}

export default App;