import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import EntitySearch from '../../features/entity/components/EntitySearch/EntitySearch';
import NotificationDropdown from '../../features/notifications/components/NotificationDropdown';
import { useTickerSearch } from '../../features/entity/hooks/useTickerSearch';

/**
 * AppHeader Component
 *
 * Unified header for the entire application with two-tier structure:
 * 1. Top tier: App branding + search + user actions
 * 2. Bottom tier: Main navigation tabs
 *
 * @param {string} activeTab - Current active tab ('portfolio' | 'sector' | 'entity')
 * @param {function} onLogout - Logout handler
 * @param {function} onTickerSelect - Ticker selection handler (for Entity page)
 * @param {boolean} showEntitySearch - Whether to show entity-specific search design (default: false)
 */
const AppHeader = ({ activeTab = 'entity', onLogout, onTickerSelect, showEntitySearch = false }: {
  activeTab?: string;
  onLogout: any;
  onTickerSelect?: any;
  showEntitySearch?: boolean;
}) => {
  const navigate = useNavigate();
  const { searchTerm, setSearchTerm, suggestions, loading, clearSearch } = useTickerSearch();

  // Handle ticker selection for general search
  const handleGeneralTickerSelect = (symbol) => {
    const ticker = symbol.toUpperCase().trim();
    clearSearch();
    // Navigate to entity page with the ticker as a query parameter
    navigate(`/entity?ticker=${ticker}`);
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      {/* Top Tier: Branding + Search + User Actions */}
      <div className="border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Application Title */}
            <div className="flex items-center space-x-4">
              <span className="font-bold text-xl tracking-wider text-gray-800">News Screener</span>
            </div>

            {/* Right: Search bar and action icons */}
            <div className="flex items-center space-x-4">
              {/* Conditional Search: Entity-specific or General */}
              {showEntitySearch ? (
                <EntitySearch onTickerSelect={onTickerSelect} />
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search client book, B-gap, and more"
                    className="hidden md:block w-72 pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>

                  {/* Suggestions Dropdown */}
                  {searchTerm.length > 1 && suggestions.length > 0 && (
                    <div className="absolute left-0 top-full w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 z-30 max-h-96 overflow-y-auto">
                      {loading && (
                        <div className="p-4 text-center text-gray-500">Loading...</div>
                      )}

                      {!loading &&
                        Array.from(
                          new Map(
                            suggestions
                              .filter(q => q.quoteType === 'EQUITY')
                              .map(q => [q.symbol, q])
                          ).values()
                        ).map((q, idx) => (
                          <div
                            key={q.symbol + '-' + idx}
                            onClick={() => handleGeneralTickerSelect(q.symbol)}
                            className="px-4 py-3 cursor-pointer hover:bg-gray-100"
                          >
                            <p className="font-bold text-sm">{q.symbol}</p>
                            <p className="text-xs text-gray-600 truncate">
                              {q.shortname || q.longname}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notification Dropdown - notifications fetched internally via React Query */}
              <NotificationDropdown />

              {/* User Profile */}
              <button
                onClick={onLogout}
                className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-semibold text-sm hover:bg-gray-300"
              >
                U
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tier: Main Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 -mb-px">
            {/* Portfolio Tab */}
            <button
              onClick={() => navigate('/portfolio')}
              className={`py-4 px-1 text-sm font-medium ${
                activeTab === 'portfolio'
                  ? 'active-main-nav text-gray-900 font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              PORTFOLIO
            </button>

            {/* Sector Tab */}
            <button
              onClick={() => navigate('/sector_page')}
              className={`py-4 px-1 text-sm font-medium ${
                activeTab === 'sector'
                  ? 'active-main-nav text-gray-900 font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              SECTOR
            </button>

            {/* Entity Tab */}
            <button
              onClick={() => navigate('/entity')}
              className={`py-4 px-1 text-sm font-medium ${
                activeTab === 'entity'
                  ? 'active-main-nav text-gray-900 font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ENTITY
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default AppHeader;
