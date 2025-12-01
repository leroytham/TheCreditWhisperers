// frontend/src/features/notifications/hooks/useNotifications.ts
/**
 * React Query hooks for notification management
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import apiService from '../../../services/api';
import { normalizeNotification, normalizeNotificationResponse } from '../utils/normalizers';
import useAppStore from '../../../store/useAppStore';
import { useCallback } from 'react';

// Import and re-export server-side price alerts hook for backward compatibility
import { usePriceAlertsAPI, PRICE_ALERT_API_QUERY_KEYS } from './usePriceAlertsAPI';
export { usePriceAlertsAPI, PRICE_ALERT_API_QUERY_KEYS };
// Re-export as usePriceAlerts for backward compatibility (alias)
export { usePriceAlertsAPI as usePriceAlerts };

// Type definitions
interface Notification {
  id: string;
  is_read?: boolean;
  is_archived?: boolean;
  show_as_toast?: boolean;
  showAsToast?: boolean;
  type?: string;
  title?: string;
  message?: string;
  category?: string;
  priority?: string;
  duration?: number;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationFilters {
  is_read?: boolean;
  is_archived?: boolean;
  category?: string;
  offset?: number;
  limit?: number;
}

interface NotificationResponse {
  notifications: Notification[];
  total_count: number;
  has_more: boolean;
}

// Query Keys (price alert keys moved to usePriceAlertsAPI.ts)
export const QUERY_KEYS = {
  notifications: ['notifications'],
  notificationDetail: (id: string) => ['notifications', id],
  unreadCount: ['notifications', 'unread-count'],
  preferences: ['notifications', 'preferences'],
};

/**
 * Hook to fetch notifications with filtering and pagination
 */
export const useNotifications = (filters: NotificationFilters = {}) => {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...QUERY_KEYS.notifications, filters],
    queryFn: async () => {
      const response = await apiService.notifications.getAll(filters);
      return normalizeNotificationResponse(response.data);
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly gcTime)
  });

  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiService.notifications.markAsRead(notificationId);
      return response.data;
    },
    onMutate: async (notificationId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.notifications });

      // Snapshot the previous value
      const previousNotifications = queryClient.getQueryData([...QUERY_KEYS.notifications, filters]);

      // Optimistically update
      queryClient.setQueryData([...QUERY_KEYS.notifications, filters], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: any) =>
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
    mutationFn: async () => {
      const response = await apiService.notifications.markAllAsRead();
      return response.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.notifications });

      const previousNotifications = queryClient.getQueryData([...QUERY_KEYS.notifications, filters]);

      queryClient.setQueryData([...QUERY_KEYS.notifications, filters], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: Notification) => ({ ...n, is_read: true })),
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
    mutationFn: async (notificationId: string) => {
      const response = await apiService.notifications.archive(notificationId);
      return response.data;
    },
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.notifications });

      const previousNotifications = queryClient.getQueryData([...QUERY_KEYS.notifications, filters]);

      queryClient.setQueryData([...QUERY_KEYS.notifications, filters], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: Notification) =>
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
    mutationFn: async (notificationId: string) => {
      const response = await apiService.notifications.delete(notificationId);
      return response.data;
    },
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.notifications });

      const previousNotifications = queryClient.getQueryData([...QUERY_KEYS.notifications, filters]);

      queryClient.setQueryData([...QUERY_KEYS.notifications, filters], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.filter((n: Notification) => n.id !== notificationId),
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
    mutationFn: async (isArchived: boolean) => {
      const response = await apiService.notifications.clear(isArchived);
      return response.data;
    },
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
export const useInfiniteNotifications = (filters: NotificationFilters = {}, limit: number = 50) => {
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
    queryFn: async ({ pageParam = 0 }) => {
      const response = await apiService.notifications.getAll({ ...filters, offset: pageParam, limit });
      return normalizeNotificationResponse(response.data);
    },
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
    queryFn: async () => {
      const response = await apiService.notifications.getUnreadCount();
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute
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
    queryFn: async () => {
      const response = await apiService.preferences.get();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: async (preferences: Record<string, any>) => {
      const response = await apiService.preferences.update(preferences);
      return response.data;
    },
    onMutate: async (updates: Record<string, any>) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.preferences });

      const previousPreferences = queryClient.getQueryData(QUERY_KEYS.preferences);

      queryClient.setQueryData(QUERY_KEYS.preferences, (old: any) => {
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
 * Hook to sync server notifications with local toast display
 *
 * When a new notification arrives (e.g., via WebSocket):
 * 1. Invalidates React Query cache to refresh server notifications
 * 2. Adds to Zustand toasts for ephemeral UI display
 */
export const useNotificationSync = () => {
  const queryClient = useQueryClient();
  const { addToast } = useAppStore();

  // Listen for new notifications from WebSocket
  const handleNewNotification = useCallback(
    (notification: Record<string, unknown>) => {
      // Normalize the notification data
      const normalizedNotification = normalizeNotification(notification);

      // Invalidate all notification queries to force refetch
      // This ensures all active queries (with different filter combinations) get the new data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });

      // Invalidate unread count
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });

      // Add to Zustand toasts for ephemeral UI display
      const n = normalizedNotification as any;
      if (n.show_as_toast || n.showAsToast) {
        addToast({
          type: n.type || 'info',
          title: n.title,
          message: n.message,
          category: n.category || 'System',
          priority: n.priority || 'medium',
          duration: n.duration || 5000,
          actionUrl: n.actionUrl,
          metadata: n.metadata,
        });
      }
    },
    [queryClient, addToast]
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
  usePriceAlerts: usePriceAlertsAPI,
  useNotificationSync,
};