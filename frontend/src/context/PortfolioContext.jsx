import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import useAppStore from '../store/useAppStore';

/**
 * PortfolioContext - Centralized state management for portfolio data
 *
 * Replaces the scattered state management across components including:
 * - sessionStorage direct access
 * - window.dispatchEvent event bus pattern
 * - Duplicate state in multiple components
 *
 * Provides:
 * - Single source of truth for selected account
 * - Cached holdings data
 * - Loading and error states
 * - Actions to update state in a controlled manner
 */

// Action types
const ACTIONS = {
  SELECT_ACCOUNT: 'SELECT_ACCOUNT',
  SET_HOLDINGS: 'SET_HOLDINGS',
  SET_PERFORMANCE: 'SET_PERFORMANCE',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ACCOUNT: 'CLEAR_ACCOUNT',
  UPDATE_CACHE: 'UPDATE_CACHE',
};

// Initial state
const initialState = {
  // Selected account info
  selectedAccount: null, // { username, accountName, accountNumber }

  // Cached data
  holdings: null,
  performance: null,

  // UI states
  loading: {
    holdings: false,
    performance: false,
    account: false,
  },

  error: {
    holdings: null,
    performance: null,
    account: null,
  },

  // Cache metadata
  lastFetch: {
    holdings: null,
    performance: null,
  },
};

// Reducer function
function portfolioReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SELECT_ACCOUNT:
      return {
        ...state,
        selectedAccount: {
          username: action.payload.username,
          accountName: action.payload.accountName,
          accountNumber: action.payload.accountNumber,
        },
        // Clear cached data when account changes
        holdings: null,
        performance: null,
        lastFetch: {
          holdings: null,
          performance: null,
        },
        error: {
          holdings: null,
          performance: null,
          account: null,
        },
      };

    case ACTIONS.SET_HOLDINGS:
      return {
        ...state,
        holdings: action.payload,
        loading: { ...state.loading, holdings: false },
        error: { ...state.error, holdings: null },
        lastFetch: { ...state.lastFetch, holdings: Date.now() },
      };

    case ACTIONS.SET_PERFORMANCE:
      return {
        ...state,
        performance: action.payload,
        loading: { ...state.loading, performance: false },
        error: { ...state.error, performance: null },
        lastFetch: { ...state.lastFetch, performance: Date.now() },
      };

    case ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value },
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: { ...state.error, [action.payload.key]: action.payload.message },
        loading: { ...state.loading, [action.payload.key]: false },
      };

    case ACTIONS.CLEAR_ACCOUNT:
      return initialState;

    case ACTIONS.UPDATE_CACHE:
      return {
        ...state,
        [action.payload.key]: action.payload.data,
        lastFetch: { ...state.lastFetch, [action.payload.key]: Date.now() },
      };

    default:
      return state;
  }
}

// Create context
const PortfolioContext = createContext(null);

// Provider component
export function PortfolioProvider({ children }) {
  const [state, dispatch] = useReducer(portfolioReducer, initialState);

  // Get user from Zustand store to properly sync with authentication
  const { user } = useAppStore();

  // Initialize from sessionStorage on mount and when user changes
  useEffect(() => {
    // Use user from Zustand store (already synchronized by AuthProvider)
    const username = user?.username || sessionStorage.getItem('user');
    const accountName = sessionStorage.getItem('selectedAccountName');
    const accountNumber = sessionStorage.getItem('selectedAccountNo');

    if (username && accountName) {
      dispatch({
        type: ACTIONS.SELECT_ACCOUNT,
        payload: { username, accountName, accountNumber },
      });

      // Clean up sessionStorage after migration
      sessionStorage.removeItem('selectedAccountName');
      sessionStorage.removeItem('selectedAccountNo');
      // Keep 'user' for authentication purposes
    } else if (username && !accountName) {
      // User is authenticated but no account selected yet
      // This happens on first login
      dispatch({
        type: ACTIONS.SELECT_ACCOUNT,
        payload: { username, accountName: null, accountNumber: null },
      });
    }
  }, [user]); // Re-run when user changes (this fixes the login issue!)

  // Action creators - memoized to prevent infinite re-renders
  const actions = useMemo(() => ({
    selectAccount: (username, accountName, accountNumber) => {
      dispatch({
        type: ACTIONS.SELECT_ACCOUNT,
        payload: { username, accountName, accountNumber },
      });
    },

    setHoldings: (holdings) => {
      dispatch({
        type: ACTIONS.SET_HOLDINGS,
        payload: holdings,
      });
    },

    setPerformance: (performance) => {
      dispatch({
        type: ACTIONS.SET_PERFORMANCE,
        payload: performance,
      });
    },

    setLoading: (key, value) => {
      dispatch({
        type: ACTIONS.SET_LOADING,
        payload: { key, value },
      });
    },

    setError: (key, message) => {
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { key, message },
      });
    },

    clearAccount: () => {
      dispatch({ type: ACTIONS.CLEAR_ACCOUNT });
      // Note: 'user' session is managed at the app level for authentication
    },

    updateCache: (key, data) => {
      dispatch({
        type: ACTIONS.UPDATE_CACHE,
        payload: { key, data },
      });
    },
  }), [dispatch]);

  const value = useMemo(() => ({
    ...state,
    actions,
  }), [state, actions]);

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

// Custom hook to use the portfolio context
export function usePortfolio() {
  const context = useContext(PortfolioContext);

  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }

  return context;
}

// Utility hook to check if data is stale (older than 5 minutes)
export function useIsDataStale(key, maxAge = 5 * 60 * 1000) {
  const { lastFetch } = usePortfolio();

  if (!lastFetch[key]) return true;

  return Date.now() - lastFetch[key] > maxAge;
}

export default PortfolioContext;
