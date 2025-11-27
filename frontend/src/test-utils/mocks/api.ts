/**
 * Mock API service for testing
 * Provides mock implementations for all API methods
 */

// Mock Axios response
interface MockResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Record<string, unknown>;
}

function createMockResponse<T>(data: T, status = 200): MockResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {},
  };
}

/**
 * Create a mock API service with jest functions
 *
 * @example
 * ```ts
 * jest.mock('../services/api', () => ({
 *   __esModule: true,
 *   default: createMockApiService(),
 * }));
 * ```
 */
export function createMockApiService() {
  return {
    get: jest.fn().mockImplementation(() => Promise.resolve(createMockResponse({}))),
    post: jest.fn().mockImplementation(() => Promise.resolve(createMockResponse({}))),
    put: jest.fn().mockImplementation(() => Promise.resolve(createMockResponse({}))),
    delete: jest.fn().mockImplementation(() => Promise.resolve(createMockResponse({}))),
    patch: jest.fn().mockImplementation(() => Promise.resolve(createMockResponse({}))),
  };
}

/**
 * Reset all mock API functions
 */
export function resetApiMocks(apiService: ReturnType<typeof createMockApiService>): void {
  apiService.get.mockClear();
  apiService.post.mockClear();
  apiService.put.mockClear();
  apiService.delete.mockClear();
  apiService.patch.mockClear();
}

/**
 * Setup mock API response for a specific call
 *
 * @example
 * ```ts
 * const mockApi = createMockApiService();
 * setupMockResponse(mockApi.get, { users: [] });
 *
 * // In test
 * await mockApi.get('/users');
 * expect(mockApi.get).toHaveBeenCalledWith('/users');
 * ```
 */
export function setupMockResponse<T>(
  mockFn: jest.Mock,
  data: T,
  status = 200
): void {
  mockFn.mockResolvedValueOnce(createMockResponse(data, status));
}

/**
 * Setup mock API error response
 *
 * @example
 * ```ts
 * const mockApi = createMockApiService();
 * setupMockError(mockApi.get, 404, 'Not found');
 * ```
 */
export function setupMockError(
  mockFn: jest.Mock,
  status = 500,
  message = 'Internal Server Error'
): void {
  const error = {
    response: {
      data: { detail: message },
      status,
      statusText: message,
    },
    message,
  };
  mockFn.mockRejectedValueOnce(error);
}

/**
 * Common API response mocks for testing
 */
export const mockApiResponses = {
  // Portfolio responses
  portfolioHoldings: (holdings = []) => ({
    holdings,
    total_value: holdings.reduce((sum: number, h: { position: string | number }) =>
      sum + (typeof h.position === 'string' ? parseFloat(h.position) : h.position), 0
    ),
  }),

  portfolioPerformance: (performance = []) => ({
    account_name: 'Test Portfolio',
    calculation_date: new Date().toISOString(),
    performance,
  }),

  portfolioAccounts: (accounts = []) => ({
    accounts,
  }),

  // News responses
  tickerNews: (ticker: string, news = []) => ({
    ticker,
    news,
    avg_score: 0.5,
    items: news.length,
  }),

  // Sentiment responses
  dailySentiment: (data = {}) => ({
    date: new Date().toISOString().split('T')[0],
    score: 0.5,
    count: 10,
    ...data,
  }),

  // User responses
  authMe: (user = { email: 'test@example.com' }) => ({
    user_id: user.email,
    authenticated: true,
    ...user,
  }),

  // Notification responses
  notifications: (notifications = [], total = 0) => ({
    notifications,
    total_count: total || notifications.length,
    has_more: false,
  }),
};
