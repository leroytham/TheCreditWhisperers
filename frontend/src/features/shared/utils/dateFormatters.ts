// frontend/src/features/shared/utils/dateFormatters.js

/**
 * Formats a date object into a readable format like "Jan 15, 2025".
 * @param {Date} date - The date object to format.
 * @returns {string} The formatted date string.
 */
const formatDate = (date) => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Formats an ISO date string into a relative time format (e.g., "2 hours ago").
 * Falls back to a standard date format for dates older than 7 days.
 * @param {string} dateString - The ISO date string to format.
 * @returns {string} The formatted relative or absolute time string.
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();

  // Handle invalid or future dates
  if (isNaN(date.getTime()) || diffMs < 0) {
    // If date is invalid or in the future, return formatted date or empty string
    return !isNaN(date.getTime()) ? formatDate(date) : '';
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return formatDate(date);
};
