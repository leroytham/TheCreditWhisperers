import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

/**
 * SentimentMetricsCard Component
 *
 * Displays sentiment metrics in a responsive grid:
 * - When showOnlyAnalytics=false (default): Shows all 4 metrics (Overall, Momentum, Distribution, Volatility)
 * - When showOnlyAnalytics=true: Shows only 2 analytics metrics (Distribution, Volatility)
 *
 * @param {Object} props
 * @param {Object} props.overall - { label, value (0-1), color }
 * @param {Object} props.momentum - { value (%), trend ('up'|'down'|'stable'), period }
 * @param {Object} props.distribution - { bullish, somewhatBullish, neutral, somewhatBearish, bearish (all 0-100) }
 * @param {Object} props.volatility - { level ('Low'|'Medium'|'High'), score (0-10) }
 * @param {boolean} props.showOnlyAnalytics - If true, only show Distribution and Volatility cards
 * @param {string} props.className - Additional CSS classes
 */
type TooltipType = 'overall' | 'momentum' | 'distribution' | 'volatility' | null;
type TrendType = 'up' | 'down' | 'stable';
type ColorType = 'green' | 'red' | 'yellow' | 'gray' | 'blue';
type VolatilityLevel = 'Low' | 'Medium' | 'High';

interface SentimentMetricsCardProps {
  overall?: { label: string; value: number; color: ColorType };
  momentum?: { value: number; trend: TrendType; period: string };
  distribution?: { bullish: number; somewhatBullish: number; neutral: number; somewhatBearish: number; bearish: number };
  volatility?: { level: VolatilityLevel; score: number };
  showOnlyAnalytics?: boolean;
  className?: string;
}

