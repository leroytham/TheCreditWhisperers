import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import TooltipPortal from './TooltipPortal';

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
 * @param {string} props.context - Context: 'entity' (default) or 'sector'
 */
const SentimentBreadthCard = ({
  sentimentBreadthScore,
  numBullishArticles = 0,
  numBearishArticles = 0,
  totalDirectionalArticles = 0,
  breadthInterpretation,
  breadthQuality,
  avgScore,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6',
  context = 'entity'
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
        <TooltipPortal>
          <p className="font-semibold mb-2">Sentiment Breadth</p>
          {context === 'entity' ? (
            <>
              <p className="mb-2">This metric measures the level of consensus among news articles by ignoring neutral opinions.</p>
              <p className="mb-2">It answers the question: <em>"Of the articles that have a clear opinion, what percentage are 'Bullish' versus 'Bearish'?"</em></p>
              <p className="font-semibold mb-1">How it's Calculated:</p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li>First, all "Neutral" articles (those with a sentiment score between -0.15 and +0.15) are filtered out.</li>
                <li>It then counts the remaining "Bullish" articles and "Bearish" articles.</li>
                <li>The final score is a ratio calculated as: <span className="font-mono text-[11px]">(Bullish - Bearish) / (Total Bullish + Bearish)</span></li>
                <li>This gives a score from <strong>-100% (100% Bears)</strong> to <strong>+100% (100% Bulls)</strong>.</li>
              </ul>
              <p className="font-semibold mb-1">Why it's Important:</p>
              <p className="mb-2">This is a powerful "second opinion" for the Overall Sentiment score. The Overall Sentiment is a weighted average, meaning one or two extremely negative articles can drag down the score, even if 20 other articles are only slightly positive.</p>
              <p className="mb-1">Breadth checks for consensus:</p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li><strong>High Score (e.g., &gt; +80%):</strong> Confirms that positive sentiment is widespread and not just an outlier. This is a high-conviction signal.</li>
                <li><strong>Low Score (e.g., near 0%):</strong> Signals a highly polarized debate (an equal number of bulls and bears).</li>
                <li><strong>Divergence:</strong> If Overall Sentiment is positive but Breadth is negative, it warns you that the majority of articles are actually bearish, but the average is being skewed by a few very strong bullish outliers.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="mb-2">This metric measures consensus across all sector news by counting directional articles.</p>
              <p className="mb-2">It answers: <em>"Across all companies in the sector, are more articles bullish or bearish?"</em></p>
              <p className="font-semibold mb-1">How it's Calculated:</p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li>All neutral articles (sentiment between -0.15 and +0.15) are filtered out.</li>
                <li>Counts remaining bullish and bearish articles across all sector companies.</li>
                <li>The ratio is: <span className="font-mono text-[11px]">(Bullish - Bearish) / (Total Directional)</span></li>
                <li>Ranges from <strong>-100% (All Bears)</strong> to <strong>+100% (All Bulls)</strong>.</li>
              </ul>
              <p className="font-semibold mb-1">Why it's Important for Sectors:</p>
              <p className="mb-2">Sector breadth reveals whether sentiment is concentrated in a few companies or widespread across the sector.</p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li><strong>High Positive Breadth:</strong> Bullish sentiment is sector-wide, not isolated to one or two stocks.</li>
                <li><strong>Low/Mixed Breadth:</strong> The sector is polarized—some companies face positive news while others face negative.</li>
                <li><strong>Divergence:</strong> If weighted sentiment is positive but breadth is negative, it means a few large companies are driving sentiment while most have negative news.</li>
              </ul>
            </>
          )}
        </TooltipPortal>
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
