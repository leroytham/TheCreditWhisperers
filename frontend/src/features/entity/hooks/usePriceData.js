/**
 * usePriceData Hook
 *
 * Custom hook for fetching and polling price data
 * Dynamically fetches 1Y or 5Y of data based on needs
 */

import { useState, useEffect } from 'react';
import { PRICE_POLL_INTERVAL } from '../../shared/utils/constants';

export const usePriceData = (ticker, maxTimeframe = '5Y') => {
  const [priceData1Y, setPriceData1Y] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [exchange, setExchange] = useState('');
  const [market, setMarket] = useState('');
  const [marketState, setMarketState] = useState('');
  const [lastFetched, setLastFetched] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial fetch and refetch on ticker change
  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch with maxTimeframe to ensure we have enough data
        const response = await fetch(`/api/price?ticker=${ticker}&timeframe=${maxTimeframe}`);
        const data = await response.json();

        setPriceData1Y(data.prices || []);
        setCompanyName(data.company_name || data.longname || data.shortname || '');
        setCurrency(data.currency || 'USD');
        setExchange(data.exchange || '');
        setMarket(data.market || '');
        setMarketState(data.market_state || '');
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
  }, [ticker, maxTimeframe]);

  // Poll for real-time price updates
  useEffect(() => {
    if (!ticker) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/price?ticker=${ticker}&timeframe=${maxTimeframe}`);
        const data = await response.json();

        setPriceData1Y(data.prices || []);
        setCompanyName(data.company_name || data.longname || data.shortname || '');
        setCurrency(data.currency || 'USD');
        setExchange(data.exchange || '');
        setMarket(data.market || '');
        setMarketState(data.market_state || '');
        setLastFetched(new Date());
      } catch (err) {
        console.error('Error polling price data:', err);
      }
    }, PRICE_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [ticker, maxTimeframe]);

  return {
    priceData1Y,
    companyName,
    currency,
    exchange,
    market,
    marketState,
    lastFetched,
    loading,
    error
  };
};