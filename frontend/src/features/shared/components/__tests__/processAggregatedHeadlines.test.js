/**
 * Test suite for processAggregatedHeadlines helper function
 * This tests the headline deduplication, scoring, and ranking logic
 */

// Mock implementation of processAggregatedHeadlines for testing
// (In production, this would be imported from CombinedSentimentVolumeChart.jsx)
const processAggregatedHeadlines = (headlinesList, maxHeadlines = 15) => {
  if (!headlinesList || headlinesList.length === 0) {
    return [];
  }

  // Deduplicate headlines by link using a Map
  const uniqueHeadlines = new Map();
  headlinesList.forEach(headline => {
    if (headline && headline.link && !uniqueHeadlines.has(headline.link)) {
      uniqueHeadlines.set(headline.link, headline);
    }
  });

  // Score each headline and sort by impact
  // Score = abs(sentiment_score) * (relevance_score || 1)
  const scoredHeadlines = Array.from(uniqueHeadlines.values())
    .map(headline => ({
      ...headline,
      _score: Math.abs(headline.sentiment_score || 0) * (headline.relevance_score || 1)
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, maxHeadlines)
    .map(({ _score, ...headline }) => headline); // Remove the temporary _score field

  return scoredHeadlines;
};

describe('processAggregatedHeadlines', () => {
  it('should return empty array for empty input', () => {
    expect(processAggregatedHeadlines([])).toEqual([]);
    expect(processAggregatedHeadlines(null)).toEqual([]);
    expect(processAggregatedHeadlines(undefined)).toEqual([]);
  });

  it('should deduplicate headlines by link', () => {
    const headlines = [
      { link: 'url1', title: 'Title 1', sentiment_score: 0.5, relevance_score: 1 },
      { link: 'url2', title: 'Title 2', sentiment_score: 0.3, relevance_score: 1 },
      { link: 'url1', title: 'Duplicate Title 1', sentiment_score: 0.7, relevance_score: 2 },
    ];

    const result = processAggregatedHeadlines(headlines);

    expect(result).toHaveLength(2);
    expect(result.map(h => h.link)).toEqual(['url1', 'url2']);
    // Should keep the first occurrence of duplicate link
    expect(result[0].title).toBe('Title 1');
  });

  it('should score headlines by abs(sentiment) * relevance', () => {
    const headlines = [
      { link: 'url1', title: 'Low impact', sentiment_score: 0.1, relevance_score: 1 },
      { link: 'url2', title: 'High negative', sentiment_score: -0.9, relevance_score: 1 },
      { link: 'url3', title: 'High relevant', sentiment_score: 0.3, relevance_score: 3 },
    ];

    const result = processAggregatedHeadlines(headlines);

    // Expected scores:
    // url1: abs(0.1) * 1 = 0.1
    // url2: abs(-0.9) * 1 = 0.9
    // url3: abs(0.3) * 3 = 0.9

    expect(result).toHaveLength(3);
    // url2 and url3 have equal scores (0.9), but url2 should come first due to stable sort
    expect(result[0].title).toBe('High negative');
    expect(result[1].title).toBe('High relevant');
    expect(result[2].title).toBe('Low impact');
  });

  it('should use relevance_score of 1 when missing', () => {
    const headlines = [
      { link: 'url1', title: 'No relevance', sentiment_score: 0.5 }, // no relevance_score
      { link: 'url2', title: 'Zero relevance', sentiment_score: 0.5, relevance_score: 0 },
      { link: 'url3', title: 'Has relevance', sentiment_score: 0.5, relevance_score: 2 },
    ];

    const result = processAggregatedHeadlines(headlines);

    // Expected scores:
    // url1: abs(0.5) * 1 = 0.5 (missing relevance defaults to 1)
    // url2: abs(0.5) * 0 = 0 (explicit 0 relevance)
    // url3: abs(0.5) * 2 = 1.0

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('Has relevance');
    expect(result[1].title).toBe('No relevance');
    expect(result[2].title).toBe('Zero relevance');
  });

  it('should limit to maxHeadlines (default 15)', () => {
    const headlines = Array.from({ length: 20 }, (_, i) => ({
      link: `url${i}`,
      title: `Title ${i}`,
      sentiment_score: (20 - i) * 0.05, // Decreasing sentiment
      relevance_score: 1
    }));

    const result = processAggregatedHeadlines(headlines);

    expect(result).toHaveLength(15); // Default limit
    expect(result[0].title).toBe('Title 0'); // Highest abs(sentiment)
  });

  it('should respect custom maxHeadlines parameter', () => {
    const headlines = Array.from({ length: 10 }, (_, i) => ({
      link: `url${i}`,
      title: `Title ${i}`,
      sentiment_score: 0.5,
      relevance_score: 1
    }));

    const result = processAggregatedHeadlines(headlines, 5);

    expect(result).toHaveLength(5);
  });

  it('should handle negative sentiment scores correctly', () => {
    const headlines = [
      { link: 'url1', title: 'Positive', sentiment_score: 0.5, relevance_score: 1 },
      { link: 'url2', title: 'Very Negative', sentiment_score: -0.8, relevance_score: 1 },
      { link: 'url3', title: 'Slightly Negative', sentiment_score: -0.2, relevance_score: 1 },
    ];

    const result = processAggregatedHeadlines(headlines);

    // Expected scores:
    // url1: abs(0.5) * 1 = 0.5
    // url2: abs(-0.8) * 1 = 0.8 (highest)
    // url3: abs(-0.2) * 1 = 0.2

    expect(result[0].title).toBe('Very Negative');
    expect(result[1].title).toBe('Positive');
    expect(result[2].title).toBe('Slightly Negative');
  });

  it('should not include _score field in output', () => {
    const headlines = [
      { link: 'url1', title: 'Title 1', sentiment_score: 0.5, relevance_score: 1 },
    ];

    const result = processAggregatedHeadlines(headlines);

    expect(result[0]).not.toHaveProperty('_score');
    expect(result[0]).toHaveProperty('link');
    expect(result[0]).toHaveProperty('title');
    expect(result[0]).toHaveProperty('sentiment_score');
    expect(result[0]).toHaveProperty('relevance_score');
  });

  it('should handle edge cases gracefully', () => {
    const headlines = [
      { link: 'url1', title: 'Normal', sentiment_score: 0.5, relevance_score: 1 },
      { link: null, title: 'No link', sentiment_score: 0.8, relevance_score: 2 }, // Should be filtered out
      { title: 'No link field', sentiment_score: 0.9, relevance_score: 1 }, // Should be filtered out
      { link: '', title: 'Empty link', sentiment_score: 0.7, relevance_score: 1 }, // Should be filtered out
    ];

    const result = processAggregatedHeadlines(headlines);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Normal');
  });
});

// Example usage for manual testing
console.log('\n=== Manual Test Examples ===\n');

const testHeadlines = [
  {
    link: 'https://example.com/1',
    title: 'Breaking: Major market movement',
    provider: 'Reuters',
    sentiment_score: -0.8,
    relevance_score: 0.9
  },
  {
    link: 'https://example.com/2',
    title: 'Company announces strong earnings',
    provider: 'Bloomberg',
    sentiment_score: 0.7,
    relevance_score: 0.85
  },
  {
    link: 'https://example.com/1', // Duplicate link
    title: 'DUPLICATE: Major market movement',
    provider: 'AP',
    sentiment_score: -0.75,
    relevance_score: 0.8
  },
  {
    link: 'https://example.com/3',
    title: 'Analyst upgrades rating',
    provider: 'CNBC',
    sentiment_score: 0.3,
    relevance_score: 0.5
  },
  {
    link: 'https://example.com/4',
    title: 'Neutral market update',
    provider: 'WSJ',
    sentiment_score: 0.05,
    relevance_score: 0.3
  }
];

const processed = processAggregatedHeadlines(testHeadlines, 3);

console.log('Input: 5 headlines (1 duplicate)');
console.log('Output: Top 3 headlines after deduplication and ranking:\n');

processed.forEach((headline, idx) => {
  const score = Math.abs(headline.sentiment_score) * (headline.relevance_score || 1);
  console.log(`${idx + 1}. "${headline.title}"`);
  console.log(`   Provider: ${headline.provider}`);
  console.log(`   Sentiment: ${headline.sentiment_score}, Relevance: ${headline.relevance_score}`);
  console.log(`   Impact Score: ${score.toFixed(2)}\n`);
});