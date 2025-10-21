import { useState, useEffect } from 'react';
import { filterPriceDataByTimeframe, generateChartData, getPriceRange, calculatePriceChange } from '../../shared/utils/chartHelpers';

/**
 * Custom hook for managing price data with timeframe filtering
 * @param {Array} priceData1Y - Full year of price data
 * @param {string} timeframe - Selected timeframe
 * @returns {Object} Filtered price data, chart data, price range, and price change info
 */
export const usePriceData = (priceData1Y, timeframe) => {
  const [priceData, setPriceData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100 });
  const [priceChange, setPriceChange] = useState({
    currentPrice: null,
    startPrice: null,
    priceChange: 0,
    priceChangePercent: 0
  });

  useEffect(() => {
    const filtered = filterPriceDataByTimeframe(priceData1Y, timeframe);
    setPriceData(filtered);

    const chart = generateChartData(filtered);
    setChartData(chart);

    const range = getPriceRange(chart);
    setPriceRange(range);

    const change = calculatePriceChange(chart);
    setPriceChange(change);
  }, [priceData1Y, timeframe]);

  return {
    priceData,
    chartData,
    priceRange,
    ...priceChange
  };
};
