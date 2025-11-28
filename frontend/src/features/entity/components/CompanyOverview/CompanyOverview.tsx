// src/features/entity/components/CompanyOverview/CompanyOverview.jsx

import React from 'react';
import { useCompanyOverview } from '../../hooks/useCompanyOverview';

/**
 * CompanyOverview Component
 * 
 * Displays comprehensive company information including:
 * - Basic information (description, sector, industry)
 * - Financial ratios and metrics
 * - Analyst ratings and target price
 * - Key performance indicators
 */
const CompanyOverview = ({ ticker }) => {
  const { overview, loading, error } = useCompanyOverview(ticker);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <div className="text-lg font-medium text-gray-700">Loading company overview...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="text-yellow-600 mb-2">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Company Overview Not Available</h3>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-sm text-gray-500">Company overview data is not available for {ticker}</p>
        </div>
      </div>
    );
  }

  // Helper function to format large numbers
  const formatNumber = (value) => {
    if (!value || value === 'None') return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  // Helper function to format percentage
  const formatPercent = (value) => {
    if (!value || value === 'None') return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return `${(num * 100).toFixed(2)}%`;
  };

  // Helper function to format ratio
  const formatRatio = (value) => {
    if (!value || value === 'None') return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Company Description */}
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Description</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-200">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Symbol</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{overview.Symbol}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{overview.Name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Exchange</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{overview.Exchange}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Currency</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{overview.Currency}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-gray-200">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Sector</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{overview.Sector}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Industry</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{overview.Industry}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Country</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{overview.Country}</p>
            </div>
          </div>

          {overview.Description && (
            <div className="pt-2">
              <p className="text-sm text-gray-700 leading-relaxed">{overview.Description}</p>
            </div>
          )}

          {overview.Address && (
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Address</p>
              <p className="text-sm text-gray-700 mt-1">{overview.Address}</p>
            </div>
          )}

          {overview.OfficialSite && (
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Website</p>
              <a 
                href={overview.OfficialSite} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-block"
              >
                {overview.OfficialSite}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard 
            label="Market Cap" 
            value={formatNumber(overview.MarketCapitalization)} 
          />
          <MetricCard 
            label="P/E Ratio" 
            value={formatRatio(overview.PERatio)} 
          />
          <MetricCard 
            label="Forward P/E" 
            value={formatRatio(overview.ForwardPE)} 
          />
          <MetricCard 
            label="PEG Ratio" 
            value={formatRatio(overview.PEGRatio)} 
          />
          <MetricCard 
            label="Price/Book" 
            value={formatRatio(overview.PriceToBookRatio)} 
          />
          <MetricCard 
            label="Price/Sales" 
            value={formatRatio(overview.PriceToSalesRatioTTM)} 
          />
          <MetricCard 
            label="EPS (TTM)" 
            value={formatRatio(overview.EPS)} 
          />
          <MetricCard 
            label="Dividend Yield" 
            value={formatPercent(overview.DividendYield)} 
          />
          <MetricCard 
            label="Beta" 
            value={formatRatio(overview.Beta)} 
          />
          <MetricCard 
            label="52-Week High" 
            value={overview['52WeekHigh'] ? `$${parseFloat(overview['52WeekHigh']).toFixed(2)}` : 'N/A'} 
          />
          <MetricCard 
            label="52-Week Low" 
            value={overview['52WeekLow'] ? `$${parseFloat(overview['52WeekLow']).toFixed(2)}` : 'N/A'} 
          />
          <MetricCard 
            label="50-Day MA" 
            value={overview['50DayMovingAverage'] ? `$${parseFloat(overview['50DayMovingAverage']).toFixed(2)}` : 'N/A'} 
          />
        </div>
      </div>

      {/* Financial Performance */}
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard 
            label="Revenue (TTM)" 
            value={formatNumber(overview.RevenueTTM)} 
          />
          <MetricCard 
            label="Gross Profit (TTM)" 
            value={formatNumber(overview.GrossProfitTTM)} 
          />
          <MetricCard 
            label="EBITDA" 
            value={formatNumber(overview.EBITDA)} 
          />
          <MetricCard 
            label="Profit Margin" 
            value={formatPercent(overview.ProfitMargin)} 
          />
          <MetricCard 
            label="Operating Margin" 
            value={formatPercent(overview.OperatingMarginTTM)} 
          />
          <MetricCard 
            label="Return on Assets" 
            value={formatPercent(overview.ReturnOnAssetsTTM)} 
          />
          <MetricCard 
            label="Return on Equity" 
            value={formatPercent(overview.ReturnOnEquityTTM)} 
          />
          <MetricCard 
            label="Quarterly Revenue Growth" 
            value={formatPercent(overview.QuarterlyRevenueGrowthYOY)} 
          />
        </div>
      </div>

      {/* Analyst Ratings */}
      {(overview.AnalystTargetPrice || overview.AnalystRatingStrongBuy) && (
        <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analyst Ratings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {overview.AnalystTargetPrice && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Target Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${parseFloat(overview.AnalystTargetPrice).toFixed(2)}
                </p>
              </div>
            )}
            
            {(overview.AnalystRatingStrongBuy || overview.AnalystRatingBuy || 
              overview.AnalystRatingHold || overview.AnalystRatingSell || 
              overview.AnalystRatingStrongSell) && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">Analyst Recommendations</p>
                <div className="space-y-2">
                  {overview.AnalystRatingStrongBuy && parseInt(overview.AnalystRatingStrongBuy) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Strong Buy</span>
                      <span className="text-sm font-semibold text-green-600">{overview.AnalystRatingStrongBuy}</span>
                    </div>
                  )}
                  {overview.AnalystRatingBuy && parseInt(overview.AnalystRatingBuy) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Buy</span>
                      <span className="text-sm font-semibold text-green-500">{overview.AnalystRatingBuy}</span>
                    </div>
                  )}
                  {overview.AnalystRatingHold && parseInt(overview.AnalystRatingHold) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Hold</span>
                      <span className="text-sm font-semibold text-yellow-600">{overview.AnalystRatingHold}</span>
                    </div>
                  )}
                  {overview.AnalystRatingSell && parseInt(overview.AnalystRatingSell) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Sell</span>
                      <span className="text-sm font-semibold text-red-500">{overview.AnalystRatingSell}</span>
                    </div>
                  )}
                  {overview.AnalystRatingStrongSell && parseInt(overview.AnalystRatingStrongSell) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Strong Sell</span>
                      <span className="text-sm font-semibold text-red-600">{overview.AnalystRatingStrongSell}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Information */}
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard 
            label="Shares Outstanding" 
            value={formatNumber(overview.SharesOutstanding)} 
          />
          <MetricCard 
            label="Shares Float" 
            value={formatNumber(overview.SharesFloat)} 
          />
          <MetricCard 
            label="Insider Ownership" 
            value={formatPercent(overview.PercentInsiders)} 
          />
          <MetricCard 
            label="Institutional Ownership" 
            value={formatPercent(overview.PercentInstitutions)} 
          />
          <MetricCard 
            label="Dividend Per Share" 
            value={overview.DividendPerShare || 'N/A'} 
          />
          <MetricCard 
            label="Ex-Dividend Date" 
            value={overview.ExDividendDate || 'N/A'} 
          />
        </div>
      </div>
    </div>
  );
};

/**
 * MetricCard - Reusable component for displaying individual metrics
 */
const MetricCard = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-3">
    <p className="text-xs font-medium text-gray-500 uppercase mb-1">{label}</p>
    <p className="text-sm font-semibold text-gray-900">{value}</p>
  </div>
);

export default CompanyOverview;
