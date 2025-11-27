/**
 * Test Utilities for TheCreditWhisperers Frontend
 *
 * This module provides a comprehensive set of testing utilities including:
 * - Custom render function with providers
 * - Mock factories for Zustand store, React Query, and API
 * - Data factories for users, portfolios, news, and notifications
 *
 * @example
 * ```tsx
 * import {
 *   render,
 *   screen,
 *   createUser,
 *   createHolding,
 *   createMockStore,
 * } from '../test-utils';
 *
 * test('renders component with data', () => {
 *   render(<MyComponent user={createUser()} />);
 *   expect(screen.getByText('Test User')).toBeInTheDocument();
 * });
 * ```
 */

// =============================================================================
// CUSTOM RENDER
// =============================================================================
export { render, createTestQueryClient } from './render';

// =============================================================================
// RE-EXPORT TESTING LIBRARY
// =============================================================================
export {
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
  fireEvent,
  act,
  renderHook,
  cleanup,
} from '@testing-library/react';

export { default as userEvent } from '@testing-library/user-event';

// =============================================================================
// ZUSTAND MOCKS
// =============================================================================
export {
  createMockStore,
  resetStoreMocks,
  createMockSelector,
  defaultMockState,
  mockActions,
} from './mocks/zustand';

// =============================================================================
// REACT QUERY MOCKS
// =============================================================================
export {
  createTestQueryClient as createQueryClient,
  createSuccessQueryResult,
  createLoadingQueryResult,
  createErrorQueryResult,
  createIdleMutationResult,
  createPendingMutationResult,
  createSuccessMutationResult,
  createErrorMutationResult,
} from './mocks/react-query';

// =============================================================================
// API MOCKS
// =============================================================================
export {
  createMockApiService,
  resetApiMocks,
  setupMockResponse,
  setupMockError,
  mockApiResponses,
} from './mocks/api';

// =============================================================================
// DATA FACTORIES
// =============================================================================

// User factories
export { createUser, createSelectedAccount, createUsers } from './factories/user';

// Portfolio factories
export {
  createHolding,
  createHoldingsArray,
  createRealisticPortfolio,
  createAccount,
  createAccounts,
  createPerformanceMetric,
  createAllPerformanceMetrics,
  resetPortfolioFactoryCounters,
} from './factories/portfolio';

// News factories
export {
  createNewsArticle,
  createNewsArticles,
  createMixedSentimentNews,
  createSentiment,
  createDailySentiment,
  createDailySentimentSeries,
  getSentimentLabelFromScore,
  resetNewsFactoryCounters,
} from './factories/news';

// Notification factories
export {
  createNotification,
  createNotifications,
  createNotificationsByType,
  createNotificationsByCategory,
  createPriceAlert,
  createPriceAlerts,
  createAlertsByCondition,
  createTriggeredAlert,
  resetNotificationFactoryCounters,
} from './factories/notifications';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Reset all factory counters
 * Call this in beforeEach for consistent IDs across tests
 */
export function resetAllFactories(): void {
  const { resetPortfolioFactoryCounters } = require('./factories/portfolio');
  const { resetNewsFactoryCounters } = require('./factories/news');
  const { resetNotificationFactoryCounters } = require('./factories/notifications');

  resetPortfolioFactoryCounters();
  resetNewsFactoryCounters();
  resetNotificationFactoryCounters();
}

/**
 * Flush all pending promises
 * Useful for waiting for async operations to complete
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Wait for a condition to be true
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition not met within timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Create a deferred promise for testing async flows
 */
export function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
