// frontend/src/features/entity/components/EarningsTranscript/EarningsTranscript.jsx

import React, { useState, useMemo } from 'react';
import { useEarningsTranscript } from '../../hooks/useEarningsTranscript';
import EarningsCalendar from '../EarningsCalendar/EarningsCalendar';
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  FileText,
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react';

/**
 * EarningsTranscript Component
 * 
 * Displays earnings call transcript data with LLM-based sentiment analysis.
 * Features:
 * - Quarter selector dropdown
 * - Speaker segments with sentiment indicators
 * - Expandable/collapsible transcript segments
 * - Summary statistics
 * - Sentiment color coding
 */
const EarningsTranscript = ({ ticker, className = '' }) => {
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [expandedSegments, setExpandedSegments] = useState(new Set());
  const [showAllSegments, setShowAllSegments] = useState(false);

  const {
    transcript,
    transcriptData,
    availableQuarters,
    loading,
    error,
    statistics,
    getSentimentColor,
    getSentimentLabel
  } = useEarningsTranscript(ticker, selectedQuarter);

  // Auto-select most recent quarter when available
  React.useEffect(() => {
    if (availableQuarters.length > 0 && !selectedQuarter) {
      setSelectedQuarter(availableQuarters[0]);
    }
  }, [availableQuarters, selectedQuarter]);

  // Toggle segment expansion
  const toggleSegment = (index) => {
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSegments(newExpanded);
  };

  // Expand/collapse all
  const toggleAllSegments = () => {
    if (showAllSegments) {
      setExpandedSegments(new Set());
    } else {
      setExpandedSegments(new Set(transcript.map((_, idx) => idx)));
    }
    setShowAllSegments(!showAllSegments);
  };

  // Get sentiment icon
  const getSentimentIcon = (sentiment) => {
    const score = parseFloat(sentiment);
    if (score > 0.2) return <TrendingUp className="w-4 h-4" />;
    if (score < -0.2) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  // Get sentiment badge color
  const getSentimentBadgeColor = (sentiment) => {
    const score = parseFloat(sentiment);
    if (score >= 0.6) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 0.4) return 'bg-green-50 text-green-700 border-green-200';
    if (score >= 0.2) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (score >= -0.2) return 'bg-gray-100 text-gray-700 border-gray-200';
    if (score >= -0.4) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (score >= -0.6) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  // Truncate content for preview
  const getPreviewText = (content, maxWords = 50) => {
    const words = content.split(' ');
    if (words.length <= maxWords) return content;
    return words.slice(0, maxWords).join(' ') + '...';
  };

  // Group speakers by frequency for stats
  const speakerStats = useMemo(() => {
    if (!transcript || transcript.length === 0) return [];
    
    const speakers = {};
    transcript.forEach(segment => {
      const speaker = segment.speaker;
      if (!speakers[speaker]) {
        speakers[speaker] = {
          name: speaker,
          title: segment.title,
          segments: 0,
          totalWords: 0,
          avgSentiment: 0,
          sentiments: []
        };
      }
      speakers[speaker].segments += 1;
      speakers[speaker].totalWords += segment.word_count || 0;
      speakers[speaker].sentiments.push(parseFloat(segment.sentiment || 0));
    });

    // Calculate average sentiment for each speaker
    Object.values(speakers).forEach(speaker => {
      speaker.avgSentiment = (
        speaker.sentiments.reduce((sum, s) => sum + s, 0) / speaker.sentiments.length
      ).toFixed(2);
    });

    return Object.values(speakers).sort((a, b) => b.segments - a.segments);
  }, [transcript]);

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center py-12`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading earnings transcript...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isNonUSStock = ticker.includes('.') || ticker.length > 5;
    const isRecentQuarter = selectedQuarter && (
      selectedQuarter.includes('2025Q3') || 
      selectedQuarter.includes('2025Q4')
    );
    
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg p-6`}>
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">Error Loading Transcript</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            
            {isRecentQuarter && !isNonUSStock && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-900">
                  <strong>⏰ Timing Note:</strong> Earnings call transcripts typically become available 
                  2-4 weeks after the quarter ends.
                </p>
                <p className="text-xs text-yellow-700 mt-2">
                  For Q3 2025 (ended Sept 30), transcripts usually appear in late October or early November.
                  Try selecting an earlier quarter like 2025Q2 or 2024Q4.
                </p>
              </div>
            )}
            
            {isNonUSStock && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Earnings call transcripts are primarily available for US-listed companies.
                  International stocks may have limited or no coverage.
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Try US tickers like: IBM, AAPL, MSFT, GOOGL, TSLA, AMZN
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} space-y-6`}>
      {/* Upcoming Earnings Calendar */}
      <EarningsCalendar ticker={ticker} />

      {/* Header with Quarter Selector */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Earnings Call Transcript</h2>
            <p className="text-sm text-gray-600 mt-1">
              LLM-enriched sentiment analysis for {ticker}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Quarter</option>
              {availableQuarters.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Statistics Summary */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <Users className="w-5 h-5 text-gray-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{statistics.speakerCount}</div>
              <div className="text-xs text-gray-600">Speakers</div>
            </div>
            <div className="text-center">
              <FileText className="w-5 h-5 text-gray-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {statistics.totalWordCount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Total Words</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getSentimentColor(statistics.avgSentiment)}`}>
                {statistics.avgSentiment}
              </div>
              <div className="text-xs text-gray-600">Avg Sentiment</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{transcript.length}</div>
              <div className="text-xs text-gray-600">Segments</div>
            </div>
          </div>
        )}
      </div>

      {/* No transcript selected */}
      {!selectedQuarter && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Calendar className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <p className="text-blue-900 font-medium">Select a quarter to view the earnings call transcript</p>
          <p className="text-blue-700 text-sm mt-1">
            Choose from {availableQuarters.length} available quarters above
          </p>
        </div>
      )}

      {/* Transcript empty */}
      {selectedQuarter && transcript.length === 0 && !loading && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">No transcript available</p>
          <p className="text-gray-600 text-sm mt-1">
            Earnings call transcript for {ticker} - {selectedQuarter} is not available
          </p>
          {(ticker.includes('.') || ticker.length > 5) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md inline-block">
              <p className="text-sm text-blue-900">
                💡 Transcripts are primarily available for US-listed companies
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Try: IBM, AAPL, MSFT, GOOGL, TSLA
              </p>
            </div>
          )}
        </div>
      )}

      {/* Speaker Statistics */}
      {speakerStats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Speaker Statistics</h3>
          <div className="space-y-3">
            {speakerStats.map((speaker, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{speaker.name}</div>
                  <div className="text-xs text-gray-600">{speaker.title}</div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">{speaker.segments}</div>
                    <div className="text-xs text-gray-600">Segments</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {speaker.totalWords.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600">Words</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-semibold ${getSentimentColor(speaker.avgSentiment)}`}>
                      {speaker.avgSentiment}
                    </div>
                    <div className="text-xs text-gray-600">Sentiment</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcript Segments */}
      {transcript.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
            <button
              onClick={toggleAllSegments}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAllSegments ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {transcript.map((segment, idx) => {
              const isExpanded = expandedSegments.has(idx);
              const sentimentScore = parseFloat(segment.sentiment || 0);
              
              return (
                <div key={idx} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-semibold text-gray-900">{segment.speaker}</h4>
                        {segment.title && (
                          <span className="text-sm text-gray-600">• {segment.title}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className={`
                        flex items-center space-x-1 px-3 py-1 rounded-full border text-sm font-medium
                        ${getSentimentBadgeColor(segment.sentiment)}
                      `}>
                        {getSentimentIcon(segment.sentiment)}
                        <span>{sentimentScore.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => toggleSegment(idx)}
                        className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-gray-700 leading-relaxed">
                    {isExpanded ? (
                      <p>{segment.content}</p>
                    ) : (
                      <p className="text-gray-600">{getPreviewText(segment.content)}</p>
                    )}
                  </div>

                  {!isExpanded && segment.content.split(' ').length > 50 && (
                    <button
                      onClick={() => toggleSegment(idx)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
                    >
                      Read more
                    </button>
                  )}

                  <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                    <span>{segment.word_count} words</span>
                    <span>•</span>
                    <span className={getSentimentColor(segment.sentiment)}>
                      {getSentimentLabel(segment.sentiment)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EarningsTranscript;
