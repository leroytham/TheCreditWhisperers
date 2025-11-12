// hooks/useAuth.js
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';

/**
 * Custom hook to handle authentication initialization and state management
 * This hook:
 * 1. Checks URL params for user info from OAuth callback
 * 2. Checks sessionStorage for existing session
 * 3. Synchronizes auth state to Zustand store
 * 4. Handles redirects for unauthenticated users
 */
export const useAuth = (requireAuth = false) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, isAuthenticated } = useAppStore();

  useEffect(() => {
    // Function to initialize auth state
    const initializeAuth = () => {
      // Check URL params first (OAuth callback)
      const urlParams = new URLSearchParams(location.search);
      const userFromUrl = urlParams.get('user');
      const avatarFromUrl = urlParams.get('avatar');

      if (userFromUrl) {
        console.log('Authenticating user from URL params:', userFromUrl);

        // Store in sessionStorage
        sessionStorage.setItem('user', userFromUrl);
        if (avatarFromUrl) {
          sessionStorage.setItem('avatar', avatarFromUrl);
        }

        // Update Zustand store (this triggers re-renders!)
        // setUser automatically sets isAuthenticated based on user value
        setUser({
          username: userFromUrl,
          avatar: avatarFromUrl || null
        });

        // Clean up URL (remove auth params)
        urlParams.delete('user');
        urlParams.delete('avatar');
        const newSearch = urlParams.toString();
        const newUrl = location.pathname + (newSearch ? `?${newSearch}` : '');

        // Replace current history entry to clean URL
        window.history.replaceState({}, document.title, newUrl);

        return true; // Auth successful
      }

      // Check sessionStorage for existing session
      const storedUser = sessionStorage.getItem('user');
      if (storedUser) {
        console.log('Restoring user from session:', storedUser);

        const storedAvatar = sessionStorage.getItem('avatar');

        // Sync to Zustand if not already there
        if (!user || user.username !== storedUser) {
          setUser({
            username: storedUser,
            avatar: storedAvatar || null
          });
          // setUser automatically sets isAuthenticated to true
        }

        return true; // Auth successful
      }

      // No auth found
      console.log('No authentication found');
      // No need to set isAuthenticated - it's already false if user is null
      return false;
    };

    // Initialize authentication
    const isAuthenticated = initializeAuth();

    // Handle protected routes
    if (requireAuth && !isAuthenticated) {
      console.log('Redirecting to login - authentication required');
      navigate('/');
    }
  }, [location.search]); // Re-run when URL params change

  // Return auth state and helper functions
  return {
    user,
    isAuthenticated, // Use isAuthenticated from store directly
    logout: () => {
      // Clear sessionStorage
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('avatar');
      sessionStorage.removeItem('primaryPortfolio');
      sessionStorage.removeItem('secondaryPortfolio');

      // Clear Zustand store
      setUser(null); // This automatically sets isAuthenticated to false

      // Redirect to login
      navigate('/');
    }
  };
};

/**
 * Hook to require authentication for a component
 * Redirects to login if not authenticated
 */
export const useRequireAuth = () => {
  return useAuth(true);
};