import type { Holding, Account, PerformanceMetric, SentimentLabel } from '../../types';

// Counter for generating unique IDs
let holdingIdCounter = 0;
let accountIdCounter = 0;

/**
 * Reset factory counters - call this in beforeEach for consistent IDs
 */
export function resetPortfolioFactoryCounters(): void {
  holdingIdCounter = 0;
  accountIdCounter = 0;
}

/**
 * Create a mock Holding object
 *
 * @example
 * ```ts
 * const holding = createHolding(); // Default holding
 * const appleHolding = createHolding({
 *   ticker: 'AAPL',
 *   quantity: 50,
 *   current_price: 175.50,
 * });
 * ```
 */
export function createHolding(overrides: Partial<Holding> = {}): Holding {
  holdingIdCounter++;
  const ticker = overrides.ticker || `TICK${holdingIdCounter}`;
  const quantity = overrides.quantity ?? 100;
  const costBasis = overrides.cost_basis ?? 95.0;
  const currentPrice = overrides.current_price ?? 100.0;
  const position = quantity * currentPrice;
  const gainLoss = (currentPrice - costBasis) * quantity;
  const gainLossPercent = ((currentPrice - costBasis) / costBasis) * 100;

  return {
    ticker,
    symbol: ticker,
    quantity,
    position: position.toFixed(2),
    cost_basis: costBasis,
    current_price: currentPrice,
    gain_loss: gainLoss,
    gainLossPercent: parseFloat(gainLossPercent.toFixed(2)),
    isPositive: gainLoss >= 0,
    purchase_date: '2024-01-15',
    sentiment_score: 0.65,
    sentiment_label: 'Somewhat-Bullish' as SentimentLabel,
    news_volume: 25,
    ...overrides,
  };
}

/**
 * Create multiple holdings
 *
 * @example
 * ```ts
 * const holdings = createHoldingsArray(5);
 * const techHoldings = createHoldingsArray(3, { sentiment_label: 'Bullish' });
 * ```
 */
export function createHoldingsArray(
  count: number,
  overrides: Partial<Holding> = {}
): Holding[] {
  return Array.from({ length: count }, (_, i) =>
    createHolding({
      ticker: `TICK${i + 1}`,
      symbol: `TICK${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create a realistic portfolio with common stocks
 */
export function createRealisticPortfolio(): Holding[] {
  return [
    createHolding({ ticker: 'AAPL', symbol: 'AAPL', quantity: 50, cost_basis: 150, current_price: 175, sentiment_label: 'Bullish' }),
    createHolding({ ticker: 'MSFT', symbol: 'MSFT', quantity: 30, cost_basis: 280, current_price: 320, sentiment_label: 'Somewhat-Bullish' }),
    createHolding({ ticker: 'GOOGL', symbol: 'GOOGL', quantity: 20, cost_basis: 120, current_price: 140, sentiment_label: 'Neutral' }),
    createHolding({ ticker: 'AMZN', symbol: 'AMZN', quantity: 25, cost_basis: 140, current_price: 160, sentiment_label: 'Somewhat-Bullish' }),
    createHolding({ ticker: 'NVDA', symbol: 'NVDA', quantity: 15, cost_basis: 400, current_price: 500, sentiment_label: 'Bullish' }),
  ];
}

/**
 * Create a mock Account object
 *
 * @example
 * ```ts
 * const account = createAccount();
 * const primaryAccount = createAccount({ is_primary: true });
 * ```
 */
export function createAccount(overrides: Partial<Account> = {}): Account {
  accountIdCounter++;
  return {
    id: `acc_${Date.now()}_${accountIdCounter}`,
    client_account_name: `Test Portfolio ${accountIdCounter}`,
    account_no: `ACC${String(accountIdCounter).padStart(3, '0')}`,
    is_primary: accountIdCounter === 1,
    ...overrides,
  };
}

/**
 * Create multiple accounts
 *
 * @example
 * ```ts
 * const accounts = createAccounts(3);
 * // First account will be primary by default
 * ```
 */
export function createAccounts(count: number, overrides: Partial<Account> = {}): Account[] {
  return Array.from({ length: count }, (_, i) =>
    createAccount({
      client_account_name: `Portfolio ${i + 1}`,
      is_primary: i === 0,
      ...overrides,
    })
  );
}

/**
 * Create a mock PerformanceMetric object
 *
 * @example
 * ```ts
 * const metric = createPerformanceMetric();
 * const ytdMetric = createPerformanceMetric({
 *   period: 'YTD',
 *   portfolio_return: 15.5,
 *   sp500_return: 12.3,
 * });
 * ```
 */
export function createPerformanceMetric(
  overrides: Partial<PerformanceMetric> = {}
): PerformanceMetric {
  return {
    period: 'YTD',
    portfolio_return: 12.5,
    sp500_return: 10.2,
    calculation_date: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a complete set of performance metrics (MTD, QTD, YTD, ITD)
 *
 * @example
 * ```ts
 * const allMetrics = createAllPerformanceMetrics();
 * const outperformingMetrics = createAllPerformanceMetrics({
 *   portfolioReturns: { MTD: 5, QTD: 10, YTD: 20, ITD: 50 },
 *   benchmarkReturns: { MTD: 3, QTD: 8, YTD: 15, ITD: 40 },
 * });
 * ```
 */
export function createAllPerformanceMetrics(options?: {
  portfolioReturns?: { MTD?: number; QTD?: number; YTD?: number; ITD?: number };
  benchmarkReturns?: { MTD?: number; QTD?: number; YTD?: number; ITD?: number };
}): PerformanceMetric[] {
  const portfolioReturns = {
    MTD: 2.5,
    QTD: 5.8,
    YTD: 12.5,
    ITD: 35.2,
    ...options?.portfolioReturns,
  };

  const benchmarkReturns = {
    MTD: 2.1,
    QTD: 5.2,
    YTD: 10.2,
    ITD: 28.5,
    ...options?.benchmarkReturns,
  };

  const periods: Array<'MTD' | 'QTD' | 'YTD' | 'ITD'> = ['MTD', 'QTD', 'YTD', 'ITD'];

  return periods.map((period) =>
    createPerformanceMetric({
      period,
      portfolio_return: portfolioReturns[period],
      sp500_return: benchmarkReturns[period],
    })
  );
}
