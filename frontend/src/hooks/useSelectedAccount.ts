import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { SelectedAccount } from '../types';

/**
 * Return type for the useSelectedAccount hook
 */
interface UseSelectedAccountReturn {
  /** The selected account object or null */
  selectedAccount: SelectedAccount | null;
  /** Action to select an account */
  selectAccount: (username: string, accountName: string, accountNumber?: string) => void;
  /** Action to clear the selected account */
  clearSelectedAccount: () => void;
  /** Convenience boolean for conditional rendering */
  hasAccount: boolean;
  /** Username from selected account */
  username: string | null;
  /** Account name from selected account */
  accountName: string | null;
  /** Account number from selected account */
  accountNumber: string | null;
}

/**
 * Hook for selected account state.
 *
 * Bridges Zustand selectedAccount with the shape expected by components
 * that previously used PortfolioContext's selectedAccount.
 *
 * Replaces:
 * - usePortfolio() from PortfolioContext
 * - useAccountContext() from usePortfolioData.js
 *
 * @example
 * const { selectedAccount, selectAccount, clearSelectedAccount } = useSelectedAccount();
 *
 * // Select an account
 * selectAccount('john@example.com', 'Main Portfolio', 'ACC-123');
 *
 * // Access account properties
 * if (selectedAccount) {
 *   console.log(selectedAccount.username);
 *   console.log(selectedAccount.accountName);
 *   console.log(selectedAccount.accountNumber);
 * }
 *
 * // Clear selection
 * clearSelectedAccount();
 */
export function useSelectedAccount(): UseSelectedAccountReturn {
  return useAppStore(
    useShallow((state) => ({
      selectedAccount: state.selectedAccount,
      selectAccount: state.selectAccount,
      clearSelectedAccount: state.clearSelectedAccount,
      hasAccount: !!state.selectedAccount,
      username: state.selectedAccount?.username || null,
      accountName: state.selectedAccount?.accountName || null,
      accountNumber: state.selectedAccount?.accountNumber || null,
    }))
  );
}

export default useSelectedAccount;
