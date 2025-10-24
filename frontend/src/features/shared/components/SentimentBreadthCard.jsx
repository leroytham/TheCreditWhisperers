import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * SentimentBreadthCard Component
 *
 * Displays sentiment breadth (bull/bear ratio) - a count-based metric that
 * ignores magnitude and simply counts directional articles
 *
 * @param {Object} props
 * @param {number} props.sentimentBreadthScore - Breadth score from -1.0 to +1.0
 * @param {number} props.numBullishArticles - Count of bullish articles (≥0.35)
 * @param {number} props.numBearishArticles - Count of bearish articles (≤-0.35)
 * @param {number} props.totalDirectionalArticles - Total directional articles
 * @param {string} props.breadthInterpretation - Human-readable interpretation
 * @param {string} props.breadthQuality - Quality indicator based on sample size
 * @param {number} props.avgScore - Overall weighted sentiment score (for comparison)
 * @param {string} props.className - Additional CSS classes
 */
const SentimentBreadthCard = ({
  sentimentBreadthScore,
  numBullishArticles = 0,
  numBearishArticles = 0,
  totalDirectionalArticles = 0,
  breadthInterpretation,
  breadthQuality,
  avgScore,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  // Determine if data is insufficient
  const isInsufficientData = breadthQuality === 'insufficient_sample' || totalDirectionalArticles === 0;
  const isLowConfidence = breadthQuality === 'low_confidence';

  // Get breadth details for display
  const getBreadthDetails = (score) => {
    if (score === null || score === undefined) {
      return { label: 'N/A', color: 'text-gray-400', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' };
    }
    if (score > 0.5) {
      return { label: 'Strong Bulls', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
    }
    if (score > 0.2) {
      return { label: 'Moderate Bulls', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
    }
    if (score >= -0.2) {
      return { label: 'Mixed', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
    }
    if (score >= -0.5) {
      return { label: 'Moderate Bears', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    }
    return { label: 'Strong Bears', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
  };

  const breadthDetails = getBreadthDetails(sentimentBreadthScore);

  // Format breadth score as percentage
  const formatBreadthPercentage = (score) => {
    if (score === null || score === undefined) return '--';
    const percentage = Math.abs(score * 100).toFixed(0);
    const sign = score > 0 ? '+' : score < 0 ? '-' : '';
    return `${sign}${percentage}%`;
  };

  // Generate comparison with weighted score
  const generateComparison = () => {
    if (!avgScore || !sentimentBreadthScore) return null;
    
    const avgDirection = avgScore > 0.15 ? 'bullish' : avgScore < -0.15 ? 'bearish' : 'neutral';
    const breadthDirection = sentimentBreadthScore > 0.2 ? 'bullish' : sentimentBreadthScore < -0.2 ? 'bearish' : 'mixed';
    
    if (avgDirection === 'bullish' && breadthDirection === 'bullish') {
      if (Math.abs(sentimentBreadthScore) > Math.abs(avgScore)) {
        return { text: 'Breadth confirms sentiment with many slightly positive articles', color: 'text-green-700' };
      }
      return { text: 'Both breadth and sentiment are aligned positively', color: 'text-green-600' };
    }
    
    if (avgDirection === 'bearish' && breadthDirection === 'bearish') {
      if (Math.abs(sentimentBreadthScore) > Math.abs(avgScore)) {
        return { text: 'Breadth confirms sentiment with many slightly negative articles', color: 'text-red-700' };
      }
      return { text: 'Both breadth and sentiment are aligned negatively', color: 'text-red-600' };
    }
    
    if (avgDirection === 'bullish' && breadthDirection !== 'bullish') {
      return { text: 'Caution: Positive sentiment driven by few strong articles', color: 'text-yellow-700' };
    }
    
    if (avgDirection === 'bearish' && breadthDirection !== 'bearish') {
      return { text: 'Caution: Negative sentiment driven by few strong articles', color: 'text-yellow-700' };
    }
    
    return { text: 'Mixed signals between breadth and weighted sentiment', color: 'text-gray-600' };
  };

  const comparison = generateComparison();

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Sentiment Breadth</h3>
        {/* Tooltip explaining breadth */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">Bull/Bear Ratio</p>
            <p className="mb-2">Counts how many articles are directionally bullish vs bearish, ignoring magnitude.</p>
            <p className="font-semibold mb-1">Why It Matters</p>
            <p>A score of +0.15 with +0.80 breadth means "many articles slightly positive" vs. "few articles very positive". This helps identify sentiment driven by consensus vs. outliers.</p>
          </div>
        </div>
      </div>

      {isInsufficientData ? (
        <div className="space-y-2">
          <div className="text-4xl font-bold text-gray-400">--</div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>No Data</strong>
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Insufficient directional articles for breadth calculation
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Breadth Score */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className={`text-4xl font-semibold ${breadthDetails.color}`}>
                {formatBreadthPercentage(sentimentBreadthScore)}
              </div>
              {sentimentBreadthScore > 0 ? (
                <TrendingUp className="w-8 h-8 text-green-600" />
              ) : sentimentBreadthScore < 0 ? (
                <TrendingDown className="w-8 h-8 text-red-600" />
              ) : null}
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${breadthDetails.borderColor} ${breadthDetails.bgColor} ${breadthDetails.color}`}>
              {breadthDetails.label}
            </span>
          </div>

          {/* Interpretation */}
          {breadthInterpretation && (
            <p className="text-sm text-gray-600">
              {breadthInterpretation}
            </p>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Bull vs Bear Count */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-600">Article Count Breakdown</div>
            
            {/* Bullish Articles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Bullish Articles</span>
              </div>
              <span className="text-lg font-bold text-green-600">{numBullishArticles}</span>
            </div>

            {/* Visual Bar */}
            {totalDirectionalArticles > 0 && (
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500" 
                  style={{ width: `${(numBullishArticles / totalDirectionalArticles) * 100}%` }}
                ></div>
              </div>
            )}

            {/* Bearish Articles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-600">Bearish Articles</span>
              </div>
              <span className="text-lg font-bold text-red-600">{numBearishArticles}</span>
            </div>

            {/* Visual Bar */}
            {totalDirectionalArticles > 0 && (
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500" 
                  style={{ width: `${(numBearishArticles / totalDirectionalArticles) * 100}%` }}
                ></div>
              </div>
            )}

            <div className="text-xs text-gray-500 text-center pt-2">
              Total: {totalDirectionalArticles} directional articles
            </div>
          </div>

          {/* Comparison with weighted score */}
          {comparison && (
            <>
              <div className="border-t border-gray-200"></div>
              <div className={`text-xs ${comparison.color} bg-opacity-10 rounded-md p-2`}>
                <strong>Insight:</strong> {comparison.text}
              </div>
            </>
          )}

          {/* Quality warning */}
          {isLowConfidence && (
            <div className="text-xs text-yellow-600 mt-1">
              ⚠ Low confidence - limited sample size
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentBreadthCard;
