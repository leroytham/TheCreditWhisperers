import { useState, useEffect } from 'react';
import { filterPriceDataByTimeframe, generateChartData, getPriceRange, calculatePriceChange, PriceDataPoint, ChartDataPoint, PriceRange, PriceChangeResult } from '../../shared/utils/chartHelpers';

/**
 * Custom hook for managing price data with timeframe filtering
 * @param {Array} priceData1Y - Full year of price data
 * @param {string} timeframe - Selected timeframe
 * @returns {Object} Filtered price data, chart data, price range, and price change info
 */
export const usePriceData = (priceData1Y: PriceDataPoint[] | null | undefined, timeframe: string) => {
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 100 });
  const [priceChange, setPriceChange] = useState<PriceChangeResult>({
    currentPrice: null,
    startPrice: null,
    priceChange: 0,
    priceChangePercent: 0,
    isValidPercentage: false
  });

  useEffect(() => {
    const filtered = filterPriceDataByTimeframe(priceData1Y || [], timeframe);
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
