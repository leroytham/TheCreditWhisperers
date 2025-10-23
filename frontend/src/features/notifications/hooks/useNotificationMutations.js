import { useMutation, useQueryClient } from '@tanstack/react-query';
import useAppStore from '../../../store/useAppStore';

/**
 * Custom hook for React Query mutations with automatic notifications
 *
 * Wraps any mutation function and automatically triggers success/error notifications
 *
 * @param {Function} mutationFn - The mutation function to execute
 * @param {Object} options - Additional options
 * @returns {Object} - React Query mutation object
 */
export const useNotificationMutation = (mutationFn, options = {}) => {
  const queryClient = useQueryClient();
  const { notifySuccess, notifyError } = useAppStore();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      // Show success notification
      if (!options.suppressSuccessNotification) {
        const message = options.successMessage || 'Operation completed successfully';
        notifySuccess(message, {
          category: options.category || 'System',
          duration: 3000,
        });
      }

      // Invalidate queries if specified
      if (options.invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: options.invalidateQueries });
      }

      // Call custom onSuccess handler
      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Show error notification
      if (!options.suppressErrorNotification) {
        const message = error.message || 'An error occurred';
        notifyError(message, {
          category: options.category || 'System',
          priority: 'high',
        });
      }

      // Call custom onError handler
      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    ...options,
  });
};

/**
 * Example usage in components:
 *
 * const addToWatchlistMutation = useNotificationMutation(
 *   (ticker) => apiService.post('/watchlist', { ticker }),
 *   {
 *     successMessage: 'Added to watchlist',
 *     category: 'Portfolio',
 *     invalidateQueries: ['watchlist'],
 *   }
 * );
 *
 * Then use: addToWatchlistMutation.mutate('AAPL')
 */
