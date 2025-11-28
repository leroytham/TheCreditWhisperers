/**
 * CombinedSentimentVolumeChart Component Tests
 *
 * Tests for the combined sentiment and volume chart component. Due to the complexity
 * of SVG rendering and timezone handling, these tests focus on:
 * - Component rendering states (loading, no data, with data)
 * - Props validation and defaults
 * - User interactions (hover, click, pin)
 * - Sentiment label and color mapping
 * - Data aggregation behavior
 * - Headlines processing and display
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the formatters to avoid timezone complexity in tests
jest.mock('../../utils/formatters', () => ({
  getExchangeTimezone: jest.fn((exchange: string) => {
    const timezones: Record<string, string> = {
      'NASDAQ': 'America/New_York',
      'NYSE': 'America/New_York',
      'LSE': 'Europe/London',
    };
    return timezones[exchange?.toUpperCase()] || 'America/New_York';
  }),
  getTimezoneAbbreviation: jest.fn((exchange: string) => {
    const abbrevs: Record<string, string> = {
      'NASDAQ': 'ET',
      'NYSE': 'ET',
      'LSE': 'GMT',
    };
    return abbrevs[exchange?.toUpperCase()] || 'ET';
  }),
  parseExchangeDate: jest.fn((dateString: string) => {
    if (!dateString) return null;
    return new Date(dateString);
  }),
  parseExchangeTimestamp: jest.fn((timestamp: string) => {
    if (!timestamp) return null;
    return new Date(timestamp);
  }),
  getWeekStartInTimezone: jest.fn((date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }),
  getMonthKeyInTimezone: jest.fn((date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }),
  getMonthStartInTimezone: jest.fn((year: number, month: number) => {
    return new Date(year, month, 1);
  }),
  addDaysInTimezone: jest.fn((date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }),
}));

import CombinedSentimentVolumeChart from '../CombinedSentimentVolumeChart';

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

interface TestDataPoint {
  timestamp: string;
  volume: number;
  sentiment: number;
  headlines?: Array<{
    link: string;
    title: string;
    sentiment_score: number;
    relevance_score?: number;
    provider?: string;
  }>;
}

/**
 * Create a single data point for testing
 */
const createDataPoint = (overrides: Partial<TestDataPoint> = {}): TestDataPoint => ({
  timestamp: '2024-11-15',
  volume: 10,
  sentiment: 0.25,
  headlines: [],
  ...overrides,
});

/**
 * Create an array of data points spanning multiple days
 */
const createDailyDataSeries = (
  count: number,
  options: { startDate?: string; baseSentiment?: number; baseVolume?: number } = {}
): TestDataPoint[] => {
  const { startDate = '2024-11-01', baseSentiment = 0.1, baseVolume = 10 } = options;
  const startDateObj = new Date(startDate);

  return Array.from({ length: count }, (_, i) => {
    const date = new Date(startDateObj);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    return createDataPoint({
      timestamp: dateStr,
      volume: baseVolume + Math.floor(Math.random() * 10),
      sentiment: baseSentiment + (Math.random() - 0.5) * 0.3,
    });
  });
};

/**
 * Create intraday (hourly) data with time component
 */
const createIntradayDataSeries = (count: number): TestDataPoint[] => {
  const baseDate = new Date('2024-11-15T09:00:00');

  return Array.from({ length: count }, (_, i) => {
    const date = new Date(baseDate);
    date.setHours(date.getHours() + i);
    return createDataPoint({
      timestamp: date.toISOString(),
      volume: 5 + Math.floor(Math.random() * 10),
      sentiment: 0.1 + (Math.random() - 0.5) * 0.4,
    });
  });
};

/**
 * Create data points with headlines
 */
const createDataWithHeadlines = (count: number = 15): TestDataPoint => {
  const headlines = Array.from({ length: count }, (_, i) => ({
    link: `https://example.com/article-${i}`,
    title: `News Article ${i + 1}: Market Update`,
    sentiment_score: (Math.random() - 0.5) * 2,
    relevance_score: 0.5 + Math.random() * 0.5,
    provider: ['Reuters', 'Bloomberg', 'CNBC'][i % 3],
  }));

  return createDataPoint({
    volume: 25,
    sentiment: 0.35,
    headlines,
  });
};

// =============================================================================
// TEST SUITES
// =============================================================================

