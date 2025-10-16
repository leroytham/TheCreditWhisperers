import React, { useState, useEffect } from 'react';
import { PriceChart, SentimentChart, OverallSentiment } from '../../../shared/components';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import { filterPriceDataByTimeframe } from '../../../shared/utils/chartHelpers';
import { formatDateTime, formatFullTimestamp, formatPrice, getPriceChangeColor, getPriceChangeArrow } from '../../../shared/utils/formatters';
import { calculatePriceChange } from '../../../shared/utils/chartHelpers';

/**
 * PerformanceView Component
 *
 * Main performance display container with charts and controls
 */
const PerformanceView = ({
  ticker,
  companyName,
  currency,
  priceData1Y,
  lastFetched,
  dailySentiment,
  sentiment,
  news,
  significantEvents
}) => {
  const [timeframe, setTimeframe] = useState('1Y');
  const [priceData, setPriceData] = useState([]);

  // Filter price data based on timeframe
  useEffect(() => {
    const filtered = filterPriceDataByTimeframe(priceData1Y, timeframe);
    setPriceData(filtered);
  }, [priceData1Y, timeframe]);

  const { currentPrice, priceChange, priceChangePercent } = calculatePriceChange(
    priceData.map((point, i) => ({
      x: i,
      y: parseFloat(point.close) || parseFloat(point.price) || 0,
      date: point.date,
      time: point.time
    }))
  );

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Chart Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">
              {companyName ? `${companyName}` : `${ticker} `}
            </h1>
            <p className="text-gray-600">{ticker}</p>
            <p className="text-gray-600">({currency})</p>
          </div>
          <div className="text-xs text-gray-500 text-right">
            {lastFetched && (
              <span>Data retrieved: {formatFullTimestamp(lastFetched)}</span>
            )}
          </div>
        </div>

        {/* Current Price Display */}
        <div className="flex items-end space-x-4 mb-4">
          <span className="text-4xl font-bold">
            {currentPrice
              ? formatPrice(currentPrice.y, currency)
              : '--'}
          </span>
          <span className={`flex items-center text-xl ${getPriceChangeColor(priceChange)}`}>
            {getPriceChangeArrow(priceChange)} {Math.abs(priceChange).toFixed(2)}
            <span className="ml-1">
              {priceChangePercent >= 0 ? '+' : ''}
              {priceChangePercent.toFixed(2)}%
            </span>
          </span>
        </div>

        {/* Price Date */}
        <p className="text-gray-600 text-sm">
          As of{' '}
          {currentPrice
            ? formatDateTime(currentPrice.date)
            : 'Loading...'}
        </p>
      </div>

      {/* Chart Controls */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-sm ${
                  timeframe === tf
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Price Chart */}
      <div className="p-6">
        <PriceChart
          priceData={priceData}
          ticker={ticker}
          currency={currency}
          significantEvents={significantEvents}
        />
      </div>

      {/* Daily Sentiment Chart */}
      <SentimentChart dailySentiment={dailySentiment} />

      {/* Overall Sentiment */}
      <OverallSentiment sentiment={sentiment} newsCount={news.length} />
    </div>
  );
};

export default PerformanceView;
