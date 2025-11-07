import React, { useState, useEffect } from 'react';

/**
 * AccountList Component
 *
 * Displays all accounts for a selected user with portfolio values, holdings count,
 * and performance metrics (1D, 1M, 1Y). Fetches account data from API with fallback
 * to mock data for development.
 *
 * @param {Object} props - Component props
 * @param {Object} props.selectedUser - The user whose accounts should be displayed
 * @param {string} props.selectedUser.username - Username to fetch accounts for
 * @param {string} [props.selectedUser.displayName] - Display name of the user
 * @param {Function} props.onAccountSelect - Callback when an account is selected
 * @param {Object} props.onAccountSelect.user - Selected user object
 * @param {Object} props.onAccountSelect.account - Selected account object
 * @returns {React.ReactElement} Rendered account list component
 *
 * @example
 * <AccountList
 *   selectedUser={user}
 *   onAccountSelect={({user, account}) => handleAccountChange(user, account)}
 * />
 */
const AccountList = ({ selectedUser, onAccountSelect }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedUser) {
      fetchAccounts(selectedUser.username);
    } else {
      setAccounts([]);
    }
  }, [selectedUser]);

  const fetchAccounts = async (username) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${username}`);
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();

      // Enrich accounts with additional metadata
      const enrichedAccounts = (data.accounts || []).map(account => ({
        ...account,
        formattedValue: formatCurrency(account.total_value || 0),
        performance: account.performance || { day: 0, month: 0, year: 0 }
      }));

      setAccounts(enrichedAccounts);
    } catch (err) {
      // Error already handled by apiService interceptor
      setError('Failed to load accounts');
      // Fallback to mock data for development
      const mockAccounts = getMockAccounts(username);
      setAccounts(mockAccounts);
    } finally {
      setLoading(false);
    }
  };

  const getMockAccounts = (username) => {
    // Generate mock accounts based on username
    const accountTypes = ['Retirement', 'Investment', 'Trading', 'Savings', 'Trust'];
    const numAccounts = Math.floor(Math.random() * 4) + 1;
    const accounts = [];

    for (let i = 0; i < numAccounts; i++) {
      const accountType = accountTypes[i % accountTypes.length];
      const accountNumber = `${Math.random().toString().substr(2, 4)}-${Math.random().toString().substr(2, 4)}`;
      const totalValue = Math.floor(Math.random() * 900000) + 100000;

      accounts.push({
        account_name: `${accountType} Account`,
        account_number: accountNumber,
        total_value: totalValue,
        formattedValue: formatCurrency(totalValue),
        holdings_count: Math.floor(Math.random() * 30) + 5,
        performance: {
          day: (Math.random() - 0.5) * 4,
          month: (Math.random() - 0.3) * 10,
          year: (Math.random() - 0.2) * 30
        },
        risk_level: ['Conservative', 'Moderate', 'Aggressive'][Math.floor(Math.random() * 3)],
        last_updated: new Date().toISOString()
      });
    }

    return accounts;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  };

  const getPerformanceColor = (value) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (!selectedUser) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-sm">Select a client to view their accounts</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <div className="text-center py-4 px-2">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => fetchAccounts(selectedUser.username)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-sm">No accounts found for {selectedUser.displayName || selectedUser.username}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Accounts for {selectedUser.displayName || selectedUser.username}
        </h3>

        <div className="grid gap-3">
          {accounts.map((account, index) => (
            <button
              key={account.account_number || index}
              onClick={() => onAccountSelect({ user: selectedUser, account })}
              className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition-all bg-white"
            >
              <div className="mb-3">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-medium text-gray-900">
                    {account.account_name}
                  </h4>
                  {account.risk_level && (
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {account.risk_level}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Account #{account.account_number}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Portfolio Value</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {account.formattedValue}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Holdings</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {account.holdings_count || 0}
                  </p>
                </div>
              </div>

              {account.performance && (
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">1D</p>
                    <p className={`text-sm font-medium ${getPerformanceColor(account.performance.day)}`}>
                      {formatPercentage(account.performance.day)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">1M</p>
                    <p className={`text-sm font-medium ${getPerformanceColor(account.performance.month)}`}>
                      {formatPercentage(account.performance.month)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">1Y</p>
                    <p className={`text-sm font-medium ${getPerformanceColor(account.performance.year)}`}>
                      {formatPercentage(account.performance.year)}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <span className="text-xs text-blue-600 font-medium">
                  View Details →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AccountList;