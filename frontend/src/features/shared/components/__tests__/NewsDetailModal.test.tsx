/**
 * NewsDetailModal Component Tests
 *
 * Tests for the news detail modal/slideover component including:
 * - Modal and slideover rendering modes
 * - Article data display (title, summary, sentiment, topics)
 * - Sentiment color mapping
 * - User interactions (close, backdrop click)
 * - Body overflow management
 * - Edge cases (missing data, invalid scores)
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewsDetailModal from '../NewsDetailModal';

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

interface TestArticle {
  title?: string;
  source?: string;
  time_published?: string;
  url?: string;
  link?: string;
  banner_image?: string;
  image?: string;
  summary?: string;
  overall_sentiment_score?: number;
  overall_sentiment_label?: string;
  relevance_score?: number;
  category_within_source?: string;
  source_domain?: string;
  authors?: string[];
  ticker_sentiment?: Array<{
    ticker: string;
    ticker_sentiment_score?: number | string;
    ticker_sentiment_label?: string;
    relevance_score?: number | string;
  }>;
  topics?: Array<string | { topic: string; relevance_score?: number | string }>;
}

/**
 * Create a complete article for testing
 */
const createArticle = (overrides: Partial<TestArticle> = {}): TestArticle => ({
  title: 'Tech Giant Reports Record Earnings',
  source: 'Bloomberg',
  time_published: '20241115T143000',
  url: 'https://example.com/article',
  summary: 'Tech company reported quarterly earnings that exceeded analyst expectations.',
  overall_sentiment_score: 0.45,
  overall_sentiment_label: 'Bullish',
  category_within_source: 'Technology',
  source_domain: 'bloomberg.com',
  authors: ['John Doe', 'Jane Smith'],
  ...overrides,
});

/**
 * Create an article with ticker sentiments
 */
const createArticleWithTickers = (): TestArticle => ({
  ...createArticle(),
  ticker_sentiment: [
    {
      ticker: 'AAPL',
      ticker_sentiment_score: 0.42,
      ticker_sentiment_label: 'Bullish',
      relevance_score: 0.85,
    },
    {
      ticker: 'MSFT',
      ticker_sentiment_score: -0.25,
      ticker_sentiment_label: 'Somewhat-Bearish',
      relevance_score: 0.45,
    },
    {
      ticker: 'GOOGL',
      ticker_sentiment_score: 0.1,
      ticker_sentiment_label: 'Neutral',
      relevance_score: 0.3,
    },
  ],
});

/**
 * Create an article with topics
 */
const createArticleWithTopics = (): TestArticle => ({
  ...createArticle(),
  topics: [
    { topic: 'Technology', relevance_score: 0.95 },
    { topic: 'Finance', relevance_score: 0.72 },
    { topic: 'Earnings', relevance_score: 0.55 },
  ],
});

/**
 * Create an article with string topics (alternative format)
 */
const createArticleWithStringTopics = (): TestArticle => ({
  ...createArticle(),
  topics: ['Technology', 'Finance', 'Earnings'],
});

// =============================================================================
// TEST SUITES
// =============================================================================