const SentimentMetricsCard: React.FC<SentimentMetricsCardProps> = ({
  overall = { label: 'Neutral', value: 0, color: 'gray' },
  momentum = { value: 0, trend: 'stable', period: '7d' },
  distribution = { bullish: 20, somewhatBullish: 20, neutral: 20, somewhatBearish: 20, bearish: 20 },
  volatility = { level: 'Medium', score: 5 },
  showOnlyAnalytics = false,
  className = ''
}) => {
  const [showTooltip, setShowTooltip] = useState<TooltipType>(null);

  // Color mappings
  const sentimentColorMap = {
    green: 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200',
    red: 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200',
    yellow: 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200',
    gray: 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200',
    blue: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
  };

  const sentimentTextColorMap = {
    green: 'text-green-900',
    red: 'text-red-900',
    yellow: 'text-amber-900',
    gray: 'text-gray-900',
    blue: 'text-blue-900'
  };

  const volatilityColorMap = {
    'Low': { bg: 'bg-green-100', text: 'text-green-800', score: 'text-green-900' },
    'Medium': { bg: 'bg-amber-100', text: 'text-amber-800', score: 'text-amber-900' },
    'High': { bg: 'bg-red-100', text: 'text-red-800', score: 'text-red-900' }
  };

  const getTrendIcon = (trend: TrendType) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: TrendType, value: number) => {
    if (trend === 'up') return 'text-green-600 font-semibold';
    if (trend === 'down') return 'text-red-600 font-semibold';
    return 'text-gray-600';
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${showOnlyAnalytics ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-6 ${className}`}>
      {/* 1. Overall Sentiment Card - Only show if not analytics-only mode */}
      {!showOnlyAnalytics && (
        <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Overall Sentiment</p>
                <div className="relative">
                  <Info 
                    className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                    onMouseEnter={() => setShowTooltip('overall')}
                    onMouseLeave={() => setShowTooltip(null)}
                  />
                  {showTooltip === 'overall' && (
                    <div className="absolute right-0 top-6 w-72 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 z-50">
                      <p className="font-semibold mb-2">Overall Sentiment Score</p>
                      <p className="mb-2">Average sentiment across all analyzed news articles using FinBERT.</p>
                      <div className="bg-gray-800 p-2 rounded mb-2 font-mono text-[10px]">
                        <p>Score = Σ(sentiment_i) / n</p>
                        <p className="text-gray-400 mt-1">Current: {overall.value.toFixed(3)}</p>
                      </div>
                      <p className="text-gray-300">Range: -1.0 (bearish) to +1.0 (bullish)</p>
                    </div>
                  )}
                </div>
              </div>
              <p className={`text-3xl font-bold ${sentimentTextColorMap[overall.color]}`}>
                {overall.label}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    overall.color === 'green' ? 'bg-green-500' :
                    overall.color === 'red' ? 'bg-red-500' :
                    overall.color === 'yellow' ? 'bg-yellow-500' :
                    overall.color === 'blue' ? 'bg-blue-500' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${(overall.value + 1) * 50}%` }}
                ></div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <p className="text-xs text-gray-600">{(overall.value * 100).toFixed(1)}% confidence</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Momentum Card - Only show if not analytics-only mode */}
      {!showOnlyAnalytics && (
        <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Momentum</p>
              <div className="relative">
                <Info 
                  className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                  onMouseEnter={() => setShowTooltip('momentum')}
                  onMouseLeave={() => setShowTooltip(null)}
                />
                {showTooltip === 'momentum' && (
                  <div className="absolute right-0 top-6 w-72 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 z-50">
                    <p className="font-semibold mb-2">Sentiment Momentum</p>
                    <p className="mb-2">Percentage change in average sentiment over time.</p>
                    <div className="bg-gray-800 p-2 rounded mb-2 font-mono text-[10px]">
                      <p>Momentum = ((Recent_Avg - Old_Avg) / |Old_Avg|) × 100</p>
                      <p className="text-gray-400 mt-1">Current: {momentum.value >= 0 ? '+' : ''}{momentum.value}%</p>
                    </div>
                    <p className="text-gray-300">Compares recent {momentum.period} vs earlier period to show trend direction.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getTrendIcon(momentum.trend)}
              <div>
                <p className={`text-3xl font-bold ${getTrendColor(momentum.trend, momentum.value)}`}>
                  {momentum.trend === 'down' ? '-' : '+'}{Math.abs(momentum.value)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Last {momentum.period}</p>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <p className="text-xs text-gray-600">
                {momentum.trend === 'up' && 'Sentiment is improving'}
                {momentum.trend === 'down' && 'Sentiment is declining'}
                {momentum.trend === 'stable' && 'Sentiment is stable'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Distribution Card - Always shown */}
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Distribution</p>
            <div className="relative">
              <Info 
                className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                onMouseEnter={() => setShowTooltip('distribution')}
                onMouseLeave={() => setShowTooltip(null)}
              />
              {showTooltip === 'distribution' && (
                <div className="absolute right-0 top-6 w-80 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 z-50">
                  <p className="font-semibold mb-2">Sentiment Distribution</p>
                  <p className="mb-2">Percentage of articles in each sentiment category.</p>
                  <div className="bg-gray-800 p-2 rounded mb-2 font-mono text-[10px] space-y-1">
                    <p className="text-green-400">Bullish (≥0.35): {distribution.bullish}%</p>
                    <p className="text-green-300">Somewhat-Bullish (0.15-0.35): {distribution.somewhatBullish}%</p>
                    <p className="text-gray-300">Neutral (-0.15 to 0.15): {distribution.neutral}%</p>
                    <p className="text-orange-300">Somewhat-Bearish (-0.35 to -0.15): {distribution.somewhatBearish}%</p>
                    <p className="text-red-400">Bearish (&lt;-0.35): {distribution.bearish}%</p>
                  </div>
                  <p className="text-gray-300">Categories based on FinBERT score thresholds.</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Horizontal Stacked Bar Chart */}
          <div className="w-full h-8 flex rounded-lg overflow-hidden border border-gray-300">
            {distribution.bullish > 0 && (
              <div
                className="bg-green-600 flex items-center justify-center text-white text-xs font-bold transition-all hover:opacity-80"
                style={{ width: `${distribution.bullish}%` }}
                title={`Bullish: ${distribution.bullish}%`}
              >
                {distribution.bullish >= 8 && `${distribution.bullish}%`}
              </div>
            )}
            {distribution.somewhatBullish > 0 && (
              <div
                className="bg-green-400 flex items-center justify-center text-white text-xs font-bold transition-all hover:opacity-80"
                style={{ width: `${distribution.somewhatBullish}%` }}
                title={`Somewhat-Bullish: ${distribution.somewhatBullish}%`}
              >
                {distribution.somewhatBullish >= 8 && `${distribution.somewhatBullish}%`}
              </div>
            )}
            {distribution.neutral > 0 && (
              <div
                className="bg-gray-400 flex items-center justify-center text-white text-xs font-bold transition-all hover:opacity-80"
                style={{ width: `${distribution.neutral}%` }}
                title={`Neutral: ${distribution.neutral}%`}
              >
                {distribution.neutral >= 8 && `${distribution.neutral}%`}
              </div>
            )}
            {distribution.somewhatBearish > 0 && (
              <div
                className="bg-orange-400 flex items-center justify-center text-white text-xs font-bold transition-all hover:opacity-80"
                style={{ width: `${distribution.somewhatBearish}%` }}
                title={`Somewhat-Bearish: ${distribution.somewhatBearish}%`}
              >
                {distribution.somewhatBearish >= 8 && `${distribution.somewhatBearish}%`}
              </div>
            )}
            {distribution.bearish > 0 && (
              <div
                className="bg-red-600 flex items-center justify-center text-white text-xs font-bold transition-all hover:opacity-80"
                style={{ width: `${distribution.bearish}%` }}
                title={`Bearish: ${distribution.bearish}%`}
              >
                {distribution.bearish >= 8 && `${distribution.bearish}%`}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="space-y-1.5">
            {/* Bullish (x >= 0.35) */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              <span className="text-xs text-gray-700 flex-1">Bullish</span>
              <span className="text-xs font-bold text-gray-900">{distribution.bullish}%</span>
            </div>
            {/* Somewhat-Bullish (0.15 <= x < 0.35) */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span className="text-xs text-gray-700 flex-1">Somewhat-Bullish</span>
              <span className="text-xs font-bold text-gray-900">{distribution.somewhatBullish}%</span>
            </div>
            {/* Neutral (-0.15 <= x < 0.15) */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="text-xs text-gray-700 flex-1">Neutral</span>
              <span className="text-xs font-bold text-gray-900">{distribution.neutral}%</span>
            </div>
            {/* Somewhat-Bearish (-0.35 <= x < -0.15) */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-400"></div>
              <span className="text-xs text-gray-700 flex-1">Somewhat-Bearish</span>
              <span className="text-xs font-bold text-gray-900">{distribution.somewhatBearish}%</span>
            </div>
            {/* Bearish (x < -0.35) */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span className="text-xs text-gray-700 flex-1">Bearish</span>
              <span className="text-xs font-bold text-gray-900">{distribution.bearish}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Distribution Volatility Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Distribution Volatility</p>
            <div className="relative">
              <Info 
                className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                onMouseEnter={() => setShowTooltip('volatility')}
                onMouseLeave={() => setShowTooltip(null)}
              />
              {showTooltip === 'volatility' && (
                <div className="absolute right-0 top-6 w-72 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 z-50">
                  <p className="font-semibold mb-2">Distribution Volatility (Frontend Analytics)</p>
                  <p className="mb-2">Measures how much sentiment scores in the current view fluctuate. This is distinct from the weighted volatility shown in Overall Sentiment.</p>
                  <div className="bg-gray-800 p-2 rounded mb-2 font-mono text-[10px]">
                    <p>Volatility = σ × 5 (Standard Deviation × 5)</p>
                    <p className="text-gray-400 mt-1">Current: {volatility.score.toFixed(1)}/10 ({volatility.level})</p>
                  </div>
                  <p className="text-gray-300">Higher score = more unstable sentiment in current timeframe. Low (&lt;3), Medium (3-6), High (&gt;6).</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${volatilityColorMap[volatility.level].bg} ${volatilityColorMap[volatility.level].text}`}>
              {volatility.level}
            </div>
            <p className={`text-3xl font-bold mt-3 ${volatilityColorMap[volatility.level].score}`}>
              {volatility.score.toFixed(1)}/10
            </p>
          </div>
          <div className="border-t border-gray-200 pt-2">
            <p className="text-xs text-gray-600">
              {volatility.level === 'Low' && 'Sentiment is stable'}
              {volatility.level === 'Medium' && 'Mixed sentiment signals'}
              {volatility.level === 'High' && 'Rapidly changing sentiment'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentMetricsCard;
