/**
 * useNewsData Hook
 *
 * Custom hook for fetching news and sentiment data with momentum analysis
 */

import { useState, useEffect } from 'react';

export const useNewsData = (ticker, timeframe = '1Y') => {
  const [news, setNews] = useState([]);
  const [sentiment, setSentiment] = useState({});
  const [apiMetadata, setApiMetadata] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If ticker is null (lazy loading - tab not active), set loading to false immediately
    if (!ticker) {
      setLoading(false);
      return;
    }

    // Set loading immediately when ticker changes (before async fetch)
    setLoading(true);
    setError(null);

    const fetchNewsData = async () => {
      try {
        const response = await fetch(`/api/news?ticker=${ticker}&timeframe=${timeframe}`);
        const data = await response.json();

        // Store full feed data from Alpha Vantage
        setNews(data.feed || data.news || []);
        
        // Store API metadata
        setApiMetadata({
          items: data.items,
          sentiment_score_definition: data.sentiment_score_definition,
          relevance_score_definition: data.relevance_score_definition,
        });
        
        // Extract sentiment data with momentum fields
        setSentiment({ 
          avg_score: data.avg_score,
          // Momentum fields
          sentiment_momentum: data.sentiment_momentum,
          fast_score: data.fast_score,
          slow_score: data.slow_score,
          momentum_label: data.momentum_label,
          momentum_interpretation: data.momentum_interpretation,
          momentum_quality: data.momentum_quality,
          momentum_direction: data.momentum_direction,
          momentum_strength: data.momentum_strength,
          half_life_fast_hours: data.half_life_fast_hours,
          half_life_slow_hours: data.half_life_slow_hours,
          data_quality: data.data_quality,
          // Volatility fields
          sentiment_volatility: data.sentiment_volatility,
          volatility_quality: data.volatility_quality,
          // Effective news volume (quantity/coverage)
          effective_news_volume: data.effective_news_volume,
          volume_interpretation: data.volume_interpretation,
          // Breadth metrics (bull/bear ratio)
          sentiment_breadth_score: data.sentiment_breadth_score,
          num_bullish_articles: data.num_bullish_articles,
          num_bearish_articles: data.num_bearish_articles,
          total_directional_articles: data.total_directional_articles,
          breadth_interpretation: data.breadth_interpretation,
          breadth_quality: data.breadth_quality,
          // Z-Score metrics (sentiment shock)
          sentiment_z_score: data.sentiment_z_score,
          z_score_interpretation: data.z_score_interpretation,
          z_score_historical_mean: data.z_score_historical_mean,
          z_score_historical_std: data.z_score_historical_std,
          z_score_days_of_history: data.z_score_days_of_history,
          z_score_quality: data.z_score_quality,
          // Source & Topic Analysis metrics
          sourceConcentrationHhi: data.source_concentration_hhi,
          concentrationInterpretation: data.concentration_interpretation,
          topSources: data.top_sources || [],
          dominantTopic: data.dominant_topic,
          dominantTopicWeight: data.dominant_topic_weight,
          dominantTopicPercentage: data.dominant_topic_percentage,
          topicCount: data.topic_count || 0,
          sentimentByTopic: data.sentiment_by_topic || {},
          topicWeights: data.topic_weights || {}
        });
      } catch (err) {
        console.error('Error fetching news:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNewsData();
  }, [ticker, timeframe]);

  return {
    news,
    sentiment,
    apiMetadata,
    loading,
    error
  };
};
