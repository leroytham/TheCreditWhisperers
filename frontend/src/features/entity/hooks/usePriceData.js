/**
 * usePriceData Hook
 *
 * Custom hook for fetching and polling price data
 * Dynamically fetches 1Y or 5Y of data based on needs
 */

import { useState, useEffect } from 'react';
import { PRICE_POLL_INTERVAL } from '../../shared/utils/constants';

export const usePriceData = (ticker, timeframe = '5Y') => {
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

  // Initial fetch and refetch on ticker or timeframe change
  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[usePriceData] Fetching data for ticker:', ticker, 'timeframe:', timeframe);
        const response = await fetch(`/api/price?ticker=${ticker}&timeframe=${timeframe}`);
        const data = await response.json();
        console.log('[usePriceData] Received data:', data.prices?.length, 'prices');
        if (data.prices && data.prices.length > 0) {
          console.log('[usePriceData] First date:', data.prices[0].date);
          console.log('[usePriceData] Last date:', data.prices[data.prices.length - 1].date);
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
        console.error('Error fetching price data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchPriceData();
    }
  }, [ticker, timeframe]);

  // Poll for real-time price updates
  useEffect(() => {
    if (!ticker) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/price?ticker=${ticker}&timeframe=${timeframe}`);
        const data = await response.json();

        setPriceData1Y(data.prices || []);
        setCompanyName(data.company_name || data.longname || data.shortname || '');
        setCurrency(data.currency || 'USD');
        setExchange(data.exchange || '');
        setMarket(data.market || '');
        setMarketState(data.market_state || '');
        setPrevClose(data.prev_close || null);
        setLastFetched(new Date());
      } catch (err) {
        console.error('Error polling price data:', err);
      }
    }, PRICE_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [ticker, timeframe]);

  return {
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
  };
};