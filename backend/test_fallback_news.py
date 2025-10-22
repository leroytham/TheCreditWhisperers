#!/usr/bin/env python3
"""
Test script to verify Alpha Vantage fallback logic.
This tests both successful Alpha Vantage fetches and fallback to other sources.
"""
import asyncio
from app.services.news_service import news_service_instance

async def test_news_service():
    print("=" * 80)
    print("Testing News Service with Alpha Vantage Fallback")
    print("=" * 80)
    print()

    ticker = "NVDA"

    print(f"Fetching news for {ticker}...")
    print(f"This will try Alpha Vantage first, then fall back if needed.")
    print()

    news_articles = await news_service_instance.get_ticker_news(ticker, count=10)

    print()
    print("=" * 80)
    print("RESULTS:")
    print("=" * 80)
    print(f"Total articles fetched: {len(news_articles)}")
    print()

    if news_articles:
        print("First 3 articles:")
        for i, article in enumerate(news_articles[:3], 1):
            print(f"\n{i}. {article.get('title', 'No title')}")
            print(f"   Provider: {article.get('provider', 'Unknown')}")
            print(f"   Date: {article.get('publish_date', 'Unknown')}")

            # Check if this is from Alpha Vantage (has sentiment score)
            if 'ticker_sentiment_score' in article:
                print(f"   Alpha Vantage Sentiment: {article['ticker_sentiment_score']:.4f}")
                print(f"   Sentiment Label: {article.get('ticker_sentiment_label', 'Unknown')}")
                print("   Source: Alpha Vantage ✓")
            else:
                print("   Source: Fallback sources (no sentiment from Alpha Vantage)")
    else:
        print("⚠️  No articles found. This might indicate:")
        print("   1. All API keys are missing")
        print("   2. Network issues")
        print("   3. All sources are rate limited")

    print()
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_news_service())
