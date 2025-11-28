import React from 'react';
import { formatCurrency } from '../../../shared/utils/formatters';

// Type definitions
interface PerformanceHeaderProps {
  countryName: string;
  sectorName: string;
  indexName?: string;
  ticker?: string;
  companyName?: string;
  currentPrice: number | null;
  priceChange: number;
  priceChangePercent: number;
  currency: string;
  onBack?: () => void;
}

/**
 * PerformanceHeader component - displays sector header with price and change info
 */
const PerformanceHeader: React.FC<PerformanceHeaderProps> = ({
  countryName,
  sectorName,
  indexName,
  ticker,
  companyName,
  currentPrice,
  priceChange,
  priceChangePercent,
  currency,
  onBack
}) => {
  // Build deduplicated subtitle
  const buildSubtitle = () => {
    const parts = [];
    if (indexName) parts.push(indexName);
    if (ticker && ticker !== indexName && ticker !== companyName) parts.push(ticker);
    if (parts.length === 0) return null;
    return parts.join(' · ');
  };

  const subtitle = buildSubtitle();

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
      <button onClick={onBack} className="mb-4 text-sm text-gray-500 hover:text-black">
        ← Back to Sector Selection
      </button>
      <div>
        <h1 className="text-2xl font-bold text-black">
          {countryName} - {sectorName}
        </h1>
        {subtitle && <p className="text-sm text-gray-500 mb-2">{subtitle}</p>}
        <div className="flex items-end space-x-3">
          <div className="text-3xl font-bold">
            {currentPrice !== null ? formatCurrency(currentPrice, currency) : '--'}
          </div>
          <div className={`text-sm ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {currency} · {priceChange >= 0 ? '▲' : '▼'} {priceChange.toFixed(2)} (
            {priceChangePercent >= 0 ? '+' : ''}
            {priceChangePercent.toFixed(2)}%)
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceHeader;
