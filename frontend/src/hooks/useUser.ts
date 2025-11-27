import useAppStore from '../store/useAppStore';
import type { User } from '../types';

/**
 * Return type for the useUser hook
 */
interface UseUserReturn {
  /** The user object (could be string username or User object) */
  user: User | string | null;
  /** Convenience getter for username (handles both string and object user) */
  username: string | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Set the current user */
  setUser: (user: User | string | null) => void;
  /** Log out the current user */
  logout: () => void;
}

/**
 * Hook for user authentication state.
 *
 * Replaces direct sessionStorage.getItem('user') calls throughout the app.
 * Provides a consistent interface for accessing user data from Zustand.
 *
 * @example
 * const { username, isAuthenticated, setUser, logout } = useUser();
 *
 * // Migration from sessionStorage:
 * // Before:
 * //   const username = sessionStorage.getItem('user');
 * // After:
 * //   const { username } = useUser();
 */
export function useUser(): UseUserReturn {
  const user = useAppStore((state) => state.user);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setUser = useAppStore((state) => state.setUser);
  const logout = useAppStore((state) => state.logout);

  return {
    user,
    username: typeof user === 'string' ? user : user?.email || user?.name || null,
    isAuthenticated,
    setUser,
    logout,
  };
}

export default useUser;
