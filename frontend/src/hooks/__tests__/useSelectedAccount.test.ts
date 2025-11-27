/**
 * useSelectedAccount Hook Tests
 *
 * Tests for the selected account state hook that wraps Zustand store
 * with useShallow for optimized selectors.
 */

import { renderHook } from '@testing-library/react';
import { useSelectedAccount } from '../useSelectedAccount';
import useAppStore from '../../store/useAppStore';
import type { SelectedAccount } from '../../types';

// Mock the Zustand store
jest.mock('../../store/useAppStore');

// Mock useShallow from zustand
jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

describe('useSelectedAccount', () => {
  // Default mock actions
  const mockSelectAccount = jest.fn();
  const mockClearSelectedAccount = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to setup mock store state
  const setupMockStore = (selectedAccount: SelectedAccount | null = null) => {
    const state = {
      selectedAccount,
      selectAccount: mockSelectAccount,
      clearSelectedAccount: mockClearSelectedAccount,
    };

    mockUseAppStore.mockImplementation((selector: (state: typeof state) => unknown) => {
      return selector(state);
    });
  };

  describe('No Account Selected', () => {
    it('returns null selectedAccount when none selected', () => {
      setupMockStore(null);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.selectedAccount).toBeNull();
    });

    it('returns hasAccount as false when none selected', () => {
      setupMockStore(null);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.hasAccount).toBe(false);
    });

    it('returns null for username when no account', () => {
      setupMockStore(null);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.username).toBeNull();
    });

    it('returns null for accountName when no account', () => {
      setupMockStore(null);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.accountName).toBeNull();
    });

    it('returns null for accountNumber when no account', () => {
      setupMockStore(null);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.accountNumber).toBeNull();
    });
  });

  describe('Account Selected', () => {
    const testAccount: SelectedAccount = {
      username: 'john@example.com',
      accountName: 'Main Portfolio',
      accountNumber: 'ACC-12345',
    };

    it('returns selectedAccount object when selected', () => {
      setupMockStore(testAccount);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.selectedAccount).toEqual(testAccount);
    });

    it('returns hasAccount as true when account exists', () => {
      setupMockStore(testAccount);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.hasAccount).toBe(true);
    });

    it('returns username from selected account', () => {
      setupMockStore(testAccount);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.username).toBe('john@example.com');
    });

    it('returns accountName from selected account', () => {
      setupMockStore(testAccount);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.accountName).toBe('Main Portfolio');
    });

    it('returns accountNumber from selected account', () => {
      setupMockStore(testAccount);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.accountNumber).toBe('ACC-12345');
    });
  });

  describe('Account Without Optional Fields', () => {
    it('handles account without accountNumber', () => {
      const accountWithoutNumber: SelectedAccount = {
        username: 'jane@example.com',
        accountName: 'Secondary Portfolio',
      };
      setupMockStore(accountWithoutNumber);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.selectedAccount).toEqual(accountWithoutNumber);
      expect(result.current.username).toBe('jane@example.com');
      expect(result.current.accountName).toBe('Secondary Portfolio');
      expect(result.current.accountNumber).toBeNull();
    });
  });

  describe('Actions', () => {
    it('returns selectAccount function from store', () => {
      setupMockStore();

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.selectAccount).toBe(mockSelectAccount);
    });

    it('returns clearSelectedAccount function from store', () => {
      setupMockStore();

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.clearSelectedAccount).toBe(mockClearSelectedAccount);
    });

    it('calls selectAccount with username and accountName', () => {
      setupMockStore();

      const { result } = renderHook(() => useSelectedAccount());
      result.current.selectAccount('user@example.com', 'Portfolio A');

      expect(mockSelectAccount).toHaveBeenCalledWith('user@example.com', 'Portfolio A');
    });

    it('calls selectAccount with optional accountNumber', () => {
      setupMockStore();

      const { result } = renderHook(() => useSelectedAccount());
      result.current.selectAccount('user@example.com', 'Portfolio A', 'ACC-999');

      expect(mockSelectAccount).toHaveBeenCalledWith('user@example.com', 'Portfolio A', 'ACC-999');
    });

    it('calls clearSelectedAccount to deselect', () => {
      const existingAccount: SelectedAccount = {
        username: 'test@example.com',
        accountName: 'Test Account',
      };
      setupMockStore(existingAccount);

      const { result } = renderHook(() => useSelectedAccount());
      result.current.clearSelectedAccount();

      expect(mockClearSelectedAccount).toHaveBeenCalled();
    });
  });

  describe('Return Value Shape', () => {
    it('returns all expected properties', () => {
      setupMockStore();

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current).toHaveProperty('selectedAccount');
      expect(result.current).toHaveProperty('selectAccount');
      expect(result.current).toHaveProperty('clearSelectedAccount');
      expect(result.current).toHaveProperty('hasAccount');
      expect(result.current).toHaveProperty('username');
      expect(result.current).toHaveProperty('accountName');
      expect(result.current).toHaveProperty('accountNumber');
    });

    it('has correct types for boolean hasAccount', () => {
      setupMockStore();

      const { result } = renderHook(() => useSelectedAccount());

      expect(typeof result.current.hasAccount).toBe('boolean');
    });

    it('has correct types for functions', () => {
      setupMockStore();

      const { result } = renderHook(() => useSelectedAccount());

      expect(typeof result.current.selectAccount).toBe('function');
      expect(typeof result.current.clearSelectedAccount).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string values in account - converts to null via || operator', () => {
      const accountWithEmptyStrings: SelectedAccount = {
        username: '',
        accountName: '',
        accountNumber: '',
      };
      setupMockStore(accountWithEmptyStrings);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.hasAccount).toBe(true); // Object exists, even if empty
      // Empty strings are falsy, so || null returns null
      expect(result.current.username).toBeNull();
      expect(result.current.accountName).toBeNull();
      expect(result.current.accountNumber).toBeNull();
    });

    it('handles whitespace-only values', () => {
      const accountWithWhitespace: SelectedAccount = {
        username: '  ',
        accountName: 'Real Account',
      };
      setupMockStore(accountWithWhitespace);

      const { result } = renderHook(() => useSelectedAccount());

      expect(result.current.username).toBe('  ');
      expect(result.current.accountName).toBe('Real Account');
    });
  });
});
