/**
 * Sector PerformanceView Component Tests
 *
 * Basic rendering and prop tests for the Sector PerformanceView component.
 * Due to complex hook dependencies, tests focus on loading/error states
 * and basic tab rendering.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock all shared components
jest.mock('../../../../shared/components', () => ({
  PriceChart: () => <div data-testid="price-chart">PriceChart Mock</div>,
  CombinedSentimentVolumeChart: () => <div data-testid="sentiment-chart">SentimentChart Mock</div>,
  TimeRangeSelector: () => <div data-testid="time-selector">TimeSelector Mock</div>,
  ViewModeToggle: () => <div data-testid="view-toggle">ViewToggle Mock</div>,
  SignificantEvents: () => <div data-testid="significant-events">SignificantEvents Mock</div>,
  RelatedNews: () => <div data-testid="related-news">RelatedNews Mock</div>,
  DetailedRelatedNews: () => <div data-testid="detailed-news">DetailedNews Mock</div>,
  OverallSentiment: () => <div data-testid="overall-sentiment">OverallSentiment Mock</div>,
  SentimentScoreCard: () => <div data-testid="sentiment-score-card">SentimentScoreCard Mock</div>,
  MomentumCard: () => <div data-testid="momentum-card">MomentumCard Mock</div>,
  NewsCoverageCard: () => <div data-testid="coverage-card">CoverageCard Mock</div>,
  SentimentConfidenceCard: () => <div data-testid="confidence-card">ConfidenceCard Mock</div>,
  SentimentBreadthCard: () => <div data-testid="breadth-card">BreadthCard Mock</div>,
  SentimentShockCard: () => <div data-testid="shock-card">ShockCard Mock</div>,
  SourceConcentrationCard: () => <div data-testid="source-card">SourceCard Mock</div>,
  SentimentByTopicCard: () => <div data-testid="topic-card">TopicCard Mock</div>,
  TickerCoverageCard: () => <div data-testid="ticker-coverage-card">TickerCoverageCard Mock</div>,
}));

// Mock sector-specific utilities
jest.mock('../../../utils/tickerResolver', () => ({
  resolveSectorTicker: () => 'XLK',
}));

// Mock all hooks with default values
jest.mock('../../../hooks/useSectorData', () => ({
  useSectorData: jest.fn(() => ({
    priceData1Y: [],
    news: [],
    dailySentiment: {},
    topConstituents: [],
    topEvents: [],
    companyName: 'Technology Sector',
    currency: 'USD',
    loading: false,
    error: null,
    lastFetched: new Date(),
    sentiment: null,
    newsAggregationMetadata: null,
  })),
}));

jest.mock('../../../hooks/usePriceData', () => ({
  usePriceData: () => ({
    priceData: [],
    chartData: [],
    priceRange: { min: 0, max: 100 },
    priceChange: 2.5,
    priceChangePercent: 1.5,
    currentPrice: 150.5,
  }),
}));

jest.mock('../../../../entity/hooks/usePriceData', () => ({
  usePriceData: () => ({
    priceData1Y: [],
    prevClose: 148.5,
    exchange: 'NYSE',
  }),
}));

jest.mock('../../../../entity/hooks/useRollingSentiment', () => ({
  useRollingSentiment: () => ({
    data: [],
    hasData: false,
    sourceEarliestDates: null,
    loading: false,
  }),
}));

// Mock local components
jest.mock('../PerformanceHeader', () => ({
  __esModule: true,
  default: () => <div data-testid="performance-header">Header Mock</div>,
}));

jest.mock('../TopConstituents', () => ({
  __esModule: true,
  default: () => <div data-testid="top-constituents">TopConstituents Mock</div>,
}));

// Import after mocks
import PerformanceView from '../PerformanceView';
import { useSectorData } from '../../../hooks/useSectorData';

// =============================================================================
// TEST DATA
// =============================================================================

const createSectorContext = () => ({
  countryCode: 'US',
  countryName: 'United States',
  sector: {
    name: 'Technology',
    index: 'XLK',
    ticker: 'XLK',
    yfinanceKey: 'XLK',
    available: true,
  },
});

// =============================================================================
// TESTS
// =============================================================================

describe('Sector PerformanceView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading States', () => {
    it('shows loading spinner when data is loading', () => {
      (useSectorData as jest.Mock).mockReturnValue({
        priceData1Y: null,
        news: null,
        dailySentiment: {},
        topConstituents: [],
        topEvents: [],
        companyName: '',
        currency: 'USD',
        loading: true,
        error: null,
        lastFetched: null,
        sentiment: null,
        newsAggregationMetadata: null,
      });

      render(<PerformanceView context={createSectorContext()} />);

      expect(screen.getByText('Loading performance data...')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('shows error message when data fetch fails', () => {
      (useSectorData as jest.Mock).mockReturnValue({
        priceData1Y: null,
        news: null,
        dailySentiment: {},
        topConstituents: [],
        topEvents: [],
        companyName: '',
        currency: 'USD',
        loading: false,
        error: 'Failed to fetch sector data',
        lastFetched: null,
        sentiment: null,
        newsAggregationMetadata: null,
      });

      render(<PerformanceView context={createSectorContext()} />);

      expect(screen.getByText('Unable to Load Data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    });
  });

  describe('Tab Rendering', () => {
    beforeEach(() => {
      (useSectorData as jest.Mock).mockReturnValue({
        priceData1Y: [],
        news: [],
        dailySentiment: {},
        topConstituents: [],
        topEvents: [],
        companyName: 'Technology Sector',
        currency: 'USD',
        loading: false,
        error: null,
        lastFetched: new Date(),
        sentiment: null,
        newsAggregationMetadata: null,
      });
    });

    it('renders overview tab content by default', () => {
      render(<PerformanceView context={createSectorContext()} />);

      expect(screen.getByText('Current Price')).toBeInTheDocument();
      expect(screen.getByText('Price Performance')).toBeInTheDocument();
    });

    it('renders sentiment tab content', () => {
      render(<PerformanceView context={createSectorContext()} activeTab="sentiment" />);

      expect(screen.getByText('Sentiment Analysis')).toBeInTheDocument();
    });

    it('renders constituents tab content', () => {
      render(<PerformanceView context={createSectorContext()} activeTab="constituents" />);

      expect(screen.getByTestId('top-constituents')).toBeInTheDocument();
    });

    it('renders news tab content', () => {
      render(<PerformanceView context={createSectorContext()} activeTab="news" />);

      expect(screen.getByTestId('detailed-news')).toBeInTheDocument();
    });

    it('renders performance tab content', () => {
      render(<PerformanceView context={createSectorContext()} activeTab="performance" />);

      expect(screen.getByText('Detailed Performance Analysis')).toBeInTheDocument();
    });
  });

  describe('Context Handling', () => {
    beforeEach(() => {
      (useSectorData as jest.Mock).mockReturnValue({
        priceData1Y: [],
        news: [],
        dailySentiment: {},
        topConstituents: [],
        topEvents: [],
        companyName: 'Technology Sector',
        currency: 'USD',
        loading: false,
        error: null,
        lastFetched: new Date(),
        sentiment: null,
        newsAggregationMetadata: null,
      });
    });

    it('handles undefined context gracefully', () => {
      render(<PerformanceView context={undefined} />);

      expect(screen.getByText('Price Performance')).toBeInTheDocument();
    });

    it('handles null sector in context', () => {
      const context = { ...createSectorContext(), sector: null };
      render(<PerformanceView context={context} />);

      expect(screen.getByText('Price Performance')).toBeInTheDocument();
    });
  });
});
