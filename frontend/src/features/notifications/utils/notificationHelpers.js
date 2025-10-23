/**
 * Notification Helper Utilities
 *
 * Centralized logic for triggering notifications across the application
 */

/**
 * Get user-friendly error message from API error
 */
export const getErrorMessage = (error) => {
  if (!error.response) {
    return 'Network error. Please check your connection.';
  }

  const { status, data } = error.response;

  if (data?.detail) {
    return typeof data.detail === 'string' ? data.detail : 'An error occurred';
  }

  if (data?.message) {
    return data.message;
  }

  // Default messages by status code
  const statusMessages = {
    400: 'Invalid request. Please check your input.',
    401: 'Session expired. Please login again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    408: 'Request timeout. Please try again.',
    429: 'Too many requests. Please slow down.',
    500: 'Server error. Please try again later.',
    502: 'Bad gateway. The server is temporarily unavailable.',
    503: 'Service unavailable. Please try again later.',
  };

  return statusMessages[status] || `An error occurred (${status})`;
};

/**
 * Determine if API response should trigger a success notification
 */
export const shouldShowSuccessNotification = (config) => {
  // Only show for mutations (POST, PUT, PATCH, DELETE)
  const mutationMethods = ['post', 'put', 'patch', 'delete'];
  return mutationMethods.includes(config.method?.toLowerCase());
};

/**
 * Get success message from API response
 */
export const getSuccessMessage = (config, response) => {
  const method = config.method?.toLowerCase();
  const url = config.url || '';

  // Custom messages based on endpoint patterns
  if (url.includes('/watchlist')) {
    return method === 'post' ? 'Added to watchlist' : 'Removed from watchlist';
  }

  if (url.includes('/portfolio')) {
    if (method === 'post') return 'Portfolio updated successfully';
    if (method === 'delete') return 'Portfolio item removed';
  }

  if (url.includes('/alerts')) {
    if (method === 'post') return 'Alert created successfully';
    if (method === 'delete') return 'Alert removed';
  }

  // Use response message if available
  if (response.data?.message) {
    return response.data.message;
  }

  // Default messages by method
  const defaultMessages = {
    post: 'Created successfully',
    put: 'Updated successfully',
    patch: 'Updated successfully',
    delete: 'Deleted successfully',
  };

  return defaultMessages[method] || 'Operation completed successfully';
};

/**
 * Determine notification category from API endpoint
 */
export const getCategoryFromUrl = (url) => {
  if (!url) return 'System';

  if (url.includes('/portfolio')) return 'Portfolio';
  if (url.includes('/stocks') || url.includes('/price') || url.includes('/sector')) return 'Market';
  if (url.includes('/news') || url.includes('/sentiment')) return 'News';

  return 'System';
};

/**
 * Check if error should be suppressed (not shown as notification)
 */
export const shouldSuppressError = (error) => {
  // Suppress 401 errors as they trigger redirect
  if (error.response?.status === 401) {
    return true;
  }

  // Suppress if explicitly marked
  if (error.config?.suppressNotification) {
    return true;
  }

  return false;
};

/**
 * Check if success notification should be suppressed
 */
export const shouldSuppressSuccess = (config) => {
  // Suppress GET requests
  if (config.method?.toLowerCase() === 'get') {
    return true;
  }

  // Suppress if explicitly marked
  if (config.suppressNotification) {
    return true;
  }

  return false;
};

/**
 * Format notification for price alert
 */
export const formatPriceAlertNotification = (ticker, currentPrice, alertPrice, alertType) => {
  const direction = alertType === 'above' ? 'risen above' : 'fallen below';
  return {
    type: 'warning',
    category: 'Market',
    title: `Price Alert: ${ticker}`,
    message: `${ticker} has ${direction} $${alertPrice}. Current price: $${currentPrice}`,
    priority: 'high',
    actionUrl: `/entity?ticker=${ticker}`,
    metadata: { ticker, currentPrice, alertPrice, alertType },
  };
};

/**
 * Format notification for news update
 */
export const formatNewsNotification = (ticker, newsCount, sentiment) => {
  const sentimentText = sentiment > 0.1 ? 'positive' : sentiment < -0.1 ? 'negative' : 'neutral';
  return {
    type: 'info',
    category: 'News',
    title: `${newsCount} new article${newsCount > 1 ? 's' : ''} for ${ticker}`,
    message: `Overall sentiment: ${sentimentText}`,
    priority: 'low',
    actionUrl: `/entity?ticker=${ticker}`,
    metadata: { ticker, newsCount, sentiment },
  };
};

/**
 * Format notification for portfolio update
 */
export const formatPortfolioNotification = (type, message, data = {}) => {
  return {
    type,
    category: 'Portfolio',
    title: 'Portfolio Update',
    message,
    priority: type === 'error' ? 'high' : 'medium',
    actionUrl: '/portfolio',
    metadata: data,
  };
};
