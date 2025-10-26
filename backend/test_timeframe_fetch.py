#!/usr/bin/env python3
"""
Test script to verify that different timeframes fetch different amounts of news.
This will help debug why the chart isn't showing more data points.
"""

import sys
import asyncio
import aiohttp
from app.services.news_service import NewsService

async def test_timeframe_fetching():
    """Test that different timeframes fetch different amounts of articles."""
    news_service = NewsService()
    ticker = "AAPL"  # Use a popular ticker with lots of news

    print("=" * 80)
    print("TESTING TIMEFRAME-SPECIFIC NEWS FETCHING")
    print("=" * 80)
    print(f"\nTicker: {ticker}\n")

    timeframes_to_test = ['1W', '1M', '3M', '6M', '1Y']

    async with aiohttp.ClientSession() as session:
        for timeframe in timeframes_to_test:
            print(f"\n{'='*60}")
            print(f"Testing timeframe: {timeframe}")
            print(f"{'='*60}")

            # Get months for this timeframe
            months = news_service._get_timeframe_months(timeframe)
            max_batches = news_service._get_max_batches_for_months(months)

            print(f"  Months: {months}")
            print(f"  Max batches: {max_batches}")
            print(f"  Expected max articles: {max_batches * 1000:,}")

            # Fetch articles using the timeframe-aware method
            print(f"\n  Fetching articles...")
            articles = await news_service.get_ticker_news_for_timeframe(
                ticker=ticker,
                timeframe=timeframe,
                trigger_progressive=False  # Don't trigger background fetching for this test
            )

            print(f"  ✓ Fetched {len(articles):,} articles")

            if articles:
                # Show date range
                dates = [a.get('publish_date', '') for a in articles if a.get('publish_date')]
                if dates:
                    dates_sorted = sorted(dates)
                    print(f"  Date range: {dates_sorted[0]} to {dates_sorted[-1]}")

            print()

    print("=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
    print("\nExpected behavior:")
    print("  • Longer timeframes (3M, 6M, 1Y) should fetch MORE articles than shorter ones (1W, 1M)")
    print("  • Date range should extend further back for longer timeframes")
    print("\nIf all timeframes show similar article counts (e.g., all ~1000), the bug persists.")
    print()

if __name__ == "__main__":
    asyncio.run(test_timeframe_fetching())
