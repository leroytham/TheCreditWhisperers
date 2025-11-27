// frontend/src/hooks/useSelectedAccount.js
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

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
 * Usage:
 *   const { selectedAccount, selectAccount, clearSelectedAccount } = useSelectedAccount();
 *
 *   // Select an account
 *   selectAccount('john@example.com', 'Main Portfolio', 'ACC-123');
 *
 *   // Access account properties
 *   if (selectedAccount) {
 *     console.log(selectedAccount.username);
 *     console.log(selectedAccount.accountName);
 *     console.log(selectedAccount.accountNumber);
 *   }
 *
 *   // Clear selection
 *   clearSelectedAccount();
 */
export function useSelectedAccount() {
  return useAppStore(
    useShallow((state) => ({
      // The selected account object { username, accountName, accountNumber } or null
      selectedAccount: state.selectedAccount,

      // Action to select an account
      selectAccount: state.selectAccount,

      // Action to clear the selected account
      clearSelectedAccount: state.clearSelectedAccount,

      // Convenience boolean for conditional rendering
      hasAccount: !!state.selectedAccount,

      // Convenience getters for common properties
      username: state.selectedAccount?.username || null,
      accountName: state.selectedAccount?.accountName || null,
      accountNumber: state.selectedAccount?.accountNumber || null,
    }))
  );
}

export default useSelectedAccount;
