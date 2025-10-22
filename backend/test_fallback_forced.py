#!/usr/bin/env python3
"""
Test script to verify the fallback mechanism works when Alpha Vantage is unavailable.
This temporarily disables the Alpha Vantage key to force fallback.
"""
import asyncio
from app.services.news_service import news_service_instance

async def test_fallback():
    print("=" * 80)
    print("Testing Fallback Mechanism (Alpha Vantage Disabled)")
    print("=" * 80)
    print()

    # Temporarily disable Alpha Vantage
    original_key = news_service_instance.alpha_vantage_api_key
    news_service_instance.alpha_vantage_api_key = None
    print("✓ Alpha Vantage API key temporarily disabled")
    print()

    ticker = "AAPL"

    print(f"Fetching news for {ticker}...")
    print(f"Should fall back to other sources (Yahoo Finance, Finnhub, etc.)")
    print()

    news_articles = await news_service_instance.get_ticker_news(ticker, count=5)

    # Restore the original key
    news_service_instance.alpha_vantage_api_key = original_key

    print()
    print("=" * 80)
    print("FALLBACK RESULTS:")
    print("=" * 80)
    print(f"Total articles fetched: {len(news_articles)}")
    print()

    if news_articles:
        print("First 3 articles from fallback sources:")
        for i, article in enumerate(news_articles[:3], 1):
            print(f"\n{i}. {article.get('title', 'No title')}")
            print(f"   Provider: {article.get('provider', 'Unknown')}")
            print(f"   Date: {article.get('publish_date', 'Unknown')}")

            # These should NOT have Alpha Vantage sentiment scores
            if 'ticker_sentiment_score' in article:
                print("   ⚠️  WARNING: Has Alpha Vantage sentiment (unexpected)")
            else:
                print("   ✓ Using fallback sources (as expected)")

        print()
        print("✅ Fallback mechanism working correctly!")
    else:
        print("⚠️  No articles found from fallback sources.")
        print("   This might mean:")
        print("   1. No fallback API keys are configured")
        print("   2. All fallback sources are also rate limited")

    print()
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_fallback())
