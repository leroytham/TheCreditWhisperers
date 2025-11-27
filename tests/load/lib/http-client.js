/**
 * =============================================================================
 * k6 HTTP Client Utilities
 * =============================================================================
 * Shared HTTP request helpers for all k6 load tests.
 */

import http from 'k6/http';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_TIMEOUT = '30s';

/**
 * Get the base URL from environment or default to localhost
 */
export function getBaseUrl() {
  return __ENV.BASE_URL || 'http://localhost:8000';
}

// =============================================================================
// HTTP REQUEST HELPERS
// =============================================================================

/**
 * Make an HTTP GET request with standard headers
 * @param {string} endpoint - API endpoint path
 * @param {string} name - Request name for tagging
 * @param {object} options - Additional options (headers, tags, timeout)
 */
export function makeRequest(endpoint, name, options = {}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const params = {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'k6-load-test/1.0',
      ...options.headers,
    },
    tags: { name: name, ...options.tags },
    timeout: options.timeout || DEFAULT_TIMEOUT,
  };

  return http.get(url, params);
}

/**
 * Make an HTTP POST request with JSON body
 * @param {string} endpoint - API endpoint path
 * @param {string} name - Request name for tagging
 * @param {object} body - Request body (will be JSON stringified)
 * @param {object} options - Additional options
 */
export function makePostRequest(endpoint, name, body, options = {}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const params = {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-test/1.0',
      ...options.headers,
    },
    tags: { name: name, ...options.tags },
    timeout: options.timeout || DEFAULT_TIMEOUT,
  };

  return http.post(url, JSON.stringify(body), params);
}

/**
 * Verify the base URL is reachable before running tests
 * @returns {object} Setup data containing baseUrl
 * @throws {Error} If base URL is not reachable
 */
export function verifyBaseUrlReachable() {
  const baseUrl = getBaseUrl();

  console.log(`Verifying base URL: ${baseUrl}`);

  const res = http.get(`${baseUrl}/health/live`, {
    timeout: '10s',
  });

  if (res.status !== 200) {
    throw new Error(`Base URL not reachable: ${baseUrl} (status: ${res.status})`);
  }

  console.log('Base URL is reachable, starting tests...');
  return { baseUrl };
}
