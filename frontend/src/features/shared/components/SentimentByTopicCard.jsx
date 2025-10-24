import React, { useMemo } from 'react';
import { Tag, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * SentimentByTopicCard Component
 *
 * Displays dominant topic and sentiment breakdown by topic category
 * Shows weighted sentiment for each topic (e.g., technology, earnings, blockchain)
 *
 * @param {Object} props
 * @param {string} props.dominantTopic - Most prominent topic by weight
 * @param {number} props.dominantTopicWeight - Combined weight of dominant topic
 * @param {number} props.dominantTopicPercentage - Percentage of total weight
 * @param {number} props.topicCount - Total number of unique topics
 * @param {Object} props.sentimentByTopic - Object mapping topic to avg sentiment
 * @param {Object} props.topicWeights - Object mapping topic to total weight
 * @param {string} props.className - Additional CSS classes
 */
const SentimentByTopicCard = ({
  dominantTopic,
  dominantTopicWeight,
  dominantTopicPercentage,
  topicCount = 0,
  sentimentByTopic = {},
  topicWeights = {},
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  // Check if we have data
  const hasData = dominantTopic || (topicCount > 0 && Object.keys(sentimentByTopic).length > 0);

  // Sort topics by weight (descending)
  const sortedTopics = useMemo(() => {
    if (!sentimentByTopic || Object.keys(sentimentByTopic).length === 0) return [];
    
    return Object.entries(sentimentByTopic)
      .map(([topic, sentiment]) => ({
        topic: formatTopicName(topic),
        sentiment: sentiment,
        weight: topicWeights[topic] || 0,
        percentage: topicWeights[topic] 
          ? (topicWeights[topic] / Object.values(topicWeights).reduce((a, b) => a + b, 0)) * 100 
          : 0
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [sentimentByTopic, topicWeights]);

  // Format topic names (convert snake_case to Title Case)
  function formatTopicName(topic) {
    if (!topic) return 'Unknown';
    return topic
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Get sentiment details for a score
  const getSentimentDetails = (score) => {
    if (score === null || score === undefined) {
      return {
        label: 'Neutral',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: Minus
      };
    }

    if (score >= 0.35) {
      return {
        label: 'Bullish',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        icon: TrendingUp
      };
    }
    if (score > 0.15) {
      return {
        label: 'Somewhat Bullish',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: TrendingUp
      };
    }
    if (score >= -0.15) {
      return {
        label: 'Neutral',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: Minus
      };
    }
    if (score >= -0.35) {
      return {
        label: 'Somewhat Bearish',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: TrendingDown
      };
    }
    return {
      label: 'Bearish',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      icon: TrendingDown
    };
  };

  // Get color for topic bar based on percentage
  const getTopicBarColor = (percentage) => {
    if (percentage >= 40) return 'bg-purple-600'; // Dominant
    if (percentage >= 25) return 'bg-purple-500'; // Major
    if (percentage >= 15) return 'bg-purple-400'; // Moderate
    return 'bg-purple-300'; // Minor
  };

  // Format sentiment score
  const formatSentiment = (score) => {
    if (score === null || score === undefined) return '0.00';
    return score.toFixed(2);
  };

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Tag className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Sentiment by Topic</h3>
        </div>
        {/* Tooltip explaining topic analysis */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">Topic-Based Sentiment Analysis</p>
            <p className="mb-2">Shows sentiment breakdown by news topic categories (e.g., Technology, Earnings, Blockchain, IPO).</p>
            <p className="font-semibold mb-1">How It Works</p>
            <p className="mb-2">Each article is tagged with topics by Alpha Vantage. We calculate weighted average sentiment for each topic.</p>
            <p className="font-semibold mb-1">Why It Matters</p>
            <p>Identifies which topics are driving sentiment. For example, positive earnings news vs negative regulatory news.</p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="space-y-2">
          <div className="text-4xl font-bold text-gray-400">--</div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-sm text-gray-600">
              <strong>No Topic Data Available</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Topic analysis requires articles with topic tags from Alpha Vantage
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Dominant Topic */}
          {dominantTopic && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600">Dominant Topic</div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Tag className="w-6 h-6 text-purple-700" />
                    <span className="text-lg font-semibold text-purple-900">
                      {formatTopicName(dominantTopic)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-700">
                      {dominantTopicPercentage?.toFixed(1) || '--'}%
                    </div>
                    <div className="text-xs text-purple-600">of news weight</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Topic Count Summary */}
          {topicCount > 0 && (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <span className="text-sm text-gray-600">Total Topics Detected</span>
              <span className="text-xl font-bold text-gray-900">{topicCount}</span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Topic Breakdown */}
          {sortedTopics.length > 0 && (
            <div className="space-y-4">
              <div className="text-xs font-medium text-gray-600">
                Sentiment by Topic (sorted by weight)
              </div>

              {sortedTopics.map((topicData, index) => {
                const sentimentDetails = getSentimentDetails(topicData.sentiment);
                const SentimentIcon = sentimentDetails.icon;

                return (
                  <div key={index} className="space-y-2">
                    {/* Topic Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">
                          {topicData.topic}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({topicData.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <SentimentIcon className={`w-4 h-4 ${sentimentDetails.color}`} />
                        <span className={`text-sm font-semibold ${sentimentDetails.color}`}>
                          {formatSentiment(topicData.sentiment)}
                        </span>
                      </div>
                    </div>

                    {/* Weight bar */}
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getTopicBarColor(topicData.percentage)} transition-all duration-300`}
                        style={{ width: `${topicData.percentage}%` }}
                      ></div>
                    </div>

                    {/* Sentiment label */}
                    <div className="flex justify-end">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sentimentDetails.bgColor} ${sentimentDetails.color}`}>
                        {sentimentDetails.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="text-xs text-gray-500 text-center pt-2">
                Showing {sortedTopics.length} topic{sortedTopics.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Insights */}
          {sortedTopics.length > 0 && (
            <>
              <div className="border-t border-gray-200"></div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="text-xs text-blue-900">
                  <strong>💡 Topic Analysis:</strong>
                  {(() => {
                    const bullishTopics = sortedTopics.filter(t => t.sentiment >= 0.15);
                    const bearishTopics = sortedTopics.filter(t => t.sentiment <= -0.15);
                    
                    if (bullishTopics.length > bearishTopics.length) {
                      return ` Majority of topics (${bullishTopics.length}/${sortedTopics.length}) show positive sentiment. Market sentiment appears constructive.`;
                    }
                    if (bearishTopics.length > bullishTopics.length) {
                      return ` Majority of topics (${bearishTopics.length}/${sortedTopics.length}) show negative sentiment. Market concerns are broad-based.`;
                    }
                    return ` Topics show mixed sentiment (${bullishTopics.length} positive, ${bearishTopics.length} negative). Market is undecided.`;
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentByTopicCard;
