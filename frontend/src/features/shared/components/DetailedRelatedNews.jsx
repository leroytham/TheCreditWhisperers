// frontend/src/features/shared/components/DetailedRelatedNews.jsx

import React, { useState, useMemo } from 'react';
import CompactNewsCard from './CompactNewsCard';
import NewsDetailModal from './NewsDetailModal';
import NewsSkeleton from './NewsSkeleton';
import NewsEmpty from './NewsEmpty';
import NewsError from './NewsError';
import { Search, SortAsc, Grid2x2, Grid3x3 } from 'lucide-react';

/**
 * Enhanced news feed component that displays all API data
 * with filtering, sorting, and comprehensive information display
 * Supports 3 and 5 column layouts with modal details
 */
const DetailedRelatedNews = ({
  news,
  displayName,
  ticker,
  loading,
  error,
  handleRetry,
  className = '',
  apiMetadata = {},
}) => {
  const [filter, setFilter] = useState('');
  const [sortOption, setSortOption] = useState('date-desc');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedSentiment, setSelectedSentiment] = useState('all');
  const [minRelevance, setMinRelevance] = useState(0); // Minimum ticker relevance score
  const [columnLayout, setColumnLayout] = useState(3); // 3 or 5 columns
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Extract unique topics and sentiment labels
  const { allTopics, sentimentLabels } = useMemo(() => {
    if (!news || news.length === 0) return { allTopics: [], sentimentLabels: [] };

    const topicsSet = new Set();
    const sentimentsSet = new Set();

    news.forEach(article => {
      if (article.topics) {
        article.topics.forEach(t => topicsSet.add(t.topic));
      }
      if (article.overall_sentiment_label) {
        sentimentsSet.add(article.overall_sentiment_label);
      }
    });

    return {
      allTopics: Array.from(topicsSet).sort(),
      sentimentLabels: Array.from(sentimentsSet).sort()
    };
  }, [news]);

  const newsToDisplay = useMemo(() => {
    if (!news) return [];

    let filtered = [...news];

    // Filter by search term
    if (filter) {
      filtered = filtered.filter((article) =>
        article.title?.toLowerCase().includes(filter.toLowerCase()) ||
        article.summary?.toLowerCase().includes(filter.toLowerCase()) ||
        article.source?.toLowerCase().includes(filter.toLowerCase())
      );
    }

    // Filter by topic
    if (selectedTopic !== 'all') {
      filtered = filtered.filter(article =>
        article.topics?.some(t => t.topic === selectedTopic)
      );
    }

    // Filter by sentiment
    if (selectedSentiment !== 'all') {
      filtered = filtered.filter(article =>
        article.overall_sentiment_label === selectedSentiment
      );
    }

    // Filter by ticker relevance
    if (minRelevance > 0 && ticker) {
      filtered = filtered.filter(article => {
        if (!article.ticker_sentiment || article.ticker_sentiment.length === 0) {
          return false;
        }
        // Find the ticker sentiment for the current ticker
        const tickerSent = article.ticker_sentiment.find(
          ts => ts.ticker?.toUpperCase() === ticker.toUpperCase()
        );
        // Only include if relevance score meets minimum threshold
        return tickerSent && parseFloat(tickerSent.relevance_score) >= minRelevance;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date-asc':
          return (a.time_published || '').localeCompare(b.time_published || '');
        case 'date-desc':
          return (b.time_published || '').localeCompare(a.time_published || '');
        case 'sentiment-desc':
          return (b.overall_sentiment_score || -Infinity) - (a.overall_sentiment_score || -Infinity);
        case 'sentiment-asc':
          return (a.overall_sentiment_score || Infinity) - (b.overall_sentiment_score || Infinity);
        case 'relevance-desc':
          // Sort by ticker relevance for the current ticker
          if (ticker) {
            const aTickerSent = a.ticker_sentiment?.find(ts => ts.ticker?.toUpperCase() === ticker.toUpperCase());
            const bTickerSent = b.ticker_sentiment?.find(ts => ts.ticker?.toUpperCase() === ticker.toUpperCase());
            const aRelevance = aTickerSent ? parseFloat(aTickerSent.relevance_score) : 0;
            const bRelevance = bTickerSent ? parseFloat(bTickerSent.relevance_score) : 0;
            return bRelevance - aRelevance;
          }
          return 0;
        case 'relevance-asc':
          if (ticker) {
            const aTickerSent = a.ticker_sentiment?.find(ts => ts.ticker?.toUpperCase() === ticker.toUpperCase());
            const bTickerSent = b.ticker_sentiment?.find(ts => ts.ticker?.toUpperCase() === ticker.toUpperCase());
            const aRelevance = aTickerSent ? parseFloat(aTickerSent.relevance_score) : 0;
            const bRelevance = bTickerSent ? parseFloat(bTickerSent.relevance_score) : 0;
            return aRelevance - bRelevance;
          }
          return 0;
        default:
          return 0;
      }
    });

    return filtered;
  }, [news, filter, selectedTopic, selectedSentiment, sortOption, minRelevance, ticker]);

  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedArticle(null), 300); // Clear after animation
  };

  const getColumnGridClass = () => {
    switch (columnLayout) {
      case 3:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 5:
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      default:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
  };

  const renderContent = () => {
    if (loading) {
      return <NewsSkeleton count={6} />;
    }
    if (error) {
      return <NewsError error={error} onRetry={handleRetry} />;
    }
    if (!newsToDisplay || newsToDisplay.length === 0) {
      return <NewsEmpty displayName={displayName} hasFilter={!!filter || selectedTopic !== 'all' || selectedSentiment !== 'all' || minRelevance > 0} />;
    }

    // Use compact cards in grid layout
    return (
      <div className={`grid ${getColumnGridClass()} gap-4`}>
        {newsToDisplay.map((article, index) => (
          <CompactNewsCard
            key={`${index}-${article.title?.substring(0, 20) || ''}-${article.time_published || ''}`}
            article={article}
            onClick={handleArticleClick}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Filters and Controls */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Topic Filter */}
          <div className="relative">
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Topics</option>
              {allTopics.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>

          {/* Sentiment Filter */}
          <div className="relative">
            <select
              value={selectedSentiment}
              onChange={(e) => setSelectedSentiment(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Sentiments</option>
              {sentimentLabels.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </div>

          {/* Ticker Relevance Filter */}
          <div className="relative">
            <select
              value={minRelevance}
              onChange={(e) => setMinRelevance(parseFloat(e.target.value))}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              title={ticker ? `Filter articles by relevance to ${ticker}` : 'Ticker relevance filter'}
            >
              <option value={0}>All Relevance</option>
              <option value={0.1}>Relevance ≥ 0.1</option>
              <option value={0.2}>Relevance ≥ 0.2</option>
              <option value={0.3}>Relevance ≥ 0.3</option>
              <option value={0.4}>Relevance ≥ 0.4</option>
              <option value={0.5}>Relevance ≥ 0.5</option>
              <option value={0.6}>Relevance ≥ 0.6</option>
              <option value={0.7}>Relevance ≥ 0.7</option>
              <option value={0.8}>Relevance ≥ 0.8</option>
              <option value={0.9}>Relevance ≥ 0.9</option>
            </select>
          </div>

          {/* Sort */}
          <div className="relative">
            <SortAsc className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="sentiment-desc">Most Bullish</option>
              <option value="sentiment-asc">Most Bearish</option>
              {ticker && <option value="relevance-desc">Most Relevant to {ticker}</option>}
              {ticker && <option value="relevance-asc">Least Relevant to {ticker}</option>}
            </select>
          </div>
        </div>

        {/* Layout Controls and Result Count */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {newsToDisplay.length} of {news?.length || 0} articles
          </div>

          {/* Column Layout Selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setColumnLayout(3)}
              className={`p-2 rounded transition-colors ${
                columnLayout === 3 
                  ? 'bg-white shadow-sm text-gray-900' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="3 Columns"
            >
              <Grid2x2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setColumnLayout(5)}
              className={`p-2 rounded transition-colors ${
                columnLayout === 5 
                  ? 'bg-white shadow-sm text-gray-900' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="5 Columns"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* News Feed */}
      <div className="max-h-[1200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {renderContent()}
      </div>

      {/* Modal */}
      <NewsDetailModal
        article={selectedArticle}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode="modal"
      />
    </div>
  );
};

export default DetailedRelatedNews;