describe('NewsDetailModal', () => {
  const defaultProps = {
    article: createArticle(),
    isOpen: true,
    onClose: jest.fn(),
    mode: 'modal' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(<NewsDetailModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders nothing when article is null', () => {
      render(<NewsDetailModal {...defaultProps} article={null} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true and article is provided', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Tech Giant Reports Record Earnings')).toBeInTheDocument();
    });

    it('renders in modal mode by default', () => {
      render(<NewsDetailModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('renders in slideover mode when specified', () => {
      render(<NewsDetailModal {...defaultProps} mode="slideover" />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'slide-over-title');
    });
  });

  // ===========================================================================
  // ARTICLE CONTENT
  // ===========================================================================

  describe('Article Content', () => {
    it('displays article title', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByText('Tech Giant Reports Record Earnings')).toBeInTheDocument();
    });

    it('displays article source', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByText('Bloomberg')).toBeInTheDocument();
    });

    it('displays formatted publish time', () => {
      render(<NewsDetailModal {...defaultProps} />);

      // The component formats "20241115T143000" to a readable format
      // Should display something like "Nov 15, 2024, 2:30 PM"
      const timeElement = screen.getByRole('time');
      expect(timeElement).toBeInTheDocument();
    });

    it('displays article summary', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByText(/exceeded analyst expectations/)).toBeInTheDocument();
    });

    it('displays "no summary" message when summary is missing', () => {
      render(
        <NewsDetailModal
          {...defaultProps}
          article={createArticle({ summary: undefined })}
        />
      );

      expect(screen.getByText(/No summary available/)).toBeInTheDocument();
    });

    it('displays category within source', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByText('Technology')).toBeInTheDocument();
    });

    it('displays source domain', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByText('bloomberg.com')).toBeInTheDocument();
    });

    it('displays authors (excluding URLs)', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByText(/By: John Doe, Jane Smith/)).toBeInTheDocument();
    });

    it('filters out author URLs from display', () => {
      const articleWithUrlAuthor = createArticle({
        authors: ['John Doe', 'https://example.com/author'],
      });

      render(<NewsDetailModal {...defaultProps} article={articleWithUrlAuthor} />);

      expect(screen.getByText(/By: John Doe/)).toBeInTheDocument();
      expect(screen.queryByText(/https:/)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // READ FULL ARTICLE LINK
  // ===========================================================================

  describe('Read Full Article Link', () => {
    it('displays read full article button with url', () => {
      render(<NewsDetailModal {...defaultProps} />);

      const link = screen.getByRole('link', { name: /Read Full Article/i });
      expect(link).toHaveAttribute('href', 'https://example.com/article');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('uses link property when url is not available', () => {
      const articleWithLink = createArticle({ url: undefined, link: 'https://alt.example.com/article' });

      render(<NewsDetailModal {...defaultProps} article={articleWithLink} />);

      const link = screen.getByRole('link', { name: /Read Full Article/i });
      expect(link).toHaveAttribute('href', 'https://alt.example.com/article');
    });

    it('does not display read button when no url or link', () => {
      const articleWithoutUrl = createArticle({ url: undefined, link: undefined });

      render(<NewsDetailModal {...defaultProps} article={articleWithoutUrl} />);

      expect(screen.queryByRole('link', { name: /Read Full Article/i })).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // SENTIMENT DISPLAY
  // ===========================================================================

  describe('Sentiment Display', () => {
    it('displays overall sentiment label', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getAllByText('Bullish').length).toBeGreaterThan(0);
    });

    it('displays overall sentiment score', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByText('0.450')).toBeInTheDocument();
    });

    it('displays quick insights section', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByText('Quick Insights')).toBeInTheDocument();
    });

    it('applies correct color class for bullish sentiment (>= 0.35)', () => {
      const bullishArticle = createArticle({
        overall_sentiment_score: 0.5,
        overall_sentiment_label: 'Bullish',
      });

      render(<NewsDetailModal {...defaultProps} article={bullishArticle} />);

      const sentimentBadge = screen.getAllByText('Bullish')[0];
      expect(sentimentBadge.className).toContain('green');
    });

    it('applies correct color class for neutral sentiment (-0.15 to 0.15)', () => {
      const neutralArticle = createArticle({
        overall_sentiment_score: 0.0,
        overall_sentiment_label: 'Neutral',
      });

      render(<NewsDetailModal {...defaultProps} article={neutralArticle} />);

      const sentimentBadge = screen.getAllByText('Neutral')[0];
      expect(sentimentBadge.className).toContain('gray');
    });

    it('applies correct color class for bearish sentiment (< -0.35)', () => {
      const bearishArticle = createArticle({
        overall_sentiment_score: -0.5,
        overall_sentiment_label: 'Bearish',
      });

      render(<NewsDetailModal {...defaultProps} article={bearishArticle} />);

      const sentimentBadge = screen.getAllByText('Bearish')[0];
      expect(sentimentBadge.className).toContain('red');
    });
  });

  // ===========================================================================
  // TICKER SENTIMENTS
  // ===========================================================================

  describe('Ticker Sentiments', () => {
    it('displays ticker sentiment table', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTickers()} />
      );

      expect(screen.getByText('Ticker-Specific Sentiment')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('displays all ticker rows', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTickers()} />
      );

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('MSFT')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('displays ticker sentiment scores', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTickers()} />
      );

      expect(screen.getByText('0.420')).toBeInTheDocument();
      expect(screen.getByText('-0.250')).toBeInTheDocument();
    });

    it('displays ticker relevance percentages', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTickers()} />
      );

      expect(screen.getByText('85.0%')).toBeInTheDocument();
      expect(screen.getByText('45.0%')).toBeInTheDocument();
    });

    it('displays tickers mentioned count in quick insights', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTickers()} />
      );

      expect(screen.getByText('3 tickers')).toBeInTheDocument();
    });

    it('displays singular "ticker" for one mention', () => {
      const singleTickerArticle = {
        ...createArticle(),
        ticker_sentiment: [
          {
            ticker: 'AAPL',
            ticker_sentiment_score: 0.42,
            ticker_sentiment_label: 'Bullish',
            relevance_score: 0.85,
          },
        ],
      };

      render(<NewsDetailModal {...defaultProps} article={singleTickerArticle} />);

      expect(screen.getByText('1 ticker')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // TOPICS
  // ===========================================================================

  describe('Topics Display', () => {
    it('displays topics section with object topics', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTopics()} />
      );

      expect(screen.getByText('Topics & Relevance')).toBeInTheDocument();
    });

    it('displays topic names from object format', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTopics()} />
      );

      // Note: "Technology" also appears in category_within_source
      expect(screen.getAllByText('Technology').length).toBeGreaterThan(0);
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Earnings')).toBeInTheDocument();
    });

    it('displays topic relevance percentages', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTopics()} />
      );

      expect(screen.getByText('95.0%')).toBeInTheDocument();
      expect(screen.getByText('72.0%')).toBeInTheDocument();
    });

    it('displays main topic in quick insights', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithTopics()} />
      );

      expect(screen.getByText('Main Topic')).toBeInTheDocument();
    });

    it('handles string topics format', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithStringTopics()} />
      );

      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Earnings')).toBeInTheDocument();
    });

    it('displays N/A for topics without relevance score', () => {
      render(
        <NewsDetailModal {...defaultProps} article={createArticleWithStringTopics()} />
      );

      // String topics don't have relevance scores
      expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // USER INTERACTIONS
  // ===========================================================================

  describe('User Interactions', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      render(<NewsDetailModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked in modal mode', async () => {
      const onClose = jest.fn();
      const { container } = render(
        <NewsDetailModal {...defaultProps} onClose={onClose} />
      );

      // Find and click the backdrop
      const backdrop = container.querySelector('.bg-gray-500');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked in slideover mode', async () => {
      const onClose = jest.fn();
      const { container } = render(
        <NewsDetailModal {...defaultProps} onClose={onClose} mode="slideover" />
      );

      const backdrop = container.querySelector('.bg-gray-500');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal content', async () => {
      const onClose = jest.fn();
      render(<NewsDetailModal {...defaultProps} onClose={onClose} />);

      // Click on the title inside the modal
      await userEvent.click(screen.getByText('Tech Giant Reports Record Earnings'));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // BODY OVERFLOW MANAGEMENT
  // ===========================================================================

  describe('Body Overflow Management', () => {
    it('sets body overflow to hidden when modal opens', () => {
      render(<NewsDetailModal {...defaultProps} isOpen={true} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('resets body overflow when modal closes', () => {
      const { rerender } = render(<NewsDetailModal {...defaultProps} isOpen={true} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<NewsDetailModal {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe('unset');
    });

    it('cleans up body overflow on unmount', () => {
      const { unmount } = render(<NewsDetailModal {...defaultProps} isOpen={true} />);

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('unset');
    });
  });

  // ===========================================================================
  // BANNER IMAGE
  // ===========================================================================

  describe('Banner Image', () => {
    it('displays banner image when provided', () => {
      const articleWithImage = createArticle({
        banner_image: 'https://example.com/image.jpg',
      });

      render(<NewsDetailModal {...defaultProps} article={articleWithImage} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('uses image property when banner_image is not available', () => {
      const articleWithImage = createArticle({
        banner_image: undefined,
        image: 'https://example.com/alt-image.jpg',
      });

      render(<NewsDetailModal {...defaultProps} article={articleWithImage} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', 'https://example.com/alt-image.jpg');
    });

    it('uses article title as alt text', () => {
      const articleWithImage = createArticle({
        banner_image: 'https://example.com/image.jpg',
      });

      render(<NewsDetailModal {...defaultProps} article={articleWithImage} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', 'Tech Giant Reports Record Earnings');
    });

    it('handles image load error by hiding the image', () => {
      const articleWithImage = createArticle({
        banner_image: 'https://example.com/broken-image.jpg',
      });

      render(<NewsDetailModal {...defaultProps} article={articleWithImage} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(image).toHaveStyle({ display: 'none' });
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('Edge Cases', () => {
    it('handles missing optional fields gracefully', () => {
      const minimalArticle: TestArticle = {
        title: 'Minimal Article',
      };

      render(<NewsDetailModal {...defaultProps} article={minimalArticle} />);

      expect(screen.getByText('Minimal Article')).toBeInTheDocument();
      expect(screen.getByText('Unknown Source')).toBeInTheDocument();
    });

    it('does not display category if it is "n/a"', () => {
      const articleWithNaCategory = createArticle({
        category_within_source: 'n/a',
      });

      render(<NewsDetailModal {...defaultProps} article={articleWithNaCategory} />);

      // Should not have duplicate bullet points for n/a category
      const sourceText = screen.getByText('Bloomberg');
      expect(sourceText).toBeInTheDocument();
    });

    it('handles ticker sentiment with string scores', () => {
      const articleWithStringScores = {
        ...createArticle(),
        ticker_sentiment: [
          {
            ticker: 'AAPL',
            ticker_sentiment_score: '0.420' as unknown as number,
            ticker_sentiment_label: 'Bullish',
            relevance_score: '0.850' as unknown as number,
          },
        ],
      };

      render(<NewsDetailModal {...defaultProps} article={articleWithStringScores} />);

      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('0.420')).toBeInTheDocument();
    });

    it('handles invalid publish time gracefully', () => {
      const articleWithInvalidTime = createArticle({
        time_published: 'invalid',
      });

      render(<NewsDetailModal {...defaultProps} article={articleWithInvalidTime} />);

      // Should still render without crashing
      expect(screen.getByText('Tech Giant Reports Record Earnings')).toBeInTheDocument();
    });

    it('handles undefined publish time', () => {
      const articleWithoutTime = createArticle({
        time_published: undefined,
      });

      render(<NewsDetailModal {...defaultProps} article={articleWithoutTime} />);

      expect(screen.getByText('Tech Giant Reports Record Earnings')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // ACCESSIBILITY
  // ===========================================================================

  describe('Accessibility', () => {
    it('has proper dialog role and aria attributes', () => {
      render(<NewsDetailModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('close button has accessible label', () => {
      render(<NewsDetailModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('external links open in new tab with security attributes', () => {
      render(<NewsDetailModal {...defaultProps} />);

      const externalLink = screen.getByRole('link', { name: /Read Full Article/i });
      expect(externalLink).toHaveAttribute('target', '_blank');
      expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
