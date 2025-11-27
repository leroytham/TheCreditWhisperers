/**
 * =============================================================================
 * Market Data Scenario
 * =============================================================================
 * Tests market data endpoints (stock quotes)
 */

import { check, sleep, group } from 'k6';
import { makeRequest } from '../lib/http-client.js';
import { marketFailRate, marketDuration } from '../lib/metrics.js';
import { endpoints, marketTickers, getRandomTicker, sleepDurations } from '../lib/data.js';

/**
 * Log response details for debugging (only on errors)
 */
function logOnError(res, name) {
  if (res.status !== 200 && res.status !== 429) {
    const body = res.body ? res.body.substring(0, 200) : 'empty';
    console.log(`[${name}] Status: ${res.status}, Body: ${body}`);
  }
}

/**
 * Market Data Scenario
 * Tests stock quote and market data endpoints
 * @param {number} sleepTime - Optional custom sleep duration
 */
export function marketDataScenario(sleepTime = sleepDurations.market) {
  group('Market Data', () => {
    const randomTicker = getRandomTicker(marketTickers);

    const quoteRes = makeRequest(endpoints.market.quote(randomTicker), 'market_quote');
    marketDuration.add(quoteRes.timings.duration);
    const quoteOk = check(quoteRes, {
      'market quote returns 200 or 429': (r) => r.status === 200 || r.status === 429,
      'market quote has data': (r) => {
        if (r.status === 429) return true; // Rate limited is acceptable
        try {
          const body = JSON.parse(r.body);
          return body !== null;
        } catch {
          return false;
        }
      },
    });
    marketFailRate.add(!quoteOk);
    logOnError(quoteRes, 'market_quote');
  });

  // Sleep to respect rate limits (60 req/min)
  sleep(sleepTime);
}

/**
 * Quick Market Check (for spike tests - minimal sleep)
 */
export function quickMarketCheck() {
  const randomTicker = getRandomTicker(marketTickers);
  const quoteRes = makeRequest(endpoints.market.quote(randomTicker), 'market_quote');
  marketDuration.add(quoteRes.timings.duration);
  const quoteOk = check(quoteRes, {
    'market quote returns 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
  marketFailRate.add(!quoteOk);

  sleep(sleepDurations.spike);
}
