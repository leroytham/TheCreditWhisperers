/**
 * App Component Tests
 *
 * Tests for the main App component including:
 * - Component rendering
 * - Notification hooks initialization
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock react-router-dom to avoid router nesting issues
// App.js uses BrowserRouter internally, so we mock it to use MemoryRouter instead
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={['/']}>{children}</actual.MemoryRouter>
    ),
    useNavigate: () => mockNavigate,
  };
});

// Mock the child components to isolate App testing
jest.mock('./components/auth/LoginPage', () => ({
  __esModule: true,
  default: () => <div data-testid="login-page">Login Page</div>,
}));

jest.mock('./pages/PortfolioPage', () => ({
  __esModule: true,
  default: () => <div data-testid="portfolio-page">Portfolio Page</div>,
}));

jest.mock('./pages/EntityPage', () => ({
  __esModule: true,
  default: () => <div data-testid="entity-page">Entity Page</div>,
}));

jest.mock('./pages/SectorPage', () => ({
  __esModule: true,
  default: () => <div data-testid="sector-page">Sector Page</div>,
}));

jest.mock('./pages/NotificationPageEnhanced', () => ({
  __esModule: true,
  default: () => <div data-testid="notifications-page">Notifications Page</div>,
}));

jest.mock('./features/notifications/components/ToastContainer', () => ({
  __esModule: true,
  default: () => <div data-testid="toast-container">Toast Container</div>,
}));

// Mock React Query DevTools
jest.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => null,
}));

// Mock the notification hooks
jest.mock('./features/notifications/hooks/usePriceAlerts', () => ({
  usePriceAlerts: jest.fn(),
}));

jest.mock('./features/notifications/hooks/useNewsNotifications', () => ({
  useNewsNotifications: jest.fn(),
}));

jest.mock('./features/notifications/hooks/useNotificationSocket', () => ({
  useNotificationSocket: jest.fn(),
}));

// Import App after mocks are set up
import App from './App';

// Import mocks for manipulation in tests
const { useNotificationSocket } = require('./features/notifications/hooks/useNotificationSocket');
const { usePriceAlerts } = require('./features/notifications/hooks/usePriceAlerts');
const { useNewsNotifications } = require('./features/notifications/hooks/useNewsNotifications');

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations after clearAllMocks
    useNotificationSocket.mockReturnValue({
      isConnected: false,
      hasError: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connectionState: 'disconnected',
    });
  });

  describe('Component Structure', () => {
    it('renders without crashing', () => {
      render(<App />);
      // App should render successfully
      expect(document.body).toBeTruthy();
    });

    it('renders ToastContainer globally', () => {
      render(<App />);
      expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    });

    it('renders login page by default (redirects from /)', () => {
      render(<App />);
      // The "/" route redirects to "/login"
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  describe('Notification Hooks Initialization', () => {
    it('initializes usePriceAlerts hook with correct config', () => {
      render(<App />);

      expect(usePriceAlerts).toHaveBeenCalledWith({
        pollingInterval: 60000,
        enabled: true,
      });
    });

    it('initializes useNewsNotifications hook with correct config', () => {
      render(<App />);

      expect(useNewsNotifications).toHaveBeenCalledWith({
        pollingInterval: 300000,
        enabled: true,
      });
    });

    it('initializes useNotificationSocket hook with autoConnect disabled', () => {
      render(<App />);

      expect(useNotificationSocket).toHaveBeenCalled();
      // Verify WebSocket is configured with autoConnect: false (disabled)
      expect(useNotificationSocket).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          autoConnect: false,
          maxReconnectAttempts: 3,
        })
      );
    });
  });

  describe('Connection Status Handling', () => {
    it('handles connected state without errors', () => {
      useNotificationSocket.mockReturnValue({
        isConnected: true,
        hasError: false,
      });

      render(<App />);
      // Should render without errors when connected
      expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    });

    it('handles error state gracefully', () => {
      useNotificationSocket.mockReturnValue({
        isConnected: false,
        hasError: true,
      });

      render(<App />);
      // Should render without errors even when WebSocket has error
      expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    });
  });
});
