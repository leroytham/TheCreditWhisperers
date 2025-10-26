#!/usr/bin/env python3
"""
Test script for sector news aggregation functionality.
This script tests the new sector service and news aggregation without starting the full server.
"""

import asyncio
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.services.sector_service import sector_service_instance
from app.services.news_service import news_service_instance
from app.services.sector_sentiment_service import sector_sentiment_service
from app.config.yfinance_sector_mapping import resolve_yfinance_sector_key, get_sector_display_name


async def test_sector_service():
    """Test the sector service for fetching ticker baskets with optimization."""
    print("=" * 80)
    print("TEST 1: Sector Service - Optimized Ticker Selection (Top 15 by Market Weight)")
    print("=" * 80)

    test_cases = [
        "technology",
        "healthcare",
        "financial-services"
    ]

    for sector_key in test_cases:
        print(f"\n📊 Testing sector: {sector_key}")
        print("-" * 80)

        try:
            # Get sector metadata
            metadata = sector_service_instance.get_sector_metadata(sector_key)
            print(f"Display Name: {metadata['display_name']}")
            print(f"S&P 500 Ticker: {metadata['sp500_ticker']}")
            print(f"SPDR ETF: {metadata['spdr_etf']}")

            # Get ticker basket with default limit (15)
            tickers, market_weight = sector_service_instance.get_sector_tickers(sector_key)
            print(f"\nTotal tickers returned: {len(tickers)}")
            print(f"Market weight coverage: {market_weight:.2%}")
            print(f"Tickers: {tickers}")

        except Exception as e:
            print(f"❌ ERROR: {str(e)}")


async def test_sector_key_resolution():
    """Test sector key resolution from various identifiers."""
    print("\n" + "=" * 80)
    print("TEST 2: Sector Key Resolution")
    print("=" * 80)

    test_identifiers = [
        ("^SP500-45", "S&P 500 ticker"),
        ("XLK", "SPDR ETF ticker"),
        ("Information Technology", "Sector name"),
        ("technology", "yfinance key")
    ]

    for identifier, description in test_identifiers:
        print(f"\n🔍 Testing: {identifier} ({description})")
        print("-" * 80)

        try:
            yfinance_key = sector_service_instance.resolve_sector_key(identifier)
            display_name = get_sector_display_name(yfinance_key)
            print(f"✅ Resolved to: {yfinance_key} ({display_name})")

        except Exception as e:
            print(f"❌ ERROR: {str(e)}")


async def test_news_aggregation():
    """Test news aggregation for a sector (limited test - only 3 tickers to avoid rate limits)."""
    print("\n" + "=" * 80)
    print("TEST 3: News Aggregation (Limited Test)")
    print("=" * 80)

    sector_key = "technology"
    print(f"\n📰 Testing news aggregation for: {sector_key}")
    print("NOTE: This is a limited test - only fetching from first 3 tickers to avoid rate limits")
    print("-" * 80)

    try:
        # Get ticker basket
        all_tickers = sector_service_instance.get_sector_tickers(sector_key)
        print(f"Total tickers available: {len(all_tickers)}")

        # For testing, we'll manually fetch news for just 3 tickers
        test_tickers = all_tickers[:3]
        print(f"Testing with tickers: {test_tickers}")

        # Fetch news for each ticker
        import aiohttp
        all_articles = []

        async with aiohttp.ClientSession() as session:
            for ticker in test_tickers:
                print(f"\nFetching news for {ticker}...")
                articles = await news_service_instance._fetch_alpha_vantage_news(
                    session=session,
                    ticker=ticker,
                    limit=50  # Limit to 50 articles per ticker for testing
                )
                print(f"  Fetched {len(articles)} articles")
                all_articles.extend(articles)

        print(f"\nTotal articles before deduplication: {len(all_articles)}")

        # Test deduplication
        unique_articles, dedup_stats = news_service_instance._deduplicate_articles(all_articles)

        print(f"\n📊 Deduplication Results:")
        print(f"  Total articles fetched: {len(all_articles)}")
        print(f"  Unique articles: {len(unique_articles)}")
        print(f"  URL duplicates removed: {dedup_stats['url_duplicates_removed']}")
        print(f"  Title duplicates removed: {dedup_stats['title_duplicates_removed']}")
        print(f"  Total duplicates: {dedup_stats['total_duplicates_removed']}")

        if len(all_articles) > 0:
            dedup_rate = (dedup_stats['total_duplicates_removed'] / len(all_articles) * 100)
            print(f"  Deduplication rate: {dedup_rate:.2f}%")

        # Show sample articles
        if unique_articles:
            print(f"\n📄 Sample Articles (first 3):")
            for i, article in enumerate(unique_articles[:3], 1):
                print(f"\n{i}. {article.get('title', 'No title')}")
                print(f"   Provider: {article.get('provider', 'Unknown')}")
                print(f"   Date: {article.get('publish_date', 'Unknown')}")
                print(f"   Sentiment: {article.get('sentiment_score', 'N/A')}")

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


