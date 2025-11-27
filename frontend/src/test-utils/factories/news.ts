import type { NewsArticle, Sentiment, DailySentimentData, SentimentLabel } from '../../types';

// Counter for generating unique IDs
let newsIdCounter = 0;

/**
 * Reset factory counters - call this in beforeEach for consistent IDs
 */
export function resetNewsFactoryCounters(): void {
  newsIdCounter = 0;
}

/**
 * Create a mock NewsArticle object
 *
 * @example
 * ```ts
 * const article = createNewsArticle();
 * const bullishArticle = createNewsArticle({
 *   ticker: 'AAPL',
 *   sentiment_label: 'Bullish',
 *   sentiment_score: 0.85,
 * });
 * ```
 */
export function createNewsArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  newsIdCounter++;
  return {
    id: `news_${Date.now()}_${newsIdCounter}`,
    ticker: 'AAPL',
    title: `Test News Article ${newsIdCounter}`,
    summary: 'This is a test news summary for testing purposes.',
    url: `https://example.com/news/${newsIdCounter}`,
    image: 'https://example.com/image.jpg',
    provider: 'Test Provider',
    source: 'test-source',
    publish_date: new Date().toISOString(),
    sentiment_label: 'Neutral' as SentimentLabel,
    sentiment_score: 0.5,
    relevance_score: 0.8,
    topics: ['earnings', 'technology'],
    ...overrides,
  };
}

/**
 * Create multiple news articles
 *
 * @example
 * ```ts
 * const articles = createNewsArticles(5, { ticker: 'MSFT' });
 * ```
 */
export function createNewsArticles(
  count: number,
  overrides: Partial<NewsArticle> = {}
): NewsArticle[] {
  return Array.from({ length: count }, (_, i) =>
    createNewsArticle({
      title: `Test News Article ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create news articles with varying sentiments
 */
export function createMixedSentimentNews(ticker: string): NewsArticle[] {
  const sentiments: Array<{ label: SentimentLabel; score: number }> = [
    { label: 'Bullish', score: 0.85 },
    { label: 'Somewhat-Bullish', score: 0.65 },
    { label: 'Neutral', score: 0.5 },
    { label: 'Somewhat-Bearish', score: 0.35 },
    { label: 'Bearish', score: 0.15 },
  ];

  return sentiments.map((s, i) =>
    createNewsArticle({
      ticker,
      title: `${s.label} news for ${ticker}`,
      sentiment_label: s.label,
      sentiment_score: s.score,
    })
  );
}

/**
 * Create a mock Sentiment object
 *
 * @example
 * ```ts
 * const sentiment = createSentiment();
 * const bullishSentiment = createSentiment({
 *   ticker: 'NVDA',
 *   avg_score: 0.8,
 *   sentiment_momentum: 0.2,
 * });
 * ```
 */
export function createSentiment(overrides: Partial<Sentiment> = {}): Sentiment {
  return {
    ticker: 'AAPL',
    avg_score: 0.65,
    sentiment_momentum: 0.1,
    sentiment_volatility: 0.15,
    effective_news_volume: 50,
    sentiment_breadth_score: 0.7,
    sentiment_z_score: 1.2,
    data_quality: 'high',
    source_concentration_hhi: 0.25,
    top_sources: [
      { source: 'Reuters', count: 15, hhi_weight: 0.3 },
      { source: 'Bloomberg', count: 12, hhi_weight: 0.24 },
      { source: 'CNBC', count: 10, hhi_weight: 0.2 },
    ],
    dominant_topic: 'earnings',
    sentiment_by_topic: {
      earnings: 0.7,
      technology: 0.6,
      market: 0.5,
    },
    ...overrides,
  };
}

/**
 * Create a mock DailySentimentData object
 *
 * @example
 * ```ts
 * const dailySentiment = createDailySentiment();
 * const positiveSentiment = createDailySentiment({
 *   score: 0.8,
 *   count: 25,
 * });
 * ```
 */
export function createDailySentiment(
  overrides: Partial<DailySentimentData> = {}
): DailySentimentData {
  return {
    score: 0.6,
    count: 15,
    holdings_with_data: 8,
    headlines: ['Test headline 1', 'Test headline 2', 'Test headline 3'],
    ...overrides,
  };
}

/**
 * Create daily sentiment data for a date range
 *
 * @example
 * ```ts
 * const weekData = createDailySentimentSeries(7);
 * ```
 */
export function createDailySentimentSeries(
  days: number,
  options?: {
    baseScore?: number;
    variance?: number;
    trend?: 'up' | 'down' | 'flat';
  }
): Array<DailySentimentData & { date: string }> {
  const baseScore = options?.baseScore ?? 0.5;
  const variance = options?.variance ?? 0.1;
  const trend = options?.trend ?? 'flat';

  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));

    let trendAdjustment = 0;
    if (trend === 'up') trendAdjustment = (i / days) * 0.2;
    if (trend === 'down') trendAdjustment = -((i / days) * 0.2);

    const score = Math.max(
      0,
      Math.min(1, baseScore + trendAdjustment + (Math.random() - 0.5) * variance * 2)
    );

    return {
      date: date.toISOString().split('T')[0],
      ...createDailySentiment({
        score,
        count: Math.floor(10 + Math.random() * 20),
      }),
    };
  });
}

/**
 * Get sentiment label from score
 */
export function getSentimentLabelFromScore(score: number): SentimentLabel {
  if (score >= 0.8) return 'Bullish';
  if (score >= 0.6) return 'Somewhat-Bullish';
  if (score >= 0.4) return 'Neutral';
  if (score >= 0.2) return 'Somewhat-Bearish';
  return 'Bearish';
}
