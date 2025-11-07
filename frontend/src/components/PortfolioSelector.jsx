import React, { useEffect, useState } from 'react';
import useAppStore from '../store/useAppStore';

/**
 * PortfolioSelector Component
 *
 * Dropdown selector for switching between user portfolios.
 * Displays portfolio name, holdings count, and primary indicator.
 * Integrates with global state management.
 */
const PortfolioSelector = ({ className = '' }) => {
  const {
    selectedPortfolio,
    userPortfolios,
    portfoliosLoading,
    portfoliosError,
    setSelectedPortfolio,
    loadUserPortfolios,
    setPrimaryPortfolio,
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(null);

  // Load portfolios on mount
  useEffect(() => {
    loadUserPortfolios();
  }, [loadUserPortfolios]);

  const handleSelectPortfolio = (portfolio) => {
    setSelectedPortfolio(portfolio);
    setIsOpen(false);
  };

  const handleSetPrimary = async (e, portfolio) => {
    e.stopPropagation();
    setSettingPrimary(portfolio.id);
    try {
      await setPrimaryPortfolio(portfolio.id);
      await loadUserPortfolios();
    } catch (error) {
      console.error('Failed to set primary portfolio:', error);
    } finally {
      setSettingPrimary(null);
    }
  };

  if (portfoliosError) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
        <p className="text-sm text-red-600">Failed to load portfolios</p>
      </div>
    );
  }

  if (portfoliosLoading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${className}`}>
        <p className="text-sm text-gray-600">Loading portfolios...</p>
      </div>
    );
  }

  if (!userPortfolios || userPortfolios.length === 0) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-3 ${className}`}>
        <p className="text-sm text-yellow-600">No portfolios found</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Selected Portfolio Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-lg p-3 flex items-center justify-between hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Portfolio Icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>

          {/* Portfolio Details */}
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {selectedPortfolio?.portfolio_name || selectedPortfolio?.account_name}
              </p>
              {selectedPortfolio?.is_primary && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                  Primary
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600">
              {selectedPortfolio?.holdings_count || 0} holdings • $
              {(selectedPortfolio?.total_value || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          {/* Dropdown Arrow */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown List */}
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            <div className="py-1">
              {userPortfolios.map((portfolio) => (
                <div
                  key={portfolio.id}
                  onClick={() => handleSelectPortfolio(portfolio)}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedPortfolio?.id === portfolio.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {portfolio.portfolio_name || portfolio.account_name}
                        </p>
                        {portfolio.is_primary && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                            Primary
                          </span>
                        )}
                        {selectedPortfolio?.id === portfolio.id && (
                          <svg
                            className="w-4 h-4 text-blue-600 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {portfolio.holdings_count || 0} holdings • $
                        {(portfolio.total_value || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      {portfolio.tickers && portfolio.tickers.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {portfolio.tickers.slice(0, 5).join(', ')}
                          {portfolio.tickers.length > 5 && ` +${portfolio.tickers.length - 5} more`}
                        </p>
                      )}
                    </div>

                    {/* Set Primary Button */}
                    {!portfolio.is_primary && (
                      <button
                        onClick={(e) => handleSetPrimary(e, portfolio)}
                        disabled={settingPrimary === portfolio.id}
                        className="ml-3 flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {settingPrimary === portfolio.id ? 'Setting...' : 'Set Primary'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Footer */}
            <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
              <p className="text-xs text-gray-600">
                {userPortfolios.length} portfolio{userPortfolios.length !== 1 ? 's' : ''} • Total: $
                {userPortfolios
                  .reduce((sum, p) => sum + (p.total_value || 0), 0)
                  .toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PortfolioSelector;
