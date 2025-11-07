import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import ErrorBoundary from '../components/ErrorBoundary';
import ClientInfoBar from '../features/portfolio/components/ClientInfoBar';
import AccountDetailsCard from '../features/portfolio/components/AccountDetailsCard';
import PerformanceCard from '../features/portfolio/components/PerformanceCard';
import NewsFeedCard from '../features/portfolio/components/NewsFeedCard';
import TopHoldingsTable from '../features/portfolio/components/TopHoldingsTable';
import KeyThemesCard from '../features/portfolio/components/KeyThemesCard';
import OpportunitiesCard from '../features/portfolio/components/OpportunitiesCard';
import AddPortfolioModal from '../features/portfolio/components/modals/AddPortfolioModal';
import EditPortfolioModal from '../features/portfolio/components/modals/EditPortfolioModal';
import { AccountSelector } from '../features/portfolio/components/AccountSelector';
import PortfolioPerformanceDetail from '../features/portfolio/components/PerformanceDetail/PortfolioPerformanceDetail';
import PortfolioSentimentView from '../features/portfolio/components/SentimentView/PortfolioSentimentView';
import PortfolioHoldingsDetail from '../features/portfolio/components/HoldingsDetail/PortfolioHoldingsDetail';
import { DetailedRelatedNews } from '../features/shared/components';
import { usePortfolioNews } from '../features/portfolio/hooks/usePortfolioNews';
import { useAccountContext } from '../hooks/usePortfolioData';

/**
 * PortfolioPage Component
 *
 * Main portfolio overview and detail page with multi-tab navigation.
 * Manages the entire portfolio experience including account selection,
 * overview dashboard, and detailed analysis views.
 *
 * Page Structure:
 * - Account Selection View: Choose which portfolio to view
 * - Overview Tab: Dashboard with performance, news, holdings summary
 * - Performance Tab: Detailed charts and attribution analysis
 * - Holdings Tab: Complete holdings breakdown with analytics
 * - Sentiment Tab: AI-powered sentiment analysis across holdings
 * - News Tab: Comprehensive news feed with filtering
 *
 * Modal Management:
 * - Account Details Modal
 * - Add Portfolio Modal
 * - Edit Portfolio Modal
 *
 * State Management:
 * - Uses PortfolioContext for centralized account/data state
 * - URL query params for deep linking to specific views
 * - Session management for user authentication
 *
 * @returns {React.ReactElement} Rendered portfolio page component
 *
 * @example
 * // Rendered by React Router
 * <Route path="/portfolio" element={<PortfolioPage />} />
 */
const PortfolioPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Use PortfolioContext for centralized account state
  const { selectedAccount, selectAccount, clearAccount } = useAccountContext();

  // View state: 'select' for account selection or 'detail' for portfolio details
  const [view, setView] = useState(selectedAccount ? 'detail' : 'select');

  // Fetch portfolio news data (lazy load when news tab is active)
  const {
    news: portfolioNews,
    apiMetadata: newsApiMetadata,
    loading: newsLoading,
    error: newsError,
    refetch: refetchNews
  } = usePortfolioNews(
    activeSubTab === 'news' ? selectedAccount?.username : null,
    activeSubTab === 'news' ? selectedAccount?.accountName : null
  );

  // Modal states
  const [isAddPortfolioModalOpen, setIsAddPortfolioModalOpen] = useState(false);
  const [isEditPortfolioModalOpen, setIsEditPortfolioModalOpen] = useState(false);

  // Session management
  useEffect(() => {
    const user = searchParams.get('user');
    if (user) {
      sessionStorage.setItem('user', user);
    } else if (!sessionStorage.getItem('user')) {
      navigate('/login');
    }
  }, [navigate, searchParams]);

  // Update view when account changes
  useEffect(() => {
    setView(selectedAccount ? 'detail' : 'select');
  }, [selectedAccount]);

  // Logout handler
  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (confirmLogout) {
      sessionStorage.removeItem('user');
      clearAccount();
      navigate('/login');
    }
  };

  // Handle account selection from AccountSelector
  const handleAccountSelect = (selection) => {
    // Update context with new account
    selectAccount(
      selection.user.username,
      selection.account.account_name,
      selection.account.account_number
    );
    setView('detail');
    setActiveSubTab('overview'); // Reset to overview when new account is selected
  };

  // Handle changing account (go back to selector)
  const handleChangeAccount = () => {
    setView('select');
    // Don't clear account entirely, just go back to selection view
  };

  // Sub-navigation items (updated to match Sector page pattern)
  const subNavItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'performance', label: 'Performance' },
    { id: 'sentiment', label: 'Sentiment' },
    { id: 'holdings', label: 'Holdings' },
    { id: 'news', label: 'News' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AppHeader activeTab="portfolio" onLogout={handleLogout} />

      {/* Sub Navigation - only show when in detail view */}
      {view === 'detail' && (
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 overflow-x-auto">
              {subNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSubTab(item.id)}
                  className={`py-3 px-1 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeSubTab === item.id
                      ? 'border-gray-900 text-gray-900 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="p-4 sm:p-6 lg:p-8">
        {view === 'select' ? (
          // Account Selection View
          <div className="max-w-7xl mx-auto">
            <AccountSelector
              onAccountSelect={handleAccountSelect}
              onAddPortfolio={() => setIsAddPortfolioModalOpen(true)}
            />
          </div>
        ) : (
          // Portfolio Detail View
          <>
            {/* Client Information Bar */}
            <ClientInfoBar />

            {/* Page Header with Change Account button */}
            <section className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {activeSubTab === 'overview' ? 'Overview' :
                   activeSubTab === 'performance' ? 'Performance Analysis' :
                   activeSubTab === 'sentiment' ? 'Sentiment Analysis' :
                   activeSubTab === 'holdings' ? 'Holdings Detail' :
                   activeSubTab === 'news' ? 'News & Insights' :
                   'Portfolio'}
                </h1>
                {selectedAccount && (
                  <span className="text-sm text-gray-500">
                    • {selectedAccount.accountName} ({selectedAccount.accountNumber})
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleChangeAccount}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  aria-label="Change selected account"
                >
                  Change Account
                </button>
                <button
                  onClick={() => setIsEditPortfolioModalOpen(true)}
                  disabled={!selectedAccount}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Edit portfolio"
                >
                  EDIT PORTFOLIO
                </button>
                <button
                  onClick={() => setIsAddPortfolioModalOpen(true)}
                  disabled={!selectedAccount}
                  className={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors
                    ${selectedAccount
                        ? "bg-gray-800 text-white hover:bg-gray-900"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
                  aria-label="Add new portfolio"
                  >
                  ADD NEW PORTFOLIO
                </button>
              </div>
            </section>

            {/* Tab Content - Keep Overview as is, placeholders for others */}
            {activeSubTab === 'overview' && (
              <ErrorBoundary
                errorMessage="Unable to load portfolio overview. Please try refreshing the page."
                onReset={() => window.location.reload()}
              >
                <>
                  {/* Dashboard Grid Row 1: Profile, Performance, News */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Account Details and Performance */}
                    <div className="lg:col-span-1 space-y-8">
                      <ErrorBoundary errorMessage="Unable to load account details.">
                        <AccountDetailsCard onViewDetails={() => setActiveSubTab('holdings')} />
                      </ErrorBoundary>
                      <ErrorBoundary errorMessage="Unable to load performance data.">
                        <PerformanceCard onViewPerformance={() => setActiveSubTab('performance')} />
                      </ErrorBoundary>
                    </div>

                    {/* Right Column: News Feed */}
                    <div className="lg:col-span-2">
                      <ErrorBoundary errorMessage="Unable to load news feed.">
                        <NewsFeedCard />
                      </ErrorBoundary>
                    </div>
                  </div>

                  {/* Dashboard Section 2: Top Holdings Table */}
                  <section className="space-y-8 mt-8">
                    <ErrorBoundary errorMessage="Unable to load holdings data.">
                      <TopHoldingsTable onViewAllHoldings={() => setActiveSubTab('holdings')} />
                    </ErrorBoundary>

                    {/* Dashboard Grid Row 3: Key Themes & Opportunities */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2">
                        <ErrorBoundary errorMessage="Unable to load key themes.">
                          <KeyThemesCard />
                        </ErrorBoundary>
                      </div>
                      <div>
                        <ErrorBoundary errorMessage="Unable to load opportunities.">
                          <OpportunitiesCard />
                        </ErrorBoundary>
                      </div>
                    </div>
                  </section>
                </>
              </ErrorBoundary>
            )}

            {activeSubTab === 'performance' && (
              <ErrorBoundary
                errorMessage="Unable to load performance analysis. Please try selecting a different account or refreshing the page."
                onReset={() => setActiveSubTab('overview')}
              >
                <PortfolioPerformanceDetail />
              </ErrorBoundary>
            )}

            {activeSubTab === 'sentiment' && (
              <ErrorBoundary
                errorMessage="Unable to load sentiment analysis. Please try selecting a different account or refreshing the page."
                onReset={() => setActiveSubTab('overview')}
              >
                <PortfolioSentimentView isActive={activeSubTab === 'sentiment'} />
              </ErrorBoundary>
            )}

            {activeSubTab === 'holdings' && (
              <ErrorBoundary
                errorMessage="Unable to load holdings details. Please try selecting a different account or refreshing the page."
                onReset={() => setActiveSubTab('overview')}
              >
                <PortfolioHoldingsDetail />
              </ErrorBoundary>
            )}

            {activeSubTab === 'news' && (
              <ErrorBoundary
                errorMessage="Unable to load news details. Please try selecting a different account or refreshing the page."
                onReset={() => setActiveSubTab('overview')}
              >
                <DetailedRelatedNews
                  news={portfolioNews}
                  displayName={`${selectedAccount?.accountName || 'Portfolio'} - News & Insights`}
                  ticker={undefined} // Portfolio has multiple tickers, handled via apiMetadata
                  loading={newsLoading}
                  error={newsError}
                  apiMetadata={newsApiMetadata}
                  handleRetry={refetchNews}
                />
              </ErrorBoundary>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <AddPortfolioModal
        isOpen={isAddPortfolioModalOpen}
        onClose={() => setIsAddPortfolioModalOpen(false)}
      />
      <EditPortfolioModal
        isOpen={isEditPortfolioModalOpen}
        onClose={() => setIsEditPortfolioModalOpen(false)}
      />
    </div>
  );
};

export default PortfolioPage;
