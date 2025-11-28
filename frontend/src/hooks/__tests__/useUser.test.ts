/**
 * useUser Hook Tests
 *
 * Tests for the user authentication state hook that wraps Zustand store.
 */

import { renderHook, act } from '@testing-library/react';
import { useUser } from '../useUser';
import useAppStore from '../../store/useAppStore';
import type { User } from '../../types';

// Mock the Zustand store
jest.mock('../../store/useAppStore');

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

// Type for mock store state
interface MockState {
  user: User | string | null;
  isAuthenticated: boolean;
  setUser: jest.Mock;
  logout: jest.Mock;
}

describe('useUser', () => {
  // Default mock values
  const mockSetUser = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to setup mock store state
  const setupMockStore = (overrides: {
    user?: User | string | null;
    isAuthenticated?: boolean;
  } = {}) => {
    const state: MockState = {
      user: overrides.user ?? null,
      isAuthenticated: overrides.isAuthenticated ?? false,
      setUser: mockSetUser,
      logout: mockLogout,
    };

    mockUseAppStore.mockImplementation(((selector: (state: MockState) => unknown) => {
      return selector(state);
    }) as typeof useAppStore);
  };

  describe('User State', () => {
    it('returns null user when not authenticated', () => {
      setupMockStore({ user: null, isAuthenticated: false });

      const { result } = renderHook(() => useUser());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('returns string user when user is a string', () => {
      const username = 'testuser';
      setupMockStore({ user: username, isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(result.current.user).toBe(username);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('returns User object when user is an object', () => {
      const userObj: User = { email: 'test@example.com', name: 'Test User' };
      setupMockStore({ user: userObj, isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(result.current.user).toEqual(userObj);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Username Derivation', () => {
    it('returns username directly when user is a string', () => {
      setupMockStore({ user: 'john_doe', isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(result.current.username).toBe('john_doe');
    });

    it('returns email as username when user is object with email', () => {
      const userObj: User = { email: 'john@example.com', name: 'John Doe' };
      setupMockStore({ user: userObj, isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(result.current.username).toBe('john@example.com');
    });

    it('returns name as username when user object has no email', () => {
      const userObj = { name: 'Jane Doe' } as User;
      setupMockStore({ user: userObj, isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(result.current.username).toBe('Jane Doe');
    });

    it('returns null username when user is null', () => {
      setupMockStore({ user: null, isAuthenticated: false });

      const { result } = renderHook(() => useUser());

      expect(result.current.username).toBeNull();
    });

    it('returns null username when user object has neither email nor name', () => {
      const userObj = {} as User;
      setupMockStore({ user: userObj, isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(result.current.username).toBeNull();
    });
  });

  describe('Authentication State', () => {
    it('returns isAuthenticated false when not logged in', () => {
      setupMockStore({ user: null, isAuthenticated: false });

      const { result } = renderHook(() => useUser());

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('returns isAuthenticated true when logged in', () => {
      setupMockStore({ user: 'testuser', isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Actions', () => {
    it('returns setUser function from store', () => {
      setupMockStore();

      const { result } = renderHook(() => useUser());

      expect(result.current.setUser).toBe(mockSetUser);
    });

    it('returns logout function from store', () => {
      setupMockStore();

      const { result } = renderHook(() => useUser());

      expect(result.current.logout).toBe(mockLogout);
    });

    it('calls setUser with string username', () => {
      setupMockStore();

      const { result } = renderHook(() => useUser());
      result.current.setUser('newuser');

      expect(mockSetUser).toHaveBeenCalledWith('newuser');
    });

    it('calls setUser with User object', () => {
      setupMockStore();
      const newUser: User = { email: 'new@example.com', name: 'New User' };

      const { result } = renderHook(() => useUser());
      result.current.setUser(newUser);

      expect(mockSetUser).toHaveBeenCalledWith(newUser);
    });

    it('calls setUser with null to clear user', () => {
      setupMockStore({ user: 'existinguser', isAuthenticated: true });

      const { result } = renderHook(() => useUser());
      result.current.setUser(null);

      expect(mockSetUser).toHaveBeenCalledWith(null);
    });

    it('calls logout to log out user', () => {
      setupMockStore({ user: 'testuser', isAuthenticated: true });

      const { result } = renderHook(() => useUser());
      result.current.logout();

      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Return Value Shape', () => {
    it('returns all expected properties', () => {
      setupMockStore({ user: 'testuser', isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('username');
      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('setUser');
      expect(result.current).toHaveProperty('logout');
    });

    it('has correct types for all properties', () => {
      setupMockStore({ user: 'testuser', isAuthenticated: true });

      const { result } = renderHook(() => useUser());

      expect(typeof result.current.user).toBe('string');
      expect(typeof result.current.username).toBe('string');
      expect(typeof result.current.isAuthenticated).toBe('boolean');
      expect(typeof result.current.setUser).toBe('function');
      expect(typeof result.current.logout).toBe('function');
    });
  });
});
