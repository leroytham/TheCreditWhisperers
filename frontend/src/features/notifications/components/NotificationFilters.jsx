import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * NotificationFilters Component
 *
 * Sidebar filter component for filtering notifications by category and subcategory
 */
const NotificationFilters = ({ filters, setFilters }) => {
  const handleSelectAll = (e) => {
    const checked = e.target.checked;
    setFilters({
      ...filters,
      selectAll: checked,
      marketSignals: {
        enabled: checked,
        criticalThreats: checked,
        emergingOpportunities: checked,
        marketIntelligence: checked,
      },
      operationalAlerts: {
        enabled: checked,
        accountServicing: checked,
        tradeSettlement: checked,
        complianceReporting: checked,
      },
    });
  };

  const handleMarketSignalsToggle = (e) => {
    const checked = e.target.checked;
    setFilters({
      ...filters,
      marketSignals: {
        ...filters.marketSignals,
        enabled: checked,
        criticalThreats: checked,
        emergingOpportunities: checked,
        marketIntelligence: checked,
      },
    });
  };

  const handleOperationalAlertsToggle = (e) => {
    const checked = e.target.checked;
    setFilters({
      ...filters,
      operationalAlerts: {
        ...filters.operationalAlerts,
        enabled: checked,
        accountServicing: checked,
        tradeSettlement: checked,
        complianceReporting: checked,
      },
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Notifications</h2>
      <div className="space-y-4">
        {/* Select All */}
        <div className="flex items-center pb-2 border-b border-gray-200">
          <input
            id="select-all"
            type="checkbox"
            checked={filters.selectAll}
            onChange={handleSelectAll}
            className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
          />
          <label htmlFor="select-all" className="ml-3 text-sm font-medium text-gray-800">
            Select All
          </label>
        </div>

        {/* Category: Market Signals */}
        <details className="group" open>
          <summary className="flex items-center justify-between cursor-pointer list-none py-2">
            <div className="flex items-center">
              <input
                id="cat-market-signals"
                type="checkbox"
                checked={filters.marketSignals.enabled}
                onChange={handleMarketSignalsToggle}
                className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <label htmlFor="cat-market-signals" className="ml-3 text-sm font-semibold text-gray-800">
                Market Signals
              </label>
            </div>
            <ChevronDown className="h-5 w-5 text-gray-500 transform transition-transform group-open:rotate-180" />
          </summary>
          <div className="pl-7 mt-2 space-y-2 text-sm">
            <div className="flex items-center">
              <input
                id="sub-threats"
                type="checkbox"
                checked={filters.marketSignals.criticalThreats}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    marketSignals: { ...filters.marketSignals, criticalThreats: e.target.checked },
                  })
                }
                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label htmlFor="sub-threats" className="ml-3 text-gray-700">
                Critical Threats (3)
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="sub-opps"
                type="checkbox"
                checked={filters.marketSignals.emergingOpportunities}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    marketSignals: { ...filters.marketSignals, emergingOpportunities: e.target.checked },
                  })
                }
                className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="sub-opps" className="ml-3 text-gray-700">
                Emerging Opportunities (3)
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="sub-intel"
                type="checkbox"
                checked={filters.marketSignals.marketIntelligence}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    marketSignals: { ...filters.marketSignals, marketIntelligence: e.target.checked },
                  })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="sub-intel" className="ml-3 text-gray-700">
                Market Intelligence (3)
              </label>
            </div>
          </div>
        </details>

        {/* Category: Operational Alerts */}
        <details className="group" open>
          <summary className="flex items-center justify-between cursor-pointer list-none py-2">
            <div className="flex items-center">
              <input
                id="cat-operational"
                type="checkbox"
                checked={filters.operationalAlerts.enabled}
                onChange={handleOperationalAlertsToggle}
                className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <label htmlFor="cat-operational" className="ml-3 text-sm font-semibold text-gray-800">
                Operational Alerts
              </label>
            </div>
            <ChevronDown className="h-5 w-5 text-gray-500 transform transition-transform group-open:rotate-180" />
          </summary>
          <div className="pl-7 mt-2 space-y-2 text-sm">
            <div className="flex items-center">
              <input
                id="sub-servicing"
                type="checkbox"
                checked={filters.operationalAlerts.accountServicing}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    operationalAlerts: { ...filters.operationalAlerts, accountServicing: e.target.checked },
                  })
                }
                className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <label htmlFor="sub-servicing" className="ml-3 text-gray-700">
                Account Servicing (1)
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="sub-trade"
                type="checkbox"
                checked={filters.operationalAlerts.tradeSettlement}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    operationalAlerts: { ...filters.operationalAlerts, tradeSettlement: e.target.checked },
                  })
                }
                className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <label htmlFor="sub-trade" className="ml-3 text-gray-700">
                Trade & Settlement (0)
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="sub-compliance"
                type="checkbox"
                checked={filters.operationalAlerts.complianceReporting}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    operationalAlerts: { ...filters.operationalAlerts, complianceReporting: e.target.checked },
                  })
                }
                className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <label htmlFor="sub-compliance" className="ml-3 text-gray-700">
                Compliance & Reporting (0)
              </label>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default NotificationFilters;
