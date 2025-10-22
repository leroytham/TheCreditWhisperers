// frontend/src/features/shared/components/RelatedNews.jsx

import React, { useState, useMemo } from 'react';
import NewsCard from './NewsCard';
import NewsSkeleton from './NewsSkeleton';
import NewsEmpty from './NewsEmpty';
import NewsError from './NewsError';
import NewsToolbar from './NewsToolbar';
import { ArrowRight } from 'lucide-react';

/**
 * A container for displaying a feed of related news articles.
 * Includes states for loading, error, and empty results.
 * Features filtering, sorting, and layout options for the full view,
 * and a compact view for overviews.
 *
 * @param {Object} props
 * @param {Array} props.news - Array of news articles
 * @param {string} props.displayName - Name of the entity/sector for context
 * @param {boolean} props.loading - Loading state
 * @param {string|null} props.error - Error message
 * @param {function(): void} props.handleRetry - Function to retry fetching data
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} [props.isOverview=false] - If true, shows a limited number of articles and a 'View more' button.
 * @param {function(): void} [props.onViewMore] - Callback function for the 'View more' button.
 */
const RelatedNews = ({
  news,
  displayName,
  loading,
  error,
  handleRetry,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6',
  isOverview = false,
  onViewMore,
}) => {
  const [filter, setFilter] = useState('');
  const [sortOption, setSortOption] = useState('date-desc');
  const [layout, setLayout] = useState('grid');
  
  const OVERVIEW_ARTICLE_LIMIT = 3;

  const newsToDisplay = useMemo(() => {
    if (!news) return [];

    let processedNews = [...news];

    // For the full news page, filter and sort
    if (!isOverview) {
      const filtered = processedNews.filter((article) =>
        article.title.toLowerCase().includes(filter.toLowerCase()) ||
        (article.provider && article.provider.toLowerCase().includes(filter.toLowerCase()))
      );

      return filtered.sort((a, b) => {
        switch (sortOption) {
          case 'date-asc':
            return new Date(a.publish_date) - new Date(b.publish_date);
          case 'sentiment-desc':
            return (b.sentiment_score ?? -Infinity) - (a.sentiment_score ?? -Infinity);
          case 'sentiment-asc':
            return (a.sentiment_score ?? Infinity) - (a.sentiment_score ?? Infinity);
          case 'date-desc':
          default:
            return new Date(b.publish_date) - new Date(a.publish_date);
        }
      });
    }

    // For overview, just take the most recent articles
    processedNews.sort((a, b) => new Date(b.publish_date) - new Date(a.publish_date));
    return processedNews.slice(0, OVERVIEW_ARTICLE_LIMIT);

  }, [news, filter, sortOption, isOverview]);

  const renderContent = () => {
    if (loading) {
      return <NewsSkeleton count={isOverview ? OVERVIEW_ARTICLE_LIMIT : 6} />;
    }
    if (error) {
      return <NewsError error={error} onRetry={handleRetry} />;
    }
    if (!newsToDisplay || newsToDisplay.length === 0) {
      return <NewsEmpty displayName={displayName} hasFilter={!isOverview && !!filter} />;
    }

    // Overview is always a list, news page can be grid or list
    const currentLayout = isOverview ? 'list' : layout;

    const layoutClasses = {
      list: 'space-y-3',
      grid: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4',
    };

    return (
      <div className={layoutClasses[currentLayout]}>
        {newsToDisplay.map((article, index) => (
          // Use unique combination of properties to avoid duplicate keys
          <NewsCard 
            key={`${index}-${article.title?.substring(0, 20) || ''}-${article.publish_date || ''}`} 
            {...article} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Related News</h3>
        {displayName && <span className="text-sm text-gray-500">{displayName}</span>}
      </div>

      {/* Toolbar for filtering and sorting (not on overview) */}
      {!isOverview && (
        <NewsToolbar
          onFilterChange={setFilter}
          onSortChange={setSortOption}
          onLayoutChange={setLayout}
          sortOption={sortOption}
          layoutOption={layout}
          resultCount={news?.length || 0}
        />
      )}

      {/* Scrollable container for news content (not on overview) */}
      <div className={!isOverview ? "max-h-[800px] overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" : ""}>
        {renderContent()}
      </div>
      
      {/* View More Button (only on overview) */}
      {isOverview && news && news.length > OVERVIEW_ARTICLE_LIMIT && (
        <div className="mt-6 text-right">
          <button 
            onClick={onViewMore}
            className="inline-flex items-center text-sm font-semibold text-gray-800 hover:text-blue-600 group"
          >
            View more
            <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}
    </div>
  );
};

export default RelatedNews;