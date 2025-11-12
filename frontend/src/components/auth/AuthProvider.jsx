// components/auth/AuthProvider.jsx
import React from 'react';
import { useAuth } from '../../hooks/useAuth';

/**
 * AuthProvider component that initializes authentication state at the app level
 * This ensures authentication is checked and state is synchronized on app load
 */
export const AuthProvider = ({ children }) => {
  // Initialize authentication state
  // This will check URL params and sessionStorage, then sync to Zustand
  useAuth();

  // Render children once auth is initialized
  return <>{children}</>;
};

export default AuthProvider;