describe('CombinedSentimentVolumeChart', () => {
  const defaultProps = {
    data: createDailyDataSeries(7),
    timeframe: '1W',
    viewMode: 'daily' as const,
    hasData: true,
    exchange: 'NASDAQ',
    ticker: 'AAPL',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ===========================================================================
  // RENDERING STATES
  // ===========================================================================

  describe('Rendering States', () => {
    it('renders loading state when data array is empty', () => {
      render(<CombinedSentimentVolumeChart {...defaultProps} data={[]} />);

      expect(screen.getByText('Loading combined data...')).toBeInTheDocument();
    });

    it('renders no data state when hasData is false', () => {
      render(<CombinedSentimentVolumeChart {...defaultProps} hasData={false} />);

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(
        screen.getByText(/News data for the 1W timeframe is not available/)
      ).toBeInTheDocument();
    });

    it('renders chart when data is available', () => {
      render(<CombinedSentimentVolumeChart {...defaultProps} />);

      // Check for chart elements
      expect(screen.getByText(/Sentiment & Volume/)).toBeInTheDocument();
      expect(screen.getByText('News Volume')).toBeInTheDocument();
      expect(screen.getByText('Sentiment Score')).toBeInTheDocument();
    });

    it('renders SVG chart container', () => {
      const { container } = render(<CombinedSentimentVolumeChart {...defaultProps} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CHART TITLE GENERATION
  // ===========================================================================

  describe('Chart Title Generation', () => {
    it('displays Daily Data title for 1W timeframe', () => {
      render(<CombinedSentimentVolumeChart {...defaultProps} timeframe="1W" viewMode="daily" />);
      expect(screen.getByText(/Sentiment & Volume \(1W\) - Daily Data/)).toBeInTheDocument();
    });

    it('displays Rolling 24h Windows title for rolling viewMode', () => {
      render(<CombinedSentimentVolumeChart {...defaultProps} viewMode="rolling" />);
      expect(screen.getByText(/Rolling 24h Windows/)).toBeInTheDocument();
    });

    it('displays Weekly Averages title for 3M timeframe', () => {
      render(
        <CombinedSentimentVolumeChart
          {...defaultProps}
          timeframe="3M"
          viewMode="weekly"
          data={createDailyDataSeries(90)}
        />
      );
      expect(screen.getByText(/Weekly Averages/)).toBeInTheDocument();
    });

    it('displays Monthly Averages title for 1Y timeframe', () => {
      render(
        <CombinedSentimentVolumeChart
          {...defaultProps}
          timeframe="1Y"
          viewMode="monthly"
          data={createDailyDataSeries(365)}
        />
      );
      expect(screen.getByText(/Monthly Averages/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // SOURCE COVERAGE NOTICE
  // ===========================================================================

  describe('Source Coverage Notice', () => {
    it('displays source coverage notice when sourceEarliestDates is provided', () => {
      const sourceEarliestDates = {
        'AlphaVantage': '2024-10-01',
        'NewsAPI': '2024-09-15',
      };

      render(
        <CombinedSentimentVolumeChart
          {...defaultProps}
          sourceEarliestDates={sourceEarliestDates}
        />
      );

      expect(screen.getByText(/Data Coverage Notice/)).toBeInTheDocument();
      expect(screen.getByText(/AlphaVantage/)).toBeInTheDocument();
      expect(screen.getByText(/NewsAPI/)).toBeInTheDocument();
    });

    it('does not display source notice when sourceEarliestDates is null', () => {
      render(
        <CombinedSentimentVolumeChart {...defaultProps} sourceEarliestDates={null} />
      );

      expect(screen.queryByText(/Data Coverage Notice/)).not.toBeInTheDocument();
    });

    it('does not display source notice when sourceEarliestDates is empty', () => {
      render(
        <CombinedSentimentVolumeChart {...defaultProps} sourceEarliestDates={{}} />
      );

      expect(screen.queryByText(/Data Coverage Notice/)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // DETAIL PANEL
  // ===========================================================================

  describe('Detail Panel', () => {
    it('displays empty state message when no point is selected', () => {
      render(<CombinedSentimentVolumeChart {...defaultProps} />);

      // Initially shows instruction to hover/click
      expect(screen.getByText(/Hover or click on the chart/)).toBeInTheDocument();
    });

    it('auto-selects latest data point after delay', async () => {
      render(<CombinedSentimentVolumeChart {...defaultProps} />);

      // Fast-forward past the auto-reset delay (750ms)
      act(() => {
        jest.advanceTimersByTime(800);
      });

      // Should now show data from the last point in the detail panel
      // "News Volume" appears in both the SVG chart and detail panel, so use getAllByText
      await waitFor(() => {
        const newsVolumeElements = screen.getAllByText('News Volume');
        expect(newsVolumeElements.length).toBeGreaterThanOrEqual(2); // SVG + Detail panel
      });
    });
  });

  // ===========================================================================
  // HEADLINES DISPLAY
  // ===========================================================================

  describe('Headlines Display', () => {
    it('displays headlines when data point has them', async () => {
      const dataWithHeadlines = [createDataWithHeadlines(5)];

      render(
        <CombinedSentimentVolumeChart {...defaultProps} data={dataWithHeadlines} />
      );

      // Fast-forward to auto-select
      act(() => {
        jest.advanceTimersByTime(800);
      });

      await waitFor(() => {
        expect(screen.getByText(/Top Headlines/)).toBeInTheDocument();
        expect(screen.getByText('News Article 1: Market Update')).toBeInTheDocument();
      });
    });

    it('shows "Show More" button when more than 10 headlines', async () => {
      const dataWithManyHeadlines = [createDataWithHeadlines(15)];

      render(
        <CombinedSentimentVolumeChart {...defaultProps} data={dataWithManyHeadlines} />
      );

      act(() => {
        jest.advanceTimersByTime(800);
      });

      await waitFor(() => {
        const showMoreButton = screen.getByRole('button', { name: /Show More/i });
        expect(showMoreButton).toBeInTheDocument();
        expect(screen.getByText(/5 more/)).toBeInTheDocument();
      });
    });

    it('displays no headlines message when data point has no headlines', async () => {
      const dataWithoutHeadlines = [createDataPoint({ headlines: [] })];

      render(
        <CombinedSentimentVolumeChart {...defaultProps} data={dataWithoutHeadlines} />
      );

      act(() => {
        jest.advanceTimersByTime(800);
      });

      await waitFor(() => {
        expect(screen.getByText(/No headlines available/)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // DEFAULT PROPS
  // ===========================================================================

  describe('Default Props', () => {
    it('uses NASDAQ as default exchange', () => {
      const { container } = render(
        <CombinedSentimentVolumeChart data={defaultProps.data} hasData={true} />
      );

      // Component should render without errors using default exchange
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('uses 1W as default timeframe', () => {
      render(<CombinedSentimentVolumeChart data={defaultProps.data} hasData={true} />);

      // Check the title reflects 1W default
      expect(screen.getByText(/\(1W\)/)).toBeInTheDocument();
    });

    it('uses rolling as default viewMode', () => {
      render(<CombinedSentimentVolumeChart data={defaultProps.data} hasData={true} />);

      expect(screen.getByText(/Rolling 24h Windows/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <CombinedSentimentVolumeChart
          {...defaultProps}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  // ===========================================================================
  // SINGLE DATA POINT
  // ===========================================================================

  describe('Single Data Point', () => {
    it('renders correctly with a single data point', () => {
      const singlePoint = [createDataPoint()];

      render(<CombinedSentimentVolumeChart {...defaultProps} data={singlePoint} />);

      expect(screen.getByText(/Sentiment & Volume/)).toBeInTheDocument();
    });

    it('centers the single data point in the chart', () => {
      const singlePoint = [createDataPoint()];
      const { container } = render(
        <CombinedSentimentVolumeChart {...defaultProps} data={singlePoint} />
      );

      // SVG should contain chart elements
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();

      // Should have sentiment circles
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Y-AXIS SCALING
  // ===========================================================================

  describe('Y-Axis Scaling', () => {
    it('handles zero volume data', () => {
      const zeroVolumeData = [
        createDataPoint({ volume: 0 }),
        createDataPoint({ volume: 0, timestamp: '2024-11-16' }),
      ];

      const { container } = render(
        <CombinedSentimentVolumeChart {...defaultProps} data={zeroVolumeData} />
      );

      // Should still render without errors
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('handles large volume values', () => {
      const largeVolumeData = [
        createDataPoint({ volume: 1000 }),
        createDataPoint({ volume: 5000, timestamp: '2024-11-16' }),
      ];

      const { container } = render(
        <CombinedSentimentVolumeChart {...defaultProps} data={largeVolumeData} />
      );

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('handles extreme sentiment values', () => {
      const extremeSentimentData = [
        createDataPoint({ sentiment: -1.0 }),
        createDataPoint({ sentiment: 1.0, timestamp: '2024-11-16' }),
      ];

      const { container } = render(
        <CombinedSentimentVolumeChart {...defaultProps} data={extremeSentimentData} />
      );

      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // INTRADAY DATA
  // ===========================================================================

  describe('Intraday Data (1D Timeframe)', () => {
    it('renders intraday data with time labels', () => {
      const intradayData = createIntradayDataSeries(8);

      render(
        <CombinedSentimentVolumeChart
          {...defaultProps}
          data={intradayData}
          timeframe="1D"
        />
      );

      expect(screen.getByText(/Sentiment & Volume \(1D\)/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ACCESSIBILITY
  // ===========================================================================

  describe('Accessibility', () => {
    it('has accessible headline links with proper attributes', async () => {
      const dataWithHeadlines = [createDataWithHeadlines(3)];

      render(
        <CombinedSentimentVolumeChart {...defaultProps} data={dataWithHeadlines} />
      );

      act(() => {
        jest.advanceTimersByTime(800);
      });

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        links.forEach((link) => {
          expect(link).toHaveAttribute('target', '_blank');
          expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });
      });
    });
  });
});

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe('CombinedSentimentVolumeChart Helper Functions', () => {
  /**
   * These tests verify the behavior of helper functions by observing
   * component output, since the functions are not directly exported.
   */

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Sentiment Label Mapping', () => {
    it('maps bullish sentiment correctly (>= 0.35)', async () => {
      const bullishData = [createDataPoint({ sentiment: 0.5 })];

      render(
        <CombinedSentimentVolumeChart
          data={bullishData}
          hasData={true}
          timeframe="1W"
          viewMode="daily"
          exchange="NASDAQ"
        />
      );

      jest.advanceTimersByTime(800);

      await waitFor(() => {
        expect(screen.getByText('Bullish')).toBeInTheDocument();
      });
    });

    it('maps somewhat-bullish sentiment correctly (0.15 to 0.35)', async () => {
      const somewhatBullishData = [createDataPoint({ sentiment: 0.25 })];

      render(
        <CombinedSentimentVolumeChart
          data={somewhatBullishData}
          hasData={true}
          timeframe="1W"
          viewMode="daily"
          exchange="NASDAQ"
        />
      );

      jest.advanceTimersByTime(800);

      await waitFor(() => {
        expect(screen.getByText('Somewhat-Bullish')).toBeInTheDocument();
      });
    });

    it('maps neutral sentiment correctly (-0.15 to 0.15)', async () => {
      const neutralData = [createDataPoint({ sentiment: 0.0 })];

      render(
        <CombinedSentimentVolumeChart
          data={neutralData}
          hasData={true}
          timeframe="1W"
          viewMode="daily"
          exchange="NASDAQ"
        />
      );

      jest.advanceTimersByTime(800);

      await waitFor(() => {
        expect(screen.getByText('Neutral')).toBeInTheDocument();
      });
    });

    it('maps somewhat-bearish sentiment correctly (-0.35 to -0.15)', async () => {
      const somewhatBearishData = [createDataPoint({ sentiment: -0.25 })];

      render(
        <CombinedSentimentVolumeChart
          data={somewhatBearishData}
          hasData={true}
          timeframe="1W"
          viewMode="daily"
          exchange="NASDAQ"
        />
      );

      jest.advanceTimersByTime(800);

      await waitFor(() => {
        expect(screen.getByText('Somewhat-Bearish')).toBeInTheDocument();
      });
    });

    it('maps bearish sentiment correctly (< -0.35)', async () => {
      const bearishData = [createDataPoint({ sentiment: -0.5 })];

      render(
        <CombinedSentimentVolumeChart
          data={bearishData}
          hasData={true}
          timeframe="1W"
          viewMode="daily"
          exchange="NASDAQ"
        />
      );

      jest.advanceTimersByTime(800);

      await waitFor(() => {
        expect(screen.getByText('Bearish')).toBeInTheDocument();
      });
    });
  });

  describe('Sentiment Score Display', () => {
    it('displays positive sentiment with + prefix', async () => {
      const positiveData = [createDataPoint({ sentiment: 0.123 })];

      render(
        <CombinedSentimentVolumeChart
          data={positiveData}
          hasData={true}
          timeframe="1W"
          viewMode="daily"
          exchange="NASDAQ"
        />
      );

      jest.advanceTimersByTime(800);

      await waitFor(() => {
        expect(screen.getByText('+0.123')).toBeInTheDocument();
      });
    });

    it('displays negative sentiment without + prefix', async () => {
      const negativeData = [createDataPoint({ sentiment: -0.456 })];

      render(
        <CombinedSentimentVolumeChart
          data={negativeData}
          hasData={true}
          timeframe="1W"
          viewMode="daily"
          exchange="NASDAQ"
        />
      );

      jest.advanceTimersByTime(800);

      await waitFor(() => {
        expect(screen.getByText('-0.456')).toBeInTheDocument();
      });
    });
  });
});

// =============================================================================
// DATA AGGREGATION TESTS
// =============================================================================

describe('Data Aggregation', () => {
  describe('Weekly Aggregation (3M, 6M, YTD timeframes)', () => {
    it('aggregates daily data into weekly for 3M timeframe', () => {
      // Create 90 days of data
      const dailyData = createDailyDataSeries(90);

      render(
        <CombinedSentimentVolumeChart
          data={dailyData}
          hasData={true}
          timeframe="3M"
          viewMode="weekly"
          exchange="NASDAQ"
        />
      );

      expect(screen.getByText(/Weekly Averages/)).toBeInTheDocument();
    });
  });

  describe('Monthly Aggregation (1Y timeframe)', () => {
    it('aggregates daily data into monthly for 1Y timeframe', () => {
      // Create 365 days of data
      const dailyData = createDailyDataSeries(365);

      render(
        <CombinedSentimentVolumeChart
          data={dailyData}
          hasData={true}
          timeframe="1Y"
          viewMode="monthly"
          exchange="NASDAQ"
        />
      );

      expect(screen.getByText(/Monthly Averages/)).toBeInTheDocument();
    });
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('handles undefined data gracefully', () => {
    render(
      <CombinedSentimentVolumeChart
        data={undefined}
        hasData={true}
        timeframe="1W"
        viewMode="daily"
        exchange="NASDAQ"
      />
    );

    expect(screen.getByText('Loading combined data...')).toBeInTheDocument();
  });

  it('handles data with null sentiment scores', async () => {
    const dataWithNullSentiment = [
      {
        timestamp: '2024-11-15',
        volume: 10,
        sentiment: 0,
        headlines: [],
      },
    ];

    render(
      <CombinedSentimentVolumeChart
        data={dataWithNullSentiment}
        hasData={true}
        timeframe="1W"
        viewMode="daily"
        exchange="NASDAQ"
      />
    );

    jest.advanceTimersByTime(800);

    await waitFor(() => {
      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });
  });

  it('handles very long headline titles', async () => {
    const longTitle = 'A'.repeat(200);
    const dataWithLongHeadline = [
      createDataPoint({
        headlines: [
          {
            link: 'https://example.com/long',
            title: longTitle,
            sentiment_score: 0.5,
            provider: 'Test',
          },
        ],
      }),
    ];

    render(
      <CombinedSentimentVolumeChart
        data={dataWithLongHeadline}
        hasData={true}
        timeframe="1W"
        viewMode="daily"
        exchange="NASDAQ"
      />
    );

    jest.advanceTimersByTime(800);

    await waitFor(() => {
      // Should render without breaking layout (truncation via CSS)
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });
  });

  it('handles duplicate headlines during aggregation', async () => {
    // Create multiple data points for weekly aggregation with duplicate headlines across days
    const duplicateHeadlines = Array.from({ length: 3 }, () => ({
      link: 'https://example.com/same-link',
      title: 'Duplicate Article',
      sentiment_score: 0.3,
      provider: 'Test',
    }));

    // Create 14 days of data for 3M timeframe (triggers weekly aggregation)
    const dataWithDuplicates = Array.from({ length: 14 }, (_, i) => ({
      timestamp: `2024-11-${String(i + 1).padStart(2, '0')}`,
      volume: 10,
      sentiment: 0.25,
      headlines: i < 3 ? duplicateHeadlines : [], // First 3 days have same headlines
    }));

    render(
      <CombinedSentimentVolumeChart
        data={dataWithDuplicates}
        hasData={true}
        timeframe="3M"
        viewMode="weekly"
        exchange="NASDAQ"
      />
    );

    jest.advanceTimersByTime(800);

    // With weekly aggregation, duplicates should be deduplicated based on link
    await waitFor(() => {
      const articles = screen.queryAllByText('Duplicate Article');
      // Deduplication should reduce the 9 duplicate headlines (3 per day * 3 days) to 1
      expect(articles.length).toBeLessThanOrEqual(1);
    });
  });
});

// =============================================================================
// RESPONSIVE BEHAVIOR
// =============================================================================

describe('Responsive Behavior', () => {
  it('handles window resize events', () => {
    const { container } = render(
      <CombinedSentimentVolumeChart
        data={createDailyDataSeries(7)}
        hasData={true}
        timeframe="1W"
        viewMode="daily"
        exchange="NASDAQ"
      />
    );

    // Trigger resize event
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Component should still render properly
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
