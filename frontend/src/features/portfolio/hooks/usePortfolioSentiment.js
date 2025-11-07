/**
 * usePortfolioSentiment Hook
 *
 * Custom hook for fetching aggregated portfolio daily sentiment data from the backend.
 * Returns portfolio-weighted sentiment scores, moving averages, and sentiment metadata.
 *
 * @param {string} username - Portfolio username
 * @param {string} accountName - Portfolio account name
 * @param {Array} holdings - Array of holdings (for fallback and table display)
 * @param {string} timeframe - Timeframe for sentiment data ('1D', '1W', '1M', '3M', '6M', 'YTD', '1Y')
 * @param {boolean} enabled - Whether to fetch data (for lazy loading)
 * @returns {Object} { sentimentData, holdingsSentiment, loading, error }
 */

import { useState, useEffect } from 'react';
import apiService from '../../../services/api';

export const usePortfolioSentiment = (username, accountName, holdings, timeframe = '1W', enabled = true) => {
  const [sentimentData, setSentimentData] = useState(null);
  const [holdingsSentiment, setHoldingsSentiment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If not enabled (lazy loading - tab not active), set loading to false
    if (!enabled || !username || !accountName) {
      setLoading(false);
      setSentimentData(null);
      setHoldingsSentiment([]);
      return;
    }

    // Set loading immediately when dependencies change
    setLoading(true);
    setError(null);
    // BUG FIX: Clear stale data when new request starts
    setSentimentData(null);
    setHoldingsSentiment([]);

    const controller = new AbortController();

    /**
     * Fetches aggregated portfolio sentiment from backend
     */
    const fetchPortfolioSentiment = async () => {
      try {
        // Fetch aggregated daily sentiment from backend
        const response = await apiService.getPortfolioDailySentiment(
          username,
          accountName,
          timeframe
        );

        // Check if request was aborted
        if (controller.signal.aborted) {
          return;
        }

        const data = response.data;

        // Process daily data into time series format
        const dailyData = data.daily || {};
        const sortedDays = Object.entries(dailyData)
          .map(([date, dayData]) => ({
            date,
            avg_sentiment: dayData.score || 0,
            news_volume: dayData.count || 0,
            confidence: dayData.holdings_with_data ?
              (dayData.holdings_with_data / data.holdings_count) : 0,
            headlines: dayData.headlines || []
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate moving averages
        const FAST_WINDOW = 7;  // 7-day moving average
        const SLOW_WINDOW = 30; // 30-day moving average

        const timeSeries = sortedDays.map((day, index) => {
          // Calculate 7-day moving average (fast)
          const fastStartIndex = Math.max(0, index - (FAST_WINDOW - 1));
          const fast7Days = sortedDays.slice(fastStartIndex, index + 1);
          const fastAvg = fast7Days.reduce((sum, d) => sum + d.avg_sentiment, 0) / fast7Days.length;

          // Calculate 30-day moving average (slow)
          const slowStartIndex = Math.max(0, index - (SLOW_WINDOW - 1));
          const slow30Days = sortedDays.slice(slowStartIndex, index + 1);
          const slowAvg = slow30Days.reduce((sum, d) => sum + d.avg_sentiment, 0) / slow30Days.length;

          return {
            date: day.date,
            timestamp: day.date,
            label: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            avg_sentiment: day.avg_sentiment,
            sentiment: day.avg_sentiment, // For chart compatibility
            fast_sentiment: fastAvg,
            slow_sentiment: slowAvg,
            news_volume: day.news_volume,
            volume: day.news_volume, // For chart compatibility
            confidence: day.confidence,
            headlines: day.headlines || []  // Preserve headlines for chart detail panel
          };
        });

        // Calculate current aggregate metrics
        const currentPoint = timeSeries[timeSeries.length - 1] || {
          avg_sentiment: 0,
          news_volume: 0,
          confidence: 0,
          fast_sentiment: 0,
          slow_sentiment: 0
        };
        const prevPoint = timeSeries[timeSeries.length - 2] || currentPoint;
        const momentum = currentPoint.avg_sentiment - prevPoint.avg_sentiment;

        // Calculate holdings-level sentiment for breakdown table
        // Extract from aggregated headlines
        const holdingsMap = new Map();

        // Aggregate sentiment by holding from headlines
        Object.entries(dailyData).forEach(([date, dayData]) => {
          (dayData.headlines || []).forEach(headline => {
            const symbol = headline.symbol;
            if (!symbol) return;

            if (!holdingsMap.has(symbol)) {
              holdingsMap.set(symbol, {
                ticker: symbol,
                name: symbol,
                weight: headline.weight || 0,
                sentimentSum: 0,
                sentimentCount: 0,
                coverage: 0,
                recentScores: []
              });
            }

            const holding = holdingsMap.get(symbol);
            if (headline.sentiment_score !== undefined) {
              holding.sentimentSum += headline.sentiment_score;
              holding.sentimentCount++;
              holding.coverage++;

              // Keep recent scores for momentum calculation
              holding.recentScores.push({
                date,
                score: headline.sentiment_score
              });
            }
          });
        });

        // Calculate average sentiment and momentum for each holding
        let holdingsSentimentData = Array.from(holdingsMap.values()).map(holding => {
          const avgSentiment = holding.sentimentCount > 0
            ? holding.sentimentSum / holding.sentimentCount
            : 0;

          // Sort recent scores by date
          holding.recentScores.sort((a, b) => new Date(a.date) - new Date(b.date));

          // Calculate momentum (difference between latest and earliest)
          let sentimentMomentum = 0;
          if (holding.recentScores.length >= 2) {
            const latest = holding.recentScores[holding.recentScores.length - 1].score;
            const earliest = holding.recentScores[0].score;
            sentimentMomentum = latest - earliest;
          }

          return {
            ticker: holding.ticker,
            name: holding.name,
            weight: holding.weight * 100, // Convert back to percentage
            sentiment: avgSentiment,
            momentum: sentimentMomentum,
            coverage: holding.coverage
          };
        }).sort((a, b) => b.sentiment - a.sentiment);

        // BUG FIX: Always merge uncovered holdings (not just when zero coverage)
        if (holdings && holdings.length > 0) {
          // Create a map of tickers that have sentiment data
          const coveredTickers = new Set(holdingsSentimentData.map(h => h.ticker));

          // Add uncovered holdings with zero values
          const uncoveredHoldings = holdings
            .filter(h => !coveredTickers.has(h.ticker))
            .map(h => ({
              ticker: h.ticker,
              name: h.ticker,
              weight: h.weight || 0,
              sentiment: 0,
              momentum: 0,
              coverage: 0,
              hasData: false  // Flag for UI to show "No data" badge
            }));

          // Merge covered and uncovered holdings
          holdingsSentimentData = [
            ...holdingsSentimentData.map(h => ({ ...h, hasData: true })),
            ...uncoveredHoldings
          ];

          // Re-sort by weight (or sentiment if preferred)
          holdingsSentimentData.sort((a, b) => (b.weight || 0) - (a.weight || 0));
        }

        // Calculate breadth score (sentiment consistency)
        const sentimentValues = holdingsSentimentData
          .filter(h => h.coverage > 0)
          .map(h => h.sentiment);

        let breadthScore = 0.5; // Default neutral
        if (sentimentValues.length > 0) {
          const avgSent = sentimentValues.reduce((sum, v) => sum + v, 0) / sentimentValues.length;
          const variance = sentimentValues.reduce(
            (sum, v) => sum + Math.pow(v - avgSent, 2),
            0
          ) / sentimentValues.length;
          const stdDev = Math.sqrt(variance);
          // Normalize breadth score (lower std dev = higher breadth)
          breadthScore = Math.max(0, Math.min(1, 1 - (stdDev / 2)));
        }

        // Calculate shock score (magnitude of recent sentiment changes)
        const SHOCK_WINDOW = 7;
        const recentSentiments = timeSeries.slice(-SHOCK_WINDOW).map(t => t.avg_sentiment);
        let shockScore = 0;
        if (recentSentiments.length > 1) {
          const recentChanges = recentSentiments.slice(1).map(
            (val, i) => Math.abs(val - recentSentiments[i])
          );
          const avgChange = recentChanges.reduce((sum, c) => sum + c, 0) / recentChanges.length;
          // Scale to 0-1
          shockScore = Math.min(1, avgChange * 10);
        }

        // Determine momentum label
        const getMomentumLabel = (mom) => {
          if (mom > 0.1) return 'Strongly Improving';
          if (mom > 0.05) return 'Improving';
          if (mom > -0.05) return 'Stable';
          if (mom > -0.1) return 'Weakening';
          return 'Strongly Weakening';
        };

        // Process metadata with ALL advanced analytics fields
        const metadata = data.metadata || {};
        const aggregatedMetadata = {
          sourceConcentrationHhi: metadata.source_concentration_hhi,
          concentrationInterpretation: metadata.concentration_interpretation,
          topSources: metadata.top_sources || Object.entries(metadata.source_breakdown || {})
            .map(([source, percentage]) => ({ source, percentage }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5),
          dominantTopic: metadata.dominant_topic,
          dominantTopicWeight: metadata.dominant_topic_weight || metadata.topic_distribution?.[metadata.dominant_topic] || 0,
          dominantTopicPercentage: metadata.dominant_topic_percentage,
          topicCount: Object.keys(metadata.topic_distribution || {}).length,
          sentimentByTopic: metadata.sentiment_by_topic || {},
          topicWeights: metadata.topic_weights || {},
          holdingsCoverageDetails: metadata.holdings_coverage_details || null
        };

        setSentimentData({
          timeSeries,
          aggregate: {
            // Core sentiment scores
            avg_sentiment: currentPoint.avg_sentiment,
            slow_score: metadata.slow_score ?? currentPoint.avg_sentiment,  // BUG FIX: Use ?? to preserve zero values
            fast_score: metadata.fast_score,

            // Legacy moving averages (for backwards compatibility)
            fast_sentiment: currentPoint.fast_sentiment,
            slow_sentiment: currentPoint.slow_sentiment,

            // Momentum (use backend values)
            sentiment_momentum: metadata.sentiment_momentum,
            momentum: metadata.sentiment_momentum ?? momentum,  // BUG FIX: Use ?? to preserve zero values
            momentum_label: metadata.momentum_label ?? getMomentumLabel(momentum),  // BUG FIX: Use ?? to preserve zero values
            momentum_interpretation: metadata.momentum_interpretation,
            momentum_quality: metadata.momentum_quality,
            half_life_fast_hours: metadata.half_life_fast_hours,
            half_life_slow_hours: metadata.half_life_slow_hours,

            // News Coverage
            news_coverage: currentPoint.news_volume,
            effective_news_volume: metadata.effective_news_volume,
            volume_interpretation: metadata.volume_interpretation,

            // Sentiment Breadth (use backend values)
            sentiment_breadth_score: metadata.sentiment_breadth_score,
            breadth_score: metadata.sentiment_breadth_score ?? breadthScore,  // BUG FIX: Use ?? to preserve zero values
            num_bullish_articles: metadata.num_bullish_articles,
            num_bearish_articles: metadata.num_bearish_articles,
            total_directional_articles: metadata.total_directional_articles,
            breadth_interpretation: metadata.breadth_interpretation,
            breadth_quality: metadata.breadth_quality,
            avg_score: metadata.avg_score,

            // Sentiment Shock / Z-Score (use backend values)
            sentiment_z_score: metadata.sentiment_z_score,
            shock_score: shockScore, // Keep legacy for backwards compatibility
            z_score_interpretation: metadata.z_score_interpretation,
            z_score_historical_mean: metadata.z_score_historical_mean,
            z_score_historical_std: metadata.z_score_historical_std,
            z_score_days_of_history: metadata.z_score_days_of_history,
            z_score_quality: metadata.z_score_quality,

            // Volatility
            sentiment_volatility: metadata.sentiment_volatility,
            volatility_quality: metadata.volatility_quality,

            // Data Quality
            data_quality: metadata.data_quality,

            // Coverage metrics
            confidence_score: metadata.confidence_score || currentPoint.confidence,
            holdings_coverage: metadata.holdings_coverage || (data.valid_holdings / data.holdings_count),

            // Article count
            total_articles_analyzed: metadata.total_articles_analyzed || 0
          },
          metadata: aggregatedMetadata
        });

        setHoldingsSentiment(holdingsSentimentData);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Error fetching portfolio sentiment:', err);
          setError('Failed to load portfolio sentiment data');
          // BUG FIX: Clear stale data when fetch fails
          setSentimentData(null);
          setHoldingsSentiment([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchPortfolioSentiment();

    // Cleanup: abort fetch on unmount or dependency change
    return () => {
      controller.abort();
    };
  }, [username, accountName, holdings, timeframe, enabled]);

  return {
    sentimentData,
    holdingsSentiment,
    loading,
    error,
    failedHoldings: [], // No longer tracking individual failures
    successCount: sentimentData ? sentimentData.aggregate?.holdings_coverage * (holdings?.length || 0) : 0,
    totalCount: holdings ? holdings.length : 0
  };
};