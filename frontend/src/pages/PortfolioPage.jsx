import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import ClientInfoBar from '../features/portfolio/components/ClientInfoBar';
import AccountDetailsCard from '../features/portfolio/components/AccountDetailsCard';
import PerformanceCard from '../features/portfolio/components/PerformanceCard';
import NewsFeedCard from '../features/portfolio/components/NewsFeedCard';
import TopHoldingsTable from '../features/portfolio/components/TopHoldingsTable';
import KeyThemesCard from '../features/portfolio/components/KeyThemesCard';
import OpportunitiesCard from '../features/portfolio/components/OpportunitiesCard';
import AccountDetailsModal from '../features/portfolio/components/modals/AccountDetailsModal';
import PerformanceDetailsModal from '../features/portfolio/components/modals/PerformanceDetailsModal';
import AddPortfolioModal from '../features/portfolio/components/modals/AddPortfolioModal';
import EditPortfolioModal from '../features/portfolio/components/modals/EditPortfolioModal';

/**
 * PortfolioPage - Main portfolio overview page
 *
 * Displays comprehensive client portfolio information including:
 * - Client/Account details
 * - Performance metrics
 * - News feed
 * - Top holdings
 * - Key themes and opportunities
 */
const PortfolioPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Modal states
  const [isAccountDetailsModalOpen, setIsAccountDetailsModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
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

  // Logout handler
  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (confirmLogout) {
      sessionStorage.removeItem('user');
      navigate('/login');
    }
  };

  // Sub-navigation items
  const subNavItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'account-details', label: 'Account Details' },
    { id: 'performance', label: 'Performance' },
    { id: 'news-feed', label: 'News Feed' },
    { id: 'top-holdings', label: 'Top Holdings' },
    { id: 'key-themes', label: 'Key Themes' },
    { id: 'opportunities', label: 'Opportunities' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AppHeader activeTab="portfolio" onLogout={handleLogout} />

      {/* Sub Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {subNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`py-3 px-1 text-sm font-medium whitespace-nowrap ${
                  activeSubTab === item.id
                    ? 'active-sub-nav text-gray-900 font-semibold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-4 sm:p-6 lg:p-8">
        {/* Client Information Bar */}
        <ClientInfoBar />

        {/* Page Header */}
        <section className="flex justify-between items-center py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsEditPortfolioModalOpen(true)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              EDIT PORTFOLIO
            </button>
            <button
              onClick={() => setIsAddPortfolioModalOpen(true)}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              ADD NEW PORTFOLIO
            </button>
          </div>
        </section>

        {/* Dashboard Grid Row 1: Profile, Performance, News */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Account Details and Performance */}
          <div className="lg:col-span-1 space-y-8">
            <AccountDetailsCard onViewDetails={() => setIsAccountDetailsModalOpen(true)} />
            <PerformanceCard onViewPerformance={() => setIsPerformanceModalOpen(true)} />
          </div>

          {/* Right Column: News Feed */}
          <div className="lg:col-span-2">
            <NewsFeedCard />
          </div>
        </div>

        {/* Dashboard Section 2: Top Holdings Table */}
        <section className="space-y-8 mt-8">
          <TopHoldingsTable />

          {/* Dashboard Grid Row 3: Key Themes & Opportunities */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <KeyThemesCard />
            </div>
            <div>
              <OpportunitiesCard />
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
      <AccountDetailsModal
        isOpen={isAccountDetailsModalOpen}
        onClose={() => setIsAccountDetailsModalOpen(false)}
      />
      <PerformanceDetailsModal
        isOpen={isPerformanceModalOpen}
        onClose={() => setIsPerformanceModalOpen(false)}
      />
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
