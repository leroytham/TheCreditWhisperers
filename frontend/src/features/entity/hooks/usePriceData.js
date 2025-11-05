/**
 * usePriceData Hook
 *
 * Custom hook for fetching and polling price data
 * Fetches 1Y of data for all timeframes
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { PRICE_POLL_INTERVAL } from '../../shared/utils/constants';

export const usePriceData = (ticker, timeframe = '1Y') => {
  const [priceData1Y, setPriceData1Y] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [exchange, setExchange] = useState('');
  const [market, setMarket] = useState('');
  const [marketState, setMarketState] = useState('');
  const [prevClose, setPrevClose] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track last successful fetch to prevent redundant updates
  const lastDataTimestampRef = useRef(null);

  // Initial fetch and refetch on ticker or timeframe change
  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/price?ticker=${ticker}&timeframe=${timeframe}`);
        const data = await response.json();

        // Update timestamp reference for conditional polling
        if (data.prices && data.prices.length > 0) {
          lastDataTimestampRef.current = new Date().getTime();
        }

        setPriceData1Y(data.prices || []);
        setCompanyName(data.company_name || data.longname || data.shortname || '');
        setCurrency(data.currency || 'USD');
        setExchange(data.exchange || '');
        setMarket(data.market || '');
        setMarketState(data.market_state || '');
        setPrevClose(data.prev_close || null);
        setLastFetched(new Date());
      } catch (err) {
        console.error('[usePriceData] Error fetching price data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchPriceData();
    }
  }, [ticker, timeframe]);

  // Poll for real-time price updates ONLY for 1D timeframe
  // Other timeframes (1Y, 5Y, etc.) use historical data that doesn't change
  useEffect(() => {
    if (!ticker) return;

    // Only poll for 1D timeframe (intraday data that changes in real-time)
    if (timeframe !== '1D') {
      return; // No polling for historical timeframes
    }

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/price?ticker=${ticker}&timeframe=${timeframe}`);
        const data = await response.json();

        // Only update state if data has actually changed
        const hasNewData = data.prices && data.prices.length > 0;
        if (!hasNewData) {
          return; // Skip state update if no new data
        }

        // Check if the last price timestamp changed (indicates new data)
        const newLastPrice = data.prices[data.prices.length - 1];
        const currentLastPrice = priceData1Y[priceData1Y.length - 1];

        // Only update if the data is actually different
        if (currentLastPrice && newLastPrice &&
            currentLastPrice.time === newLastPrice.time &&
            currentLastPrice.close === newLastPrice.close) {
          return; // Data hasn't changed, skip update
        }

        // Update timestamp
        lastDataTimestampRef.current = new Date().getTime();

        // Update state only when necessary
        setPriceData1Y(data.prices || []);
        setCompanyName(data.company_name || data.longname || data.shortname || '');
        setCurrency(data.currency || 'USD');
        setExchange(data.exchange || '');
        setMarket(data.market || '');
        setMarketState(data.market_state || '');
        setPrevClose(data.prev_close || null);
        setLastFetched(new Date());
      } catch (err) {
        console.error('[usePriceData] Error polling price data:', err);
      }
    }, PRICE_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [ticker, timeframe, priceData1Y]);

  // Memoize return values to prevent unnecessary re-renders
  return useMemo(() => ({
    priceData1Y,
    companyName,
    currency,
    exchange,
    market,
    marketState,
    prevClose,
    lastFetched,
    loading,
    error
  }), [priceData1Y, companyName, currency, exchange, market, marketState, prevClose, lastFetched, loading, error]);
};