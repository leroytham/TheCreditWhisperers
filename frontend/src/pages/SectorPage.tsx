// src/pages/SectorPage.tsx

import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppHeader from "../components/layout/AppHeader";
import SectorSelector from "../features/sector/components/SectorSelector/SectorSelector";
import PerformanceView from "../features/sector/components/PerformanceView/PerformanceView";
import { resolveDisplayTicker } from "../features/sector/utils/tickerResolver";
import useAppStore from "../store/useAppStore";

interface Sector {
  name: string;
  index?: string;
  ticker?: string;
  available: boolean;
}

interface SectorContext {
  countryCode: string;
  countryName: string;
  sector: Sector;
}

type TabType = 'overview' | 'performance' | 'sentiment' | 'constituents' | 'news';

interface ApiError {
  response?: {
    status?: number;
  };
  message?: string;
}

/**
 * SectorPage - Main sector analysis page
 *
 * This file has been refactored from a monolithic 1,412-line file into a modular,
 * sector-based architecture for better maintainability and scalability.
 *
 * New directory structure:
 * - features/sector/config/: Sector data, regions, ticker mappings
 * - features/sector/utils/: Ticker resolution, chart helpers
 * - features/sector/hooks/: Data fetching hooks (useSectorData, usePriceData, useSentimentData)
 * - features/sector/components/: UI components organized by feature
 *   - SectorSelector/: Country and sector selection UI
 *   - PerformanceView/: Charts, news, events, constituents display
 *   - SectorHeader: Top navigation bar
 */

const SectorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'filter' | 'performance'>('filter');
  const [performanceContext, setPerformanceContext] = useState<SectorContext | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<TabType>('overview');
  const setUser = useAppStore((state) => state.setUser);
  const zustandLogout = useAppStore((state) => state.logout);

  // Session management - verify authentication via httpOnly cookie
  useEffect(() => {
    const user = searchParams.get("user");
    if (user) {
      setUser(user);  // Update Zustand store
    }

    // Verify authentication by calling /auth/me endpoint
    const checkAuth = async () => {
      try {
        const { default: apiService } = await import('../services/api');
        await apiService.get('/auth/me');
      } catch (error) {
        const apiError = error as ApiError;
        if (apiError.response?.status === 401 || apiError.message?.includes('Session expired')) {
          navigate("/login");
        }
      }
    };

    checkAuth();
  }, [navigate, searchParams, setUser]);

  // Logout handler - calls backend to clear httpOnly cookie
  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      try {
        const { default: apiService } = await import('../services/api');
        await apiService.post('/auth/logout');
      } catch (error) {
        console.error('Logout API error:', error);
      }
      zustandLogout();  // Clears user, isAuthenticated, AND selectedAccount
      navigate("/login");
    }
  };

  // Sector selection handler
  const handleSectorSelect = (context: SectorContext) => {
    setPerformanceContext(context);
    setView('performance');
    setActiveSubTab('overview'); // Reset to overview when sector is selected
  };

  // Back to selector handler
  const handleBack = () => {
    setView('filter');
    setActiveSubTab('overview'); // Reset sub tab when going back
  };

  // Sub-navigation items
  const subNavItems: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'performance', label: 'Performance' },
    { id: 'sentiment', label: 'Sentiment' },
    { id: 'constituents', label: 'Constituents' },
    { id: 'news', label: 'News' },
  ];

  // Render page title and breadcrumbs
  const renderPageTitle = () => {
    if (view === 'filter') {
      return (
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sector Analysis</h1>
          <p className="text-sm text-gray-600 mt-1">Select a country and sector to view performance data</p>
        </div>
      );
    }

    if (view === 'performance' && performanceContext) {
      const displayTicker = performanceContext.sector?.ticker
        ? resolveDisplayTicker(performanceContext.sector.ticker)
        : performanceContext.sector?.name;

      return (
        <div>
          <button
            onClick={handleBack}
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 flex items-center"
          >
            <span className="mr-1">←</span> Back to Selection
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            {displayTicker} ({performanceContext.countryName} - {performanceContext.sector?.name})
          </h1>
          <p className="text-sm text-gray-600 mt-1">{performanceContext.sector?.index}</p>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AppHeader activeTab="sector" onLogout={handleLogout} />

      {/* Sub Navigation - Only show when viewing performance */}
      {view === 'performance' && (
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
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Main content */}
      <main className="p-4 sm:p-6 lg:p-8">
        {/* Page Header */}
        <section className="flex justify-between items-center py-6">
          {renderPageTitle()}
        </section>

        {view === 'filter' && (
          <SectorSelector onSectorSelect={handleSectorSelect} />
        )}

        {view === 'performance' && (
          <PerformanceView
            context={performanceContext ?? undefined}
            onBack={handleBack}
            activeTab={activeSubTab}
            setActiveTab={(tab: string) => setActiveSubTab(tab as TabType)}
          />
        )}
      </main>
    </div>
  );
};

export default SectorPage;
