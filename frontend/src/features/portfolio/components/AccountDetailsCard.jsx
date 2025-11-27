import React, { useMemo } from 'react';
import { useSelectedAccount } from '../../../hooks/useSelectedAccount';
import { usePortfolioOverview } from '../hooks/usePortfolioOverview';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { InlineError } from '../../../components/ErrorDisplay';
import { formatCurrency, parseNumericString } from '../../../utils/formatters';

/**
 * AccountDetailsCard Component (Refactored)
 *
 * Displays account summary including total market value and owner information
 *
 * Now uses:
 * - usePortfolioOverview hook (React Query) for data fetching with caching
 * - useSelectedAccount (Zustand) for account info
 * - Shared LoadingSpinner and ErrorDisplay components
 * - Centralized formatters
 */
const AccountDetailsCard = () => {
  const { selectedAccount } = useSelectedAccount();
  const { holdings, holdingsLoading, holdingsError, refetchHoldings } = usePortfolioOverview();

  const loading = holdingsLoading;
  const error = holdingsError;
  const refetch = refetchHoldings;

  // Calculate total market value from holdings
  const totalValue = useMemo(() => {
    if (!holdings) return 0;

    const holdingsArray = Array.isArray(holdings) ? holdings : holdings.holdings || [];

    return holdingsArray.reduce((total, holding) => {
      const numericValue = parseNumericString(holding.position);
      return total + numericValue;
    }, 0);
  }, [holdings]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Account Details</h2>

      {/* Total Market Value */}
      <p className="text-sm text-gray-500 mt-2">Total Market Value</p>

      {loading ? (
        <div className="mt-3">
          <LoadingSpinner size="md" />
        </div>
      ) : error ? (
        <div className="mt-3">
          <InlineError message={error?.message || String(error)} onRetry={refetch} />
        </div>
      ) : (
        <p className="text-5xl text-gray-900 mt-2">
          <span className="text-2xl align-super">$</span>
          <span className="font-bold">
            {totalValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
      )}

      {/* Account Owner and Number */}
      {selectedAccount && (
        <div className="flex justify-between text-sm mt-6">
          <div>
            <p className="text-gray-500">Primary Owner</p>
            <p className="font-medium">{selectedAccount.accountName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-500">Account #</p>
            <p className="font-medium">{selectedAccount.accountNumber || 'N/A'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDetailsCard;