// frontend/src/hooks/useUser.js
import useAppStore from '../store/useAppStore';

/**
 * Hook for user authentication state.
 *
 * Replaces direct sessionStorage.getItem('user') calls throughout the app.
 * Provides a consistent interface for accessing user data from Zustand.
 *
 * Usage:
 *   const { username, isAuthenticated, setUser, logout } = useUser();
 *
 * Migration from sessionStorage:
 *   // Before:
 *   const username = sessionStorage.getItem('user');
 *
 *   // After:
 *   const { username } = useUser();
 */
export function useUser() {
  const user = useAppStore((state) => state.user);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setUser = useAppStore((state) => state.setUser);
  const logout = useAppStore((state) => state.logout);

  return {
    // The user object (could be string username or object with email/name)
    user,
    // Convenience getter for username (handles both string and object user)
    username: typeof user === 'string' ? user : user?.email || user?.name || null,
    // Auth status
    isAuthenticated,
    // Actions
    setUser,
    logout,
  };
}

export default useUser;
