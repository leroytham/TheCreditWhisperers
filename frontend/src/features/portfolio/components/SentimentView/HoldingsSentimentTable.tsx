import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Type definitions
interface HoldingSentiment {
  ticker: string;
  name?: string;
  weight?: number;
  sentiment?: number;
  momentum?: number;
  coverage?: number;
  hasData?: boolean;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface HoldingsSentimentTableProps {
  holdings: HoldingSentiment[] | null;
  loading: boolean;
  error: string | null;
}

/**
 * Enhanced Holdings Sentiment Table Component
 *
 * Displays portfolio holdings with sentiment analysis, including:
 * - Sentiment scores and labels
 * - Momentum indicators
 * - News coverage
 * - Data quality/confidence indicators
 * - Trend sparklines
 * - Sortable columns
 * - Clickable rows for navigation
 */
const HoldingsSentimentTable: React.FC<HoldingsSentimentTableProps> = ({ holdings, loading, error }) => {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'weight', direction: 'desc' });

  // Helper function to get sentiment color
  const getSentimentColor = (score: number): string => {
    if (score > 0.5) return 'text-green-600';
    if (score > 0.1) return 'text-green-500';
    if (score > -0.1) return 'text-gray-600';
    if (score > -0.5) return 'text-red-500';
    return 'text-red-600';
  };

  // Helper function to get sentiment label
  const getSentimentLabel = (score: number): string => {
    if (score > 0.5) return 'Very Bullish';
    if (score > 0.1) return 'Bullish';
    if (score > -0.1) return 'Neutral';
    if (score > -0.5) return 'Bearish';
    return 'Very Bearish';
  };

  // Helper function to get confidence level
  const getConfidenceLevel = (coverage: number): { label: string; color: string } => {
    if (coverage >= 20) return { label: 'High', color: 'text-green-600' };
    if (coverage >= 10) return { label: 'Medium', color: 'text-yellow-600' };
    if (coverage >= 5) return { label: 'Low', color: 'text-orange-600' };
    return { label: 'Very Low', color: 'text-red-600' };
  };

  // Helper function to get data quality indicator
  const getDataQuality = (coverage: number, sentiment: number, momentum: number): { quality: string; color: string } => {
    const hasGoodCoverage = coverage >= 10;
    const hasConsistentSignal = Math.sign(sentiment) === Math.sign(momentum);
    const hasStrongSignal = Math.abs(sentiment) > 0.1;

    if (hasGoodCoverage && hasConsistentSignal && hasStrongSignal) {
      return { quality: 'Excellent', color: 'bg-green-100 text-green-800' };
    } else if (hasGoodCoverage && (hasConsistentSignal || hasStrongSignal)) {
      return { quality: 'Good', color: 'bg-blue-100 text-blue-800' };
    } else if (hasGoodCoverage) {
      return { quality: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { quality: 'Limited', color: 'bg-gray-100 text-gray-800' };
    }
  };

  // Generate simple sparkline data (mock for now - should come from backend)
  const generateSparkline = (sentiment: number, momentum: number): number[] => {
    // Create a simple 7-point trend line
    const points = [];
    const baseValue = sentiment - momentum;
    for (let i = 0; i < 7; i++) {
      const progress = i / 6;
      const value = baseValue + (momentum * progress);
      points.push(value);
    }
    return points;
  };

  // Render sparkline SVG
  const renderSparkline = (points: number[]): React.ReactElement => {
    const width = 60;
    const height = 20;
    const padding = 2;

    // Find min and max for scaling
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    // Create path data
    const pathData = points.map((value: number, i: number) => {
      const x = padding + (i * (width - 2 * padding) / (points.length - 1));
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const color = points[points.length - 1] > points[0] ? '#10b981' : '#ef4444';

    return (
      <svg width={width} height={height} className="inline-block">
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  // Handle sorting
  const handleSort = (key: string): void => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Helper to get sortable value from holding
  const getSortValue = (holding: HoldingSentiment, key: string): number | string => {
    switch (key) {
      case 'ticker': return holding.ticker || '';
      case 'weight': return holding.weight ?? 0;
      case 'sentiment': return holding.sentiment ?? 0;
      case 'momentum': return holding.momentum ?? 0;
      case 'coverage': return holding.coverage ?? 0;
      default: return 0;
    }
  };

  // Sort holdings
  const sortedHoldings = React.useMemo(() => {
    if (!holdings || holdings.length === 0) return [];

    const sorted = [...holdings].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    return sorted;
  }, [holdings, sortConfig]);

  // Handle row click
  const handleRowClick = (ticker: string): void => {
    // EntityPage expects ticker as a query param (?ticker=) not a path segment
    navigate({
      pathname: '/entity',
      search: `?ticker=${encodeURIComponent(ticker)}`,
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sentiment by Holding
          </h3>
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 text-sm mt-3">Loading holdings sentiment...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sentiment by Holding
          </h3>
          <div className="text-center py-8 text-gray-500">
            <p>Unable to load holdings sentiment data</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sortedHoldings || sortedHoldings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sentiment by Holding
          </h3>
          <div className="text-center py-8 text-gray-500">
            <p>No holdings data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Sentiment by Holding
          </h3>
          <div className="text-sm text-gray-500">
            {sortedHoldings.length} holdings
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('ticker')}
                >
                  <div className="flex items-center">
                    Holding
                    {sortConfig.key === 'ticker' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('weight')}
                >
                  <div className="flex items-center">
                    Weight
                    {sortConfig.key === 'weight' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('sentiment')}
                >
                  <div className="flex items-center">
                    Sentiment Score
                    {sortConfig.key === 'sentiment' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('momentum')}
                >
                  <div className="flex items-center">
                    Momentum
                    {sortConfig.key === 'momentum' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('coverage')}
                >
                  <div className="flex items-center">
                    Coverage
                    {sortConfig.key === 'coverage' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedHoldings.map((holding) => {
                const confidence = getConfidenceLevel(holding.coverage || 0);
                const quality = getDataQuality(
                  holding.coverage || 0,
                  holding.sentiment || 0,
                  holding.momentum || 0
                );
                const sparklineData = generateSparkline(
                  holding.sentiment || 0,
                  holding.momentum || 0
                );

                return (
                  <tr
                    key={holding.ticker}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(holding.ticker)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 hover:text-blue-600">
                          {holding.ticker}
                        </div>
                        <div className="text-sm text-gray-500">
                          {holding.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(holding.weight || 0).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-sm font-medium ${getSentimentColor(holding.sentiment || 0)}`}>
                          {((holding.sentiment || 0) * 100).toFixed(0)}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {getSentimentLabel(holding.sentiment || 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderSparkline(sparklineData)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {(holding.momentum || 0) > 0 ? (
                          <svg className="h-4 w-4 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (holding.momentum || 0) < 0 ? (
                          <svg className="h-4 w-4 text-red-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-gray-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className={`text-sm ${(holding.momentum || 0) > 0 ? 'text-green-600' : (holding.momentum || 0) < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {Math.abs((holding.momentum || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {holding.coverage || 0} articles
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs font-medium ${confidence.color}`}>
                        {confidence.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${quality.color}`}>
                        {quality.quality}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HoldingsSentimentTable;