async def test_sector_sentiment_calculation():
    """Test sector-wide sentiment calculation with full pipeline."""
    print("\n" + "=" * 80)
    print("TEST 4: Sector Sentiment Calculation (Full Pipeline)")
    print("=" * 80)

    sector_key = "technology"
    print(f"\n💹 Testing complete sector sentiment pipeline for: {sector_key}")
    print("NOTE: This test uses the full get_sector_news endpoint which includes sentiment calculation")
    print("-" * 80)

    try:
        # Use the full get_sector_news method which now includes sentiment calculation
        result = await news_service_instance.get_sector_news(
            sector_key=sector_key,
            limit=100,
            timeframe="1W"
        )

        print(f"\n📊 News Aggregation Results:")
        print(f"  Sector: {result['sector_name']}")
        print(f"  Tickers queried: {result['total_tickers']}")
        print(f"  Successful tickers: {len(result['successful_tickers'])}")
        print(f"  Failed tickers: {len(result['failed_tickers'])}")
        print(f"  Success rate: {result['success_rate']}%")
        print(f"  Market weight coverage: {result['total_market_weight_coverage']:.2%}")
        print(f"  Total articles fetched: {result['total_articles_fetched']}")
        print(f"  Unique articles: {result['unique_articles']}")
        print(f"  Deduplication rate: {result['deduplication_rate']}%")

        # Check if sentiment_metrics exists
        if 'sentiment_metrics' in result:
            sm = result['sentiment_metrics']
            print(f"\n💹 Sector Sentiment Metrics:")
            print(f"  Data Quality: {sm.get('data_quality')}")
            print(f"\n  Sentiment Scores:")
            print(f"    Fast Score (7h half-life): {sm.get('fast_score')}")
            print(f"    Slow Score (24h half-life): {sm.get('slow_score')}")
            print(f"    Sentiment Momentum: {sm.get('sentiment_momentum')}")
            print(f"    Momentum Label: {sm.get('momentum_label')}")
            print(f"    Momentum Interpretation: {sm.get('momentum_interpretation')}")

            print(f"\n  Volatility & Breadth:")
            print(f"    Sentiment Volatility: {sm.get('sentiment_volatility')}")
            print(f"    Breadth Score: {sm.get('sentiment_breadth_score')}")
            print(f"    Bullish Mentions: {sm.get('num_bullish_mentions')}")
            print(f"    Bearish Mentions: {sm.get('num_bearish_mentions')}")
            print(f"    Total Directional: {sm.get('total_directional_mentions')}")
            print(f"    Breadth Interpretation: {sm.get('breadth_interpretation')}")

            print(f"\n  Coverage & Volume:")
            print(f"    Effective News Volume: {sm.get('effective_news_volume')}")
            print(f"    Volume Interpretation: {sm.get('volume_interpretation')}")

            if 'ticker_coverage' in sm:
                tc = sm['ticker_coverage']
                print(f"    Tickers Mentioned: {tc.get('tickers_mentioned')}/{tc.get('total_tickers_in_sector')}")
                print(f"    Coverage Percentage: {tc.get('coverage_percentage')}%")

            print(f"\n  Processing Statistics:")
            print(f"    Total Ticker Mentions: {sm.get('total_ticker_mentions')}")
            print(f"    Articles with Sector Mentions: {sm.get('unique_articles_with_sector_mentions')}")
            print(f"    Total Articles Analyzed: {sm.get('total_articles_analyzed')}")

            print(f"\n  Configuration:")
            print(f"    Fast Half-Life: {sm.get('half_life_fast_hours')}h")
            print(f"    Slow Half-Life: {sm.get('half_life_slow_hours')}h")
            print(f"    Momentum Threshold (Weak): {sm.get('momentum_threshold_weak')}")
            print(f"    Momentum Threshold (Strong): {sm.get('momentum_threshold_strong')}")

            # Validate the results
            print(f"\n✅ Validation:")
            validations = []

            # Check that we have sentiment scores
            if sm.get('slow_score') is not None:
                validations.append("✓ Slow score calculated")
            else:
                validations.append("✗ Slow score missing")

            # Check momentum calculation
            if sm.get('sentiment_momentum') is not None:
                validations.append("✓ Momentum calculated")
            else:
                validations.append("✗ Momentum missing")

            # Check ticker coverage
            if sm.get('ticker_coverage', {}).get('tickers_mentioned', 0) > 0:
                validations.append("✓ Ticker mentions extracted")
            else:
                validations.append("✗ No ticker mentions found")

            # Check data quality
            if sm.get('data_quality') in ['good', 'low_confidence']:
                validations.append("✓ Data quality acceptable")
            else:
                validations.append(f"⚠ Data quality: {sm.get('data_quality')}")

            for v in validations:
                print(f"  {v}")

        else:
            print("\n❌ ERROR: sentiment_metrics not found in response!")

        # Show sample articles with ticker sentiment data
        if result.get('articles'):
            print(f"\n📄 Sample Articles with Ticker Sentiment (first 2):")
            for i, article in enumerate(result['articles'][:2], 1):
                print(f"\n{i}. {article.get('title', 'No title')[:80]}...")
                print(f"   Provider: {article.get('provider', 'Unknown')}")
                print(f"   Date: {article.get('publish_date', 'Unknown')}")

                ticker_sentiments = article.get('ticker_sentiment', [])
                if ticker_sentiments:
                    print(f"   Ticker Mentions: {len(ticker_sentiments)} tickers")
                    # Show first 3 ticker mentions
                    for ts in ticker_sentiments[:3]:
                        ticker = ts.get('ticker', 'Unknown')
                        score = ts.get('ticker_sentiment_score', 0)
                        relevance = ts.get('relevance_score', 0)
                        print(f"     - {ticker}: score={score:.3f}, relevance={relevance:.3f}")
                else:
                    print(f"   Ticker Mentions: None")

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


async def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("SECTOR NEWS AGGREGATION & SENTIMENT TEST SUITE")
    print("=" * 80)

    await test_sector_service()
    await test_sector_key_resolution()

    # Uncomment to test news aggregation (uses API credits)
    # WARNING: This will make actual API calls to Alpha Vantage
    print("\n⚠️  Basic news aggregation test skipped to avoid API rate limits.")
    print("    Uncomment in the script to test actual news fetching.")
    # await test_news_aggregation()

    # Test the full sector sentiment calculation pipeline
    print("\n⚠️  Running full sector sentiment calculation test (uses API credits)...")
    await test_sector_sentiment_calculation()

    print("\n" + "=" * 80)
    print("✅ All tests completed!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
