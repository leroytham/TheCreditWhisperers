import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../../../services/api';
import { useUser } from '../../../../hooks/useUser';
import { useSelectedAccount } from '../../../../hooks/useSelectedAccount';
import LoadingSpinner from '../../../../components/LoadingSpinner';

/**
 * AccountSelector Component
 *
 * Displays a selectable list of accounts for the logged-in user.
 * Fetches accounts from API and manages account selection state.
 * Integrates with Zustand store via useSelectedAccount hook.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onAccountSelect - Callback function when an account is selected
 * @param {Object} props.onAccountSelect.account - The selected account object
 * @param {Function} props.onAddPortfolio - Callback function to trigger add portfolio modal
 * @returns {React.ReactElement} Rendered account selector component
 *
 * @example
 * <AccountSelector
 *   onAccountSelect={(account) => handleAccountChange(account)}
 *   onAddPortfolio={() => setIsAddPortfolioModalOpen(true)}
 * />
 */
const AccountSelector = ({ onAccountSelect, onAddPortfolio }) => {
  const navigate = useNavigate();
  const { username } = useUser();
  const { selectedAccount } = useSelectedAccount();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (username) {
      fetchAccounts(username);
    } else {
      setError('No user logged in');
      setLoading(false);
    }
  }, [username]);

  const fetchAccounts = async (user) => {
    setLoading(true);
    setError(null);
    try {
      // Use apiService instead of direct fetch
      const response = await apiService.getPortfolioAccounts(user);
      const data = response.data;

      // Transform the response to match our component structure
      const transformedAccounts = (data.accounts || []).map(account => ({
        account_name: account.client_account_name,
        account_number: account.account_no,
        // Future enhancement: Fetch analytics from GET /portfolio/summary/{username}/{account_name}
        // to display total_value, holdings_count, risk_level, performance metrics
      }));

      setAccounts(transformedAccounts);
    } catch (err) {
      // Error already handled by apiService interceptor
      setError(err.message || 'Failed to load accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountSelect = (account) => {
    onAccountSelect({
      user: { username, displayName: username },
      account
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden p-12">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden p-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          {username ? (
            <button
              onClick={() => fetchAccounts(username)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Go to Login
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Select Account</h2>
        <p className="mt-2 text-sm text-gray-600">
          Welcome back, <span className="font-medium">{username}</span>! Choose an account to view detailed portfolio analytics
        </p>
      </div>

      <div className="p-6">
        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg font-medium">No portfolios yet</p>
            <p className="text-sm text-gray-400 mt-2">Get started by adding your first client portfolio</p>
            {onAddPortfolio && (
              <button
                onClick={onAddPortfolio}
                className="mt-6 px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors font-medium"
              >
                Add Your First Portfolio
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account, index) => (
              <button
                key={account.account_number || index}
                onClick={() => handleAccountSelect(account)}
                disabled={selectedAccount?.accountNumber === account.account_number}
                className={`text-left p-6 border-2 rounded-lg transition-all ${
                  selectedAccount?.accountNumber === account.account_number
                    ? 'border-blue-600 bg-blue-50 cursor-default'
                    : 'border-gray-200 hover:border-gray-400 hover:shadow-lg bg-white'
                }`}
              >
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {account.account_name}
                    </h3>
                    {selectedAccount?.accountNumber === account.account_number && (
                      <span className="text-xs px-2 py-1 bg-blue-600 rounded text-white font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Account #{account.account_number}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-sm text-blue-600 font-medium">
                    View Details →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} available
        </p>
      </div>
    </div>
  );
};

export default AccountSelector;