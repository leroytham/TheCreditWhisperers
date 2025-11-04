import { useState, useEffect } from 'react';
import { resolveNewsTicker, resolveYfinanceSectorKey } from '../utils/tickerResolver';
import apiService from '../../../services/api';

/**
 * Custom hook for fetching comprehensive sector data
 * Fetches price, news, constituents, sentiment, and significant events
 * @param {string} ticker - Ticker symbol for the sector
 * @param {string} timeframe - Timeframe for price data (default '1Y')
 * @param {Object} sector - Optional sector object with yfinanceKey for aggregated news
 * @returns {Object} Sector data and loading/error states
 */
export const useSectorData = (ticker, timeframe = '1Y', sector = null) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    priceData1Y: [],
    news: [],
    dailySentiment: {},
    topConstituents: [],
    topEvents: [],
    companyName: '',
    currency: 'USD',
    lastFetched: null,
    // Unified sentiment object containing all sentiment metrics
    sentiment: {
      // Core sentiment scores
      avg: null,
      fast_score: null,
      slow_score: null,
      // Momentum metrics
      momentum: null,
      momentum_label: null,
      momentum_interpretation: null,
      momentum_quality: null,
      momentum_direction: null,
      momentum_strength: null,
      half_life_fast_hours: null,
      half_life_slow_hours: null,
      // Data quality
      data_quality: null,
      // Sector-specific metrics
      volatility: null,
      breadth_score: null,
      num_bullish_mentions: null,
      num_bearish_mentions: null,
      breadth_interpretation: null,
      ticker_coverage: null,
      effective_news_volume: null,
      volume_interpretation: null,
      // Z-Score / Shock metrics
      z_score: null,
      z_score_interpretation: null,
      z_score_historical_mean: null,
      z_score_historical_std: null,
      z_score_days_of_history: null,
      z_score_quality: null,
      // Article count
      total_articles_analyzed: null
    },
    // Aggregated news metadata
    newsAggregationMetadata: null
  });

  // Fetch all data once when ticker changes
  useEffect(() => {
    if (!ticker) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    const newsTicker = resolveNewsTicker(ticker);
    const yfinanceKey = sector ? resolveYfinanceSectorKey(sector) : null;

    const fetchConstituents = fetch(`/api/sectors/${encodeURIComponent(ticker)}/top-constituents`)
      .then(r => r.json());

    // Use aggregated news if yfinanceKey is available, otherwise use single ticker news
    const fetchNews = yfinanceKey
      ? apiService.getSectorAggregatedNews(yfinanceKey, { limit: 1000, timeframe: '1W' })
          .then(r => r.data)
      : fetch(`/api/news?ticker=${encodeURIComponent(newsTicker)}`)
          .then(r => r.json());

    // Use sector daily sentiment endpoint if yfinanceKey is available, otherwise use stock endpoint
    const fetchDailySentiment = yfinanceKey
      ? apiService.getSectorDailySentiment(yfinanceKey, 30)
          .then(r => r.data)
      : fetch(`/api/daily-sentiment?ticker=${encodeURIComponent(newsTicker)}`)
          .then(r => r.json());

    const fetchAnalysis = fetch(`/api/stocks/${encodeURIComponent(newsTicker)}/significant-events?timeframe=${timeframe}`)
      .then(r => r.json());

    Promise.allSettled([fetchNews, fetchConstituents, fetchDailySentiment, fetchAnalysis])
      .then(([newsRes, constRes, dailySentimentRes, analysisRes]) => {
        if (!mounted) return;

        const newData = { ...data };
        // Note: price fetching is handled in a separate effect (below) which
        // depends on `timeframe`. This prevents re-fetching heavy news/analysis
        // when the user toggles the chart timeframe (eg. 1Y -> 5Y).

        // Process news data
        if (newsRes.status === 'fulfilled' && newsRes.value) {
          const n = newsRes.value;

          // Check if this is aggregated news (from new endpoint) or legacy news
          const isAggregatedNews = n.success && n.articles;

          if (isAggregatedNews) {
            // Process aggregated news response - articles are already in Alpha Vantage feed format
            const raw = n.articles || [];
            
            // Articles are already in Alpha Vantage format, just use them directly
            newData.news = raw;

            // Store aggregation metadata
            newData.newsAggregationMetadata = {
              sector_name: n.sector_name,
              tickers_queried: n.tickers_queried,
              total_tickers: n.total_tickers,
              total_articles_fetched: n.total_articles_fetched,
              unique_articles: n.unique_articles,
              deduplication_rate: n.deduplication_rate,
              metadata: n.metadata,
              total_market_weight_coverage: n.total_market_weight_coverage,
              success_rate: n.success_rate
            };

            // Extract sector sentiment metrics from aggregated news response
            if (n.sentiment_metrics) {
              const sm = n.sentiment_metrics;

              newData.sentiment = {
                avg: sm.slow_score,
                fast_score: sm.fast_score,
                slow_score: sm.slow_score,
                momentum: sm.sentiment_momentum,
                momentum_label: sm.momentum_label,
                momentum_interpretation: sm.momentum_interpretation,
                momentum_quality: sm.momentum_quality,
                momentum_direction: sm.momentum_direction,
                momentum_strength: sm.momentum_strength,
                half_life_fast_hours: sm.half_life_fast_hours,
                half_life_slow_hours: sm.half_life_slow_hours,
                data_quality: sm.data_quality,
                volatility: sm.sentiment_volatility,
                sentiment_volatility: sm.sentiment_volatility,
                volatility_quality: sm.volatility_quality,
                breadth_score: sm.sentiment_breadth_score,
                num_bullish_mentions: sm.num_bullish_mentions,
                num_bearish_mentions: sm.num_bearish_mentions,
                breadth_interpretation: sm.breadth_interpretation,
                ticker_coverage: sm.ticker_coverage,
                effective_news_volume: sm.effective_news_volume,
                volume_interpretation: sm.volume_interpretation,
                z_score: sm.sentiment_z_score,
                z_score_interpretation: sm.z_score_interpretation,
                z_score_historical_mean: sm.z_score_historical_mean,
                z_score_historical_std: sm.z_score_historical_std,
                z_score_days_of_history: sm.z_score_days_of_history,
                z_score_quality: sm.z_score_quality,
                total_articles_analyzed: sm.total_articles_analyzed,
                // Source concentration
                source_concentration_hhi: sm.source_concentration_hhi,
                concentration_interpretation: sm.concentration_interpretation,
                top_sources: sm.top_sources,
                // Topic analysis
                dominant_topic: sm.dominant_topic,
                dominant_topic_weight: sm.dominant_topic_weight,
                dominant_topic_percentage: sm.dominant_topic_percentage,
                topic_count: sm.topic_count,
                sentiment_by_topic: sm.sentiment_by_topic,
                topic_weights: sm.topic_weights
              };
            } else {
              console.warn('[useSectorData] No sentiment_metrics found in aggregated news response');
            }
          } else {
            // Process legacy news response
            const raw = n.news || [];
            const normalized = raw.map(article => ({
              title: article.title || article.headline || article.headline_text || article.summary || '',
              link: article.link || article.url || article.href || article.source_link || article.source || '#',
              publish_date: article.publish_date || article.date || article.publishedAt || article.pub_date || '',
              provider: article.provider || article.source || article.source_name || '',
              sentiment_score: (article.sentiment_score ?? article.score ?? null),
              sentiment_label: article.sentiment_label || 'Neutral',
              image: article.image || null,
              relevance_score: article.relevance_score || null
            }));
            newData.news = normalized;

            // Extract sentiment metrics from legacy response
            newData.sentiment = {
              avg: n.avg_score ?? n.avgScore ?? null,
              fast_score: n.fast_score,
              slow_score: n.slow_score,
              momentum: n.sentiment_momentum,
              momentum_label: n.momentum_label,
              momentum_interpretation: n.momentum_interpretation,
              momentum_quality: n.momentum_quality,
              momentum_direction: n.momentum_direction,
              momentum_strength: n.momentum_strength,
              half_life_fast_hours: n.half_life_fast_hours,
              half_life_slow_hours: n.half_life_slow_hours,
              data_quality: n.data_quality,
              volatility: null,
              breadth_score: null,
              num_bullish_mentions: null,
              num_bearish_mentions: null,
              breadth_interpretation: null,
              ticker_coverage: null,
              effective_news_volume: null,
              volume_interpretation: null,
              z_score: n.sentiment_z_score,
              z_score_interpretation: n.z_score_interpretation,
              z_score_historical_mean: n.z_score_historical_mean,
              z_score_historical_std: n.z_score_historical_std,
              z_score_days_of_history: n.z_score_days_of_history,
              z_score_quality: n.z_score_quality
            };
          }
        } else {
          console.error('News fetch failed', newsRes.reason || newsRes.value);
          setError(prev => prev ? prev + ' | news failed' : 'news failed');
        }

        // Process constituents
        if (constRes.status === 'fulfilled' && constRes.value && constRes.value.success) {
          newData.topConstituents = constRes.value.top_constituents || [];
        } else {
          console.error('Top constituent fetch failed', constRes.reason || constRes.value);
        }

        // Process daily sentiment
        if (dailySentimentRes.status === 'fulfilled' && dailySentimentRes.value) {
          // Handle both sector endpoint response (dailySentimentRes.value.daily)
          // and stock endpoint response (dailySentimentRes.value.daily)
          const dailyData = dailySentimentRes.value.daily || {};
          newData.dailySentiment = dailyData;

          if (Object.keys(dailyData).length === 0) {
            console.warn('[useSectorData] Daily sentiment data is empty');
          }
        } else {
          console.error('Daily sentiment fetch failed', dailySentimentRes.reason || dailySentimentRes.value);
        }

        // Process significant events
        if (analysisRes.status === 'fulfilled' && analysisRes.value) {
          const rawEvents = analysisRes.value.events || [];
          const transformedEvents = rawEvents.map(event => {
            const movePct = event.total_move_pct * 100;
            return {
              ...event,
              trend: movePct >= 0 ? 'Upward' : 'Downward',
              total_move_pct: movePct,
              end_date: event.start_date,
              days: 1
            };
          });
          newData.topEvents = transformedEvents;

          // Debug logging to verify news data structure
          console.log('[useSectorData] Sector topEvents with news:', transformedEvents);
          if (transformedEvents.length > 0) {
            console.log('[useSectorData] First event news array:', transformedEvents[0].news);
          }
        } else {
          console.error('Analysis fetch failed', analysisRes.reason || analysisRes.value);
        }

        setData(newData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error', err);
        if (mounted) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, sector?.yfinanceKey]);

  // Fetch and poll only price data. This effect depends on the selected timeframe
  // so a switch to '5Y' will fetch the longer history without re-fetching news
  // or analysis payloads.
  useEffect(() => {
    if (!ticker) return;

    const pollPriceData = async () => {
      try {
        const response = await fetch(`/api/price?ticker=${encodeURIComponent(ticker)}&timeframe=${encodeURIComponent(timeframe)}`);
        const priceData = await response.json();

        // Update only price-related data, preserve everything else
        setData(prev => ({
          ...prev,
          priceData1Y: priceData.prices || prev.priceData1Y,
          companyName: priceData.company_name || prev.companyName,
          currency: priceData.currency || prev.currency,
          lastFetched: priceData.last_fetched || prev.lastFetched
        }));
      } catch (err) {
        console.error('Error polling price data:', err);
      }
    };

    // Initial fetch immediately, then poll every 5s
    pollPriceData();
    const intervalId = setInterval(pollPriceData, 5000);

    return () => clearInterval(intervalId);
  }, [ticker, timeframe]);

  return {
    ...data,
    loading,
    error
  };
};
