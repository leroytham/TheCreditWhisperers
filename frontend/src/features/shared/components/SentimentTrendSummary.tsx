import React, { useState } from 'react';
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, Info } from 'lucide-react';

/**
 * SentimentTrendSummary Component
 *
 * Displays AI-generated sentiment insights and trend summary
 * Provides actionable intelligence about market sentiment
 *
 * @param {Object} props
 * @param {string} props.trend - Overall trend ('BULLISH' | 'BEARISH' | 'NEUTRAL')
 * @param {number} props.confidence - Confidence score (0-1)
 * @param {string} props.momentum - Momentum direction ('POSITIVE' | 'NEGATIVE' | 'STABLE')
 * @param {string} props.summary - One-line summary of sentiment
 * @param {Array<string>} props.keyPoints - Array of key insight bullet points
 * @param {string} props.dataSource - Source of analysis (e.g., '24h rolling data')
 * @param {string} props.className - Additional CSS classes
 */
const SentimentTrendSummary = ({
  trend = 'NEUTRAL',
  confidence = 0,
  momentum = 'STABLE',
  summary = 'Analyzing market sentiment...',
  keyPoints = [],
  dataSource = '24-hour rolling window',
  className = ''
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine colors based on trend
  const getTrendConfig = () => {
    switch (trend.toUpperCase()) {
      case 'BULLISH':
        return {
          bg: 'bg-green-50 border-green-200',
          headerBg: 'bg-green-100',
          headerText: 'text-green-900',
          badge: 'bg-green-500',
          icon: <TrendingUp className="w-5 h-5" />,
          label: 'Bullish Trend'
        };
      case 'BEARISH':
        return {
          bg: 'bg-red-50 border-red-200',
          headerBg: 'bg-red-100',
          headerText: 'text-red-900',
          badge: 'bg-red-500',
          icon: <TrendingDown className="w-5 h-5" />,
          label: 'Bearish Trend'
        };
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          headerBg: 'bg-gray-100',
          headerText: 'text-gray-900',
          badge: 'bg-gray-500',
          icon: <AlertCircle className="w-5 h-5" />,
          label: 'Neutral Trend'
        };
    }
  };

  const config = getTrendConfig();
  const confidencePercent = Math.round(confidence * 100);
  const isHighConfidence = confidence > 0.7;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow overflow-hidden flex flex-col h-[400px] ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              trend.toUpperCase() === 'BULLISH' ? 'bg-green-100 text-green-700' :
              trend.toUpperCase() === 'BEARISH' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {config.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{config.label}</h3>
                <div className="relative">
                  <Info 
                    className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  />
                  {showTooltip && (
                    <div className="absolute left-0 top-6 w-80 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 z-50">
                      <p className="font-semibold mb-2">AI Sentiment Analysis</p>
                      <p className="mb-2">Comprehensive trend summary generated from multiple sentiment indicators.</p>
                      <div className="bg-gray-800 p-2 rounded mb-2 space-y-1">
                        <p className="font-mono text-[10px]">• Analyzes overall sentiment score</p>
                        <p className="font-mono text-[10px]">• Evaluates momentum direction</p>
                        <p className="font-mono text-[10px]">• Considers distribution patterns</p>
                        <p className="font-mono text-[10px]">• Assesses volatility levels</p>
                      </div>
                      <p className="text-gray-300">Confidence score based on data consistency and volume.</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{dataSource}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-600">Confidence</p>
            <p className="text-2xl font-bold text-gray-900">{confidencePercent}%</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6 flex-1 overflow-y-auto">
        {/* Summary Text */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Summary</h4>
          <p className="text-gray-700 leading-relaxed">
            {summary}
          </p>
        </div>

        {/* Momentum Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">Momentum</p>
            <p className={`text-sm font-bold ${
              momentum === 'POSITIVE' ? 'text-green-600' :
              momentum === 'NEGATIVE' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {momentum}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">Reliability</p>
            <div className="flex items-center gap-2">
              {isHighConfidence ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-600" />
              )}
              <p className="text-sm font-bold text-gray-900">
                {isHighConfidence ? 'High' : 'Medium'}
              </p>
            </div>
          </div>
        </div>

        {/* Key Points */}
        {keyPoints.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Insights</h4>
            <ul className="space-y-2">
              {keyPoints.map((point, idx) => (
                <li key={idx} className="flex gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${config.badge}`}></div>
                  <span className="text-sm text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        {/* <div className="pt-4 border-t border-gray-100">
          <button className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
            View detailed analysis →
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default SentimentTrendSummary;
