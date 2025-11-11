// frontend/src/features/notifications/hooks/useNotifications.js
/**
 * React Query hooks for notification management
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { notificationApi, preferencesApi, priceAlertApi, sentimentAlertApi } from '../../../services/notificationApi';
import useAppStore from '../../../store/useAppStore';
import { useCallback } from 'react';

// Query Keys
export const QUERY_KEYS = {
  notifications: ['notifications'],
  notificationDetail: (id) => ['notifications', id],
  unreadCount: ['notifications', 'unread-count'],
  preferences: ['notifications', 'preferences'],
  priceAlerts: ['price-alerts'],
  priceAlert: (id) => ['price-alerts', id],
  sentimentAlerts: ['sentiment-alerts'],
  sentimentAlert: (id) => ['sentiment-alerts', id],
};

/**
 * Hook to fetch notifications with filtering and pagination
 */
export const useNotifications = (filters = {}) => {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...QUERY_KEYS.notifications, filters],
    queryFn: () => notificationApi.getNotifications(filters),
    staleTime: 0, // Always consider data stale so refetchInterval works
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchInterval: 30 * 1000, // Poll every 30 seconds for new notifications
    refetchOnWindowFocus: true, // Refetch when user switches back to tab
    refetchIntervalInBackground: true, // Continue polling even when window is not focused
  });

  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: notificationApi.markAsRead,
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.notifications });

      // Snapshot the previous value
      const previousNotifications = queryClient.getQueryData([...QUERY_KEYS.notifications, filters]);

      // Optimistically update
      queryClient.setQueryData([...QUERY_KEYS.notifications, filters], (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ),
        };
      });

      // Return context with snapshot
      return { previousNotifications };
    },
    onError: (err, notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          [...QUERY_KEYS.notifications, filters],
          context.previousNotifications
        );
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationApi.markAllAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.notifications });

      const previousNotifications = queryClient.getQueryData([...QUERY_KEYS.notifications, filters]);

      queryClient.setQueryData([...QUERY_KEYS.notifications, filters], (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) => ({ ...n, is_read: true })),
        };
      });

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          [...QUERY_KEYS.notifications, filters],
          context.previousNotifications
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: notificationApi.archiveNotification,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.notifications });

      const previousNotifications = queryClient.getQueryData([...QUERY_KEYS.notifications, filters]);

      queryClient.setQueryData([...QUERY_KEYS.notifications, filters], (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_archived: true } : n
          ),
        };
      });

      return { previousNotifications };
    },
    onError: (err, notificationId, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          [...QUERY_KEYS.notifications, filters],
          context.previousNotifications
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: notificationApi.deleteNotification,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.notifications });

      const previousNotifications = queryClient.getQueryData([...QUERY_KEYS.notifications, filters]);

      queryClient.setQueryData([...QUERY_KEYS.notifications, filters], (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.filter((n) => n.id !== notificationId),
          total_count: old.total_count - 1,
        };
      });

      return { previousNotifications };
    },
    onError: (err, notificationId, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          [...QUERY_KEYS.notifications, filters],
          context.previousNotifications
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });

  const clearMutation = useMutation({
    mutationFn: (isArchived) => notificationApi.clearNotifications(isArchived),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });

  return {
    notifications: data?.notifications || [],
    totalCount: data?.total_count || 0,
    hasMore: data?.has_more || false,
    isLoading,
    error,
    refetch,
    // Mutations
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    archive: archiveMutation.mutate,
    deleteNotification: deleteMutation.mutate,
    clearNotifications: clearMutation.mutate,
    // Mutation states
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isClearing: clearMutation.isPending,
  };
};

/**
 * Hook to fetch notifications with infinite scrolling
 */
export const useInfiniteNotifications = (filters = {}, limit = 50) => {
  const queryClient = useQueryClient();

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: [...QUERY_KEYS.notifications, 'infinite', filters],
    queryFn: ({ pageParam = 0 }) =>
      notificationApi.getNotifications({ ...filters, offset: pageParam, limit }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.notifications.length, 0);
      return lastPage.has_more ? loadedCount : undefined;
    },
    staleTime: 30 * 1000,
  });

  const notifications = data?.pages.flatMap((page) => page.notifications) || [];

  return {
    notifications,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
  };
};

/**
 * Hook to fetch unread notification count
 */
export const useUnreadCount = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.unreadCount,
    queryFn: notificationApi.getUnreadCount,
    staleTime: 0, // Always consider data stale so refetchInterval works
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    refetchOnWindowFocus: true, // Refetch when user switches back to tab
    refetchIntervalInBackground: true, // Continue polling even when window is not focused
  });

  return {
    unreadCount: data?.count || 0,
    isLoading,
    error,
  };
};

/**
 * Hook to manage notification preferences
 */
export const useNotificationPreferences = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.preferences,
    queryFn: preferencesApi.getPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: preferencesApi.updatePreferences,
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.preferences });

      const previousPreferences = queryClient.getQueryData(QUERY_KEYS.preferences);

      queryClient.setQueryData(QUERY_KEYS.preferences, (old) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      return { previousPreferences };
    },
    onError: (err, updates, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(QUERY_KEYS.preferences, context.previousPreferences);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.preferences });
    },
  });

  return {
    preferences: data,
    isLoading,
    error,
    updatePreferences: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
};

