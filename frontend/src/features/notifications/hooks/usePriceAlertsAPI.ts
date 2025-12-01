// frontend/src/features/notifications/hooks/usePriceAlertsAPI.ts
/**
 * React Query hook for server-side price alert CRUD operations
 *
 * This hook manages price alerts stored on the server via API.
 * For local price monitoring (checking prices against thresholds),
 * see usePriceAlerts.ts which uses Zustand store.
 *
 * Extracted from useNotifications.ts for better modularity.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

// Type definitions
interface PriceAlert {
  id: string;
  [key: string]: unknown;
}

// Query Keys for server-side price alerts
export const PRICE_ALERT_API_QUERY_KEYS = {
  priceAlerts: ['price-alerts'],
  priceAlert: (id: string) => ['price-alerts', id],
};

/**
 * Hook to manage server-side price alerts via API
 *
 * Provides CRUD operations for price alerts with optimistic updates.
 */
export const usePriceAlertsAPI = (filters: Record<string, unknown> = {}) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...PRICE_ALERT_API_QUERY_KEYS.priceAlerts, filters],
    queryFn: async () => {
      const response = await apiService.priceAlerts.getAll(filters);
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  const createMutation = useMutation({
    mutationFn: async (alert: Record<string, any>) => {
      const response = await apiService.priceAlerts.create(alert);
      return response.data;
    },
    onSuccess: (newAlert) => {
      // Add the new alert to the cache
      queryClient.setQueryData([...PRICE_ALERT_API_QUERY_KEYS.priceAlerts, filters], (old: any) => {
        if (!old) return { alerts: [newAlert], total_count: 1 };
        return {
          alerts: [newAlert, ...old.alerts],
          total_count: old.total_count + 1,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PRICE_ALERT_API_QUERY_KEYS.priceAlerts });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ alertId, updates }: { alertId: string; updates: Record<string, any> }) => {
      const response = await apiService.priceAlerts.update(alertId, updates);
      return response.data;
    },
    onMutate: async ({ alertId, updates }: { alertId: string; updates: Record<string, any> }) => {
      await queryClient.cancelQueries({ queryKey: PRICE_ALERT_API_QUERY_KEYS.priceAlerts });

      const previousAlerts = queryClient.getQueryData([...PRICE_ALERT_API_QUERY_KEYS.priceAlerts, filters]);

      queryClient.setQueryData([...PRICE_ALERT_API_QUERY_KEYS.priceAlerts, filters], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.map((alert: PriceAlert) =>
            alert.id === alertId ? { ...alert, ...updates } : alert
          ),
        };
      });

      return { previousAlerts };
    },
    onError: (err, variables, context) => {
      if (context?.previousAlerts) {
        queryClient.setQueryData([...PRICE_ALERT_API_QUERY_KEYS.priceAlerts, filters], context.previousAlerts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PRICE_ALERT_API_QUERY_KEYS.priceAlerts });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiService.priceAlerts.delete(alertId);
      return response.data;
    },
    onMutate: async (alertId: string) => {
      await queryClient.cancelQueries({ queryKey: PRICE_ALERT_API_QUERY_KEYS.priceAlerts });

      const previousAlerts = queryClient.getQueryData([...PRICE_ALERT_API_QUERY_KEYS.priceAlerts, filters]);

      queryClient.setQueryData([...PRICE_ALERT_API_QUERY_KEYS.priceAlerts, filters], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.filter((alert: PriceAlert) => alert.id !== alertId),
          total_count: old.total_count - 1,
        };
      });

      return { previousAlerts };
    },
    onError: (err, alertId, context) => {
      if (context?.previousAlerts) {
        queryClient.setQueryData([...PRICE_ALERT_API_QUERY_KEYS.priceAlerts, filters], context.previousAlerts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PRICE_ALERT_API_QUERY_KEYS.priceAlerts });
    },
  });

  return {
    alerts: data?.alerts || [],
    totalCount: data?.total_count || 0,
    isLoading,
    error,
    refetch,
    // Mutations
    createAlert: createMutation.mutate,
    updateAlert: updateMutation.mutate,
    deleteAlert: deleteMutation.mutate,
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

export default usePriceAlertsAPI;
