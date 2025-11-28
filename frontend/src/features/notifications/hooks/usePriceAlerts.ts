import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAppStore from '../../../store/useAppStore';
import apiService from '../../../services/api';
import { formatPriceAlertNotification } from '../utils/notificationHelpers';

/**
 * Custom hook for managing price alerts
 *
 * Monitors watchlist tickers and triggers notifications when price thresholds are crossed
 *
 * @param {Object} options - Configuration options
 */
export const usePriceAlerts = (options: { pollingInterval?: number; enabled?: boolean } = {}) => {
  const {
    pollingInterval = 60000, // Check every 60 seconds by default
    enabled = true,
  } = options;

  const {
    watchlist,
    priceAlerts,
    updatePriceAlert,
    addToast,
  } = useAppStore();

  // Get active alerts
  const activeAlerts = priceAlerts.filter((a) => a.isActive && !a.triggered);

  // Query to fetch current prices for watchlist
  const { data: priceData } = useQuery({
    queryKey: ['watchlist-prices', watchlist],
    queryFn: async () => {
      if (watchlist.length === 0) return {};

      // Fetch prices for all watchlist tickers
      const pricePromises = watchlist.map((ticker) =>
        apiService.getStockPrice(ticker, '1D')
          .then((response) => ({
            ticker,
            price: response.data?.currentPrice || response.data?.price || null,
          }))
          .catch(() => ({ ticker, price: null }))
      );

      const prices = await Promise.all(pricePromises);

      // Convert to object for easy lookup
      return prices.reduce<Record<string, number>>((acc, { ticker, price }) => {
        if (price !== null) {
          acc[ticker] = price;
        }
        return acc;
      }, {});
    },
    enabled: enabled && watchlist.length > 0,
    refetchInterval: pollingInterval,
    staleTime: pollingInterval - 1000, // Keep data fresh
  });

  // Check price alerts
  useEffect(() => {
    if (!priceData || activeAlerts.length === 0) return;

    activeAlerts.forEach((alert) => {
      const currentPrice = priceData[alert.ticker];

      if (!currentPrice) return;

      let shouldTrigger = false;

      switch (alert.condition) {
        case 'above':
          shouldTrigger = currentPrice >= (alert.target_price || 0);
          break;
        case 'below':
          shouldTrigger = currentPrice <= (alert.target_price || 0);
          break;
        case 'percent_increase':
          shouldTrigger = currentPrice >= (alert.base_price || 0) * (1 + (alert.percent_change || 0) / 100);
          break;
        case 'percent_decrease':
          shouldTrigger = currentPrice <= (alert.base_price || 0) * (1 - (alert.percent_change || 0) / 100);
          break;
        default:
          break;
      }

      if (shouldTrigger) {
        // Mark alert as triggered
        updatePriceAlert(alert.id, { triggered: true });

        // Send notification
        const notification = formatPriceAlertNotification(
          alert.ticker,
          currentPrice,
          alert.target_price || 0,
          alert.condition
        );

        addToast(notification);

        console.log(`🔔 Price alert triggered for ${alert.ticker}: ${alert.condition} $${alert.target_price}`);
      }
    });
  }, [priceData, activeAlerts, updatePriceAlert, addToast]);

  return {
    activeAlerts,
    priceData,
  };
};

/**
 * Helper hook to create a new price alert
 */
export const useCreatePriceAlert = () => {
  const { addPriceAlert, notifySuccess } = useAppStore();

  const createAlert = (
    ticker: string,
    condition: string,
    targetPrice: number,
    options: { basePrice?: number; percentChange?: number; note?: string } = {}
  ) => {
    const alert = {
      ticker: ticker.toUpperCase(),
      condition: condition as 'above' | 'below' | 'percent_increase' | 'percent_decrease',
      target_price: targetPrice,
      base_price: options.basePrice || targetPrice,
      percent_change: options.percentChange,
      notes: options.note || '',
      priority: 'medium' as const,
      triggered: false,
    };

    addPriceAlert(alert);

    notifySuccess(`Price alert created for ${ticker}`, {
      category: 'Market',
      duration: 3000,
    });

    return alert;
  };

  return { createAlert };
};

/**
 * Example usage:
 *
 * // In a component
 * const { activeAlerts, priceData } = usePriceAlerts({
 *   pollingInterval: 30000, // Check every 30 seconds
 * });
 *
 * const { createAlert } = useCreatePriceAlert();
 *
 * // Create an alert when price goes above $150
 * createAlert('AAPL', 'above', 150);
 *
 * // Create an alert when price increases by 5%
 * createAlert('AAPL', 'percent_increase', null, {
 *   basePrice: 140,
 *   percentChange: 5,
 *   note: 'Watch for breakout'
 * });
 */