/**
 * Hook to manage price alerts
 */
export const usePriceAlerts = (filters = {}) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...QUERY_KEYS.priceAlerts, filters],
    queryFn: () => priceAlertApi.getAlerts(filters),
    staleTime: 30 * 1000, // 30 seconds
  });

  const createMutation = useMutation({
    mutationFn: priceAlertApi.createAlert,
    onSuccess: (newAlert) => {
      // Add the new alert to the cache
      queryClient.setQueryData([...QUERY_KEYS.priceAlerts, filters], (old) => {
        if (!old) return { alerts: [newAlert], total_count: 1 };
        return {
          alerts: [newAlert, ...old.alerts],
          total_count: old.total_count + 1,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.priceAlerts });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ alertId, updates }) => priceAlertApi.updateAlert(alertId, updates),
    onMutate: async ({ alertId, updates }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.priceAlerts });

      const previousAlerts = queryClient.getQueryData([...QUERY_KEYS.priceAlerts, filters]);

      queryClient.setQueryData([...QUERY_KEYS.priceAlerts, filters], (old) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, ...updates } : alert
          ),
        };
      });

      return { previousAlerts };
    },
    onError: (err, variables, context) => {
      if (context?.previousAlerts) {
        queryClient.setQueryData([...QUERY_KEYS.priceAlerts, filters], context.previousAlerts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.priceAlerts });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: priceAlertApi.deleteAlert,
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.priceAlerts });

      const previousAlerts = queryClient.getQueryData([...QUERY_KEYS.priceAlerts, filters]);

      queryClient.setQueryData([...QUERY_KEYS.priceAlerts, filters], (old) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.filter((alert) => alert.id !== alertId),
          total_count: old.total_count - 1,
        };
      });

      return { previousAlerts };
    },
    onError: (err, alertId, context) => {
      if (context?.previousAlerts) {
        queryClient.setQueryData([...QUERY_KEYS.priceAlerts, filters], context.previousAlerts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.priceAlerts });
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

/**
 * Hook to manage sentiment alerts
 */
export const useSentimentAlerts = (filters = {}) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...QUERY_KEYS.sentimentAlerts, filters],
    queryFn: () => sentimentAlertApi.getAlerts(filters),
    staleTime: 30 * 1000, // 30 seconds
  });

  const createMutation = useMutation({
    mutationFn: sentimentAlertApi.createAlert,
    onSuccess: (newAlert) => {
      // Add the new alert to the cache
      queryClient.setQueryData([...QUERY_KEYS.sentimentAlerts, filters], (old) => {
        if (!old) return { alerts: [newAlert], total_count: 1 };
        return {
          alerts: [newAlert, ...old.alerts],
          total_count: old.total_count + 1,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sentimentAlerts });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ alertId, updates }) => sentimentAlertApi.updateAlert(alertId, updates),
    onMutate: async ({ alertId, updates }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.sentimentAlerts });

      const previousAlerts = queryClient.getQueryData([...QUERY_KEYS.sentimentAlerts, filters]);

      queryClient.setQueryData([...QUERY_KEYS.sentimentAlerts, filters], (old) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, ...updates } : alert
          ),
        };
      });

      return { previousAlerts };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousAlerts) {
        queryClient.setQueryData([...QUERY_KEYS.sentimentAlerts, filters], context.previousAlerts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sentimentAlerts });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: sentimentAlertApi.deleteAlert,
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.sentimentAlerts });

      const previousAlerts = queryClient.getQueryData([...QUERY_KEYS.sentimentAlerts, filters]);

      queryClient.setQueryData([...QUERY_KEYS.sentimentAlerts, filters], (old) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.filter((alert) => alert.id !== alertId),
          total_count: old.total_count - 1,
        };
      });

      return { previousAlerts };
    },
    onError: (_err, _alertId, context) => {
      if (context?.previousAlerts) {
        queryClient.setQueryData([...QUERY_KEYS.sentimentAlerts, filters], context.previousAlerts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sentimentAlerts });
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

/**
 * Hook to sync server notifications with local Zustand store
 * This maintains backward compatibility with existing components
 */
export const useNotificationSync = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useAppStore();

  // Listen for new notifications from WebSocket
  const handleNewNotification = useCallback(
    (notification) => {
      // Import normalization function dynamically
      import('../../../services/notificationApi').then(({ normalizeNotification }) => {
        // Normalize the notification data
        const normalizedNotification = normalizeNotification(notification);

        // Invalidate all notification queries to force refetch
        // This ensures all active queries (with different filter combinations) get the new data
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });

        // Invalidate unread count
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });

        // Add to Zustand store for toast display
        if (normalizedNotification.show_as_toast || normalizedNotification.showAsToast) {
          addNotification(normalizedNotification);
        }
      });
    },
    [queryClient, addNotification]
  );

  return {
    handleNewNotification,
  };
};

// Export all hooks
export default {
  useNotifications,
  useInfiniteNotifications,
  useUnreadCount,
  useNotificationPreferences,
  usePriceAlerts,
  useSentimentAlerts,
  useNotificationSync,
};