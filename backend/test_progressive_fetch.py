#!/usr/bin/env python3
"""
Test script for progressive news fetching functionality.

This script tests:
1. Batch fetching with time_from/time_to parameters
2. Rate limiting tracking
3. Progressive background fetch triggering
4. Timeframe-specific caching
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone

# Add the backend directory to the path
sys.path.insert(0, '/Users/nmducc/Documents/GitHub/TheCreditWhisperers/backend')

from app.services.news_service import news_service_instance
from app.core.cache import redis_cache


async def test_basic_fetch_with_time_params():
    """Test basic fetch with time_from and time_to parameters."""
    print("\n" + "="*80)
    print("TEST 1: Basic fetch with time parameters")
    print("="*80)

    import aiohttp

    ticker = "AAPL"
    now = datetime.now(timezone.utc)
    six_months_ago = now - timedelta(days=180)

    time_from = six_months_ago.strftime("%Y%m%dT%H%M")
    time_to = now.strftime("%Y%m%dT%H%M")

    async with aiohttp.ClientSession() as session:
        articles = await news_service_instance._fetch_alpha_vantage_news(
            session,
            ticker,
            time_from=time_from,
            time_to=time_to,
            limit=100  # Small limit for testing
        )

    print(f"✓ Fetched {len(articles)} articles for {ticker}")
    if articles:
        earliest = min(article['publish_timestamp'] for article in articles if article.get('publish_timestamp'))
        latest = max(article['publish_timestamp'] for article in articles if article.get('publish_timestamp'))
        print(f"  Date range: {earliest} to {latest}")
        print(f"  Sample article: {articles[0]['title'][:80]}...")

    return len(articles) > 0


async def test_batch_fetch():
    """Test batch fetching for 6 months."""
    print("\n" + "="*80)
    print("TEST 2: Batch fetch for 6 months")
    print("="*80)

    import aiohttp

    ticker = "AAPL"

    async with aiohttp.ClientSession() as session:
        articles = await news_service_instance._fetch_alpha_vantage_batch(
            session,
            ticker,
            months_back=6
        )

    print(f"✓ Batch fetched {len(articles)} articles for {ticker} (6 months)")

    if articles:
        # Check date range
        dates = []
        for article in articles:
            if article.get('publish_timestamp'):
                try:
                    dt = datetime.fromisoformat(article['publish_timestamp'])
                    dates.append(dt)
                except:
                    pass

        if dates:
            earliest = min(dates)
            latest = max(dates)
            span_days = (latest - earliest).days
            print(f"  Earliest: {earliest.date()}")
            print(f"  Latest: {latest.date()}")
            print(f"  Span: {span_days} days (~{span_days/30:.1f} months)")

    return len(articles) > 0


async def test_rate_limiting():
    """Test rate limiting functionality."""
    print("\n" + "="*80)
    print("TEST 3: Rate limiting check")
    print("="*80)

    # Check rate limit multiple times
    checks = []
    for i in range(5):
        ok = await news_service_instance._check_rate_limit()
        checks.append(ok)
        print(f"  Check {i+1}: {'OK' if ok else 'RATE LIMITED'}")

    # Check Redis counter
    if redis_cache.async_client:
        rate_limit_key = "alpha_vantage:rate_limit:calls_per_minute"
        count = await redis_cache.async_client.get(rate_limit_key)
        if count:
            print(f"✓ Current API calls this minute: {int(count)}/300")
        else:
            print("  No rate limit counter found (first request)")

    return all(checks)


async def test_timeframe_fetch():
    """Test fetching with different timeframes."""
    print("\n" + "="*80)
    print("TEST 4: Timeframe-specific fetch")
    print("="*80)

    ticker = "AAPL"
    timeframes = ['1M', '6M']

    for tf in timeframes:
        print(f"\n  Testing timeframe: {tf}")

        articles = await news_service_instance.get_ticker_news_for_timeframe(
            ticker,
            timeframe=tf,
            trigger_progressive=False  # Don't trigger background tasks for testing
        )

        print(f"    ✓ Fetched {len(articles)} articles")

        # Check cache
        cache_key = f"ticker_news:{ticker}:{tf}"
        if redis_cache.async_client:
            cached = await redis_cache.aget(cache_key)
            if cached:
                print(f"    ✓ Articles cached with key: {cache_key}")
                print(f"    ✓ Cached article count: {len(cached)}")

    return True


async def test_progressive_trigger():
    """Test progressive fetch triggering."""
    print("\n" + "="*80)
    print("TEST 5: Progressive fetch trigger")
    print("="*80)

    ticker = "AAPL"
    timeframe = "1M"

    print(f"  Triggering progressive fetch for {ticker} - {timeframe}")

    # This should queue: 1M → 6M → YTD → 1Y → 5Y
    await news_service_instance.trigger_progressive_fetch(ticker, timeframe, force=False)

    # Give it a moment to start
    await asyncio.sleep(2)

    # Check active tasks
    active_count = len(news_service_instance._active_fetch_tasks)
    print(f"  Active background tasks: {active_count}")

    for task_key, task in news_service_instance._active_fetch_tasks.items():
        status = "running" if not task.done() else "completed"
        print(f"    - {task_key}: {status}")

    # Check progress in Redis
    if redis_cache.async_client:
        print("\n  Checking fetch progress in Redis:")
        for tf in ['1M', '6M', 'YTD', '1Y', '5Y']:
            progress_key = f"fetch_progress:{ticker}:{tf}"
            progress = await redis_cache.aget(progress_key)
            if progress:
                print(f"    - {tf}: {progress.get('status', 'unknown')}")

    return True


async def test_cache_ttl():
    """Test timeframe-specific cache TTLs."""
    print("\n" + "="*80)
    print("TEST 6: Timeframe-specific cache TTL")
    print("="*80)

    timeframes = ['1M', '3M', '6M', 'YTD', '1Y', '5Y']

    for tf in timeframes:
        ttl = news_service_instance._get_cache_ttl_for_timeframe(tf)
        hours = ttl / 3600
        print(f"  {tf:4s}: {ttl:6d} seconds ({hours:.1f} hours)")

    return True


async def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("PROGRESSIVE NEWS FETCHING TEST SUITE")
    print("="*80)

    # Check if Redis is available
    if redis_cache.async_client:
        try:
            await redis_cache.async_client.ping()
            print("✓ Redis connection: OK")
        except Exception as e:
            print(f"✗ Redis connection failed: {e}")
            print("  Some tests may not work without Redis")
    else:
        print("✗ Redis not available - caching tests will be limited")

    results = {}

    # Run tests
    tests = [
        ("Basic fetch with time params", test_basic_fetch_with_time_params),
        ("Batch fetch (6 months)", test_batch_fetch),
        ("Rate limiting", test_rate_limiting),
        ("Timeframe-specific fetch", test_timeframe_fetch),
        ("Cache TTL configuration", test_cache_ttl),
        ("Progressive fetch trigger", test_progressive_trigger),
    ]

    for test_name, test_func in tests:
        try:
            result = await test_func()
            results[test_name] = "✓ PASSED" if result else "✗ FAILED"
        except Exception as e:
            print(f"\n✗ ERROR in {test_name}: {e}")
            import traceback
            traceback.print_exc()
            results[test_name] = "✗ ERROR"

    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)

    for test_name, result in results.items():
        print(f"{result:10s} - {test_name}")

    passed = sum(1 for r in results.values() if "✓" in r)
    total = len(results)
    print(f"\nPassed: {passed}/{total}")

    # Wait a bit for background tasks to complete
    if news_service_instance._active_fetch_tasks:
        print("\n" + "="*80)
        print("WAITING FOR BACKGROUND TASKS TO COMPLETE...")
        print("="*80)
        await asyncio.sleep(5)

        print("\nFinal background task status:")
        for task_key, task in list(news_service_instance._active_fetch_tasks.items()):
            status = "completed" if task.done() else "still running"
            print(f"  - {task_key}: {status}")


if __name__ == "__main__":
    asyncio.run(main())
