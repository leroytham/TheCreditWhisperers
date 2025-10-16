import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppHeader from "../components/layout/AppHeader";
import SectorSelector from "../features/sector/components/SectorSelector/SectorSelector";
import PerformanceView from "../features/sector/components/PerformanceView/PerformanceView";

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
  const [view, setView] = useState('filter'); // 'filter' | 'performance'
  const [performanceContext, setPerformanceContext] = useState(null);

  // Session management
  useEffect(() => {
    const user = searchParams.get("user");
    if (user) {
      sessionStorage.setItem("user", user);
    } else if (!sessionStorage.getItem("user")) {
      navigate("/login");
    }
  }, [navigate, searchParams]);

  // Logout handler
  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      sessionStorage.removeItem("user");
      navigate("/login");
    }
  };

  // Sector selection handler
  const handleSectorSelect = (context) => {
    setPerformanceContext(context);
    setView('performance');
  };

  // Back to selector handler
  const handleBack = () => {
    setView('filter');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AppHeader activeTab="sector" onLogout={handleLogout} />

      {/* Main content */}
      <main className="p-4">
        {view === 'filter' && (
          <SectorSelector onSectorSelect={handleSectorSelect} />
        )}

        {view === 'performance' && (
          <PerformanceView
            context={performanceContext}
            onBack={handleBack}
          />
        )}
      </main>
    </div>
  );
};

export default SectorPage;
