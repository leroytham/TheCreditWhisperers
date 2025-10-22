import { useState, useEffect } from 'react';
import { resolveNewsTicker } from '../utils/tickerResolver';

/**
 * Custom hook for fetching comprehensive sector data
 * Fetches price, news, constituents, sentiment, and significant events
 * @param {string} ticker - Ticker symbol for the sector
 * @param {string} timeframe - Timeframe for price data (default '1Y')
 * @returns {Object} Sector data and loading/error states
 */
export const useSectorData = (ticker, timeframe = '1Y') => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    priceData1Y: [],
    news: [],
    sentimentAvg: null,
    dailySentiment: {},
    topConstituents: [],
    topEvents: [],
    companyName: '',
    currency: 'USD',
    lastFetched: null
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

    const fetchPrice = fetch(`/api/price?ticker=${encodeURIComponent(ticker)}&timeframe=1Y`)
      .then(r => r.json());

    const fetchConstituents = fetch(`/api/sectors/${encodeURIComponent(ticker)}/top-constituents`)
      .then(r => r.json());

    const fetchNews = fetch(`/api/news?ticker=${encodeURIComponent(newsTicker)}`)
      .then(r => r.json());

    const fetchDailySentiment = fetch(`/api/daily-sentiment?ticker=${encodeURIComponent(newsTicker)}`)
      .then(r => r.json());

    const fetchAnalysis = fetch(`/api/stocks/${encodeURIComponent(newsTicker)}/significant-events`)
      .then(r => r.json());

    Promise.allSettled([fetchPrice, fetchNews, fetchConstituents, fetchDailySentiment, fetchAnalysis])
      .then(([priceRes, newsRes, constRes, dailySentimentRes, analysisRes]) => {
        if (!mounted) return;

        const newData = { ...data };

        // Process price data
        if (priceRes.status === 'fulfilled' && priceRes.value) {
          const p = priceRes.value;
          newData.priceData1Y = p.prices || [];
          newData.companyName = p.company_name || '';
          newData.currency = p.currency || 'USD';
          newData.lastFetched = p.last_fetched || null;
        } else {
          console.error('Price fetch failed', priceRes.reason || priceRes.value);
          setError(prev => prev ? prev + ' | price failed' : 'price failed');
        }

        // Process news data
        if (newsRes.status === 'fulfilled' && newsRes.value) {
          const n = newsRes.value;
          const raw = n.news || [];
          const normalized = raw.map(article => ({
            title: article.title || article.headline || article.headline_text || article.summary || '',
            link: article.link || article.url || article.href || article.source_link || article.source || '#',
            publish_date: article.publish_date || article.date || article.publishedAt || article.pub_date || '',
            provider: article.provider || article.source || article.source_name || '',
            sentiment_score: (article.sentiment_score ?? article.score ?? null),
            sentiment_label: article.sentiment_label || 'Neutral',  // Bullish/Bearish format from backend
            image: article.image || null,  // Article image for display
            relevance_score: article.relevance_score || null  // Relevance score if available
          }));
          newData.news = normalized;
          newData.sentimentAvg = n.avg_score ?? n.avgScore ?? null;
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
          newData.dailySentiment = dailySentimentRes.value.daily || {};
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
  }, [ticker]);

  // Poll only price data every 5 seconds
  useEffect(() => {
    if (!ticker) return;

    const pollPriceData = async () => {
      try {
        const response = await fetch(`/api/price?ticker=${encodeURIComponent(ticker)}&timeframe=1Y`);
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

    const intervalId = setInterval(pollPriceData, 5000);

    return () => clearInterval(intervalId);
  }, [ticker]);

  return {
    ...data,
    loading,
    error
  };
};
