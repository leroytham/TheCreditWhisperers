#!/usr/bin/env python3
"""
Test the news_service directly to see if the issue is in the service or elsewhere.
"""
import asyncio
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_news_service():
    print("Importing news_service...")
    from app.services.news_service import news_service_instance

    print(f"API Key loaded: {news_service_instance.alpha_vantage_api_key[:10]}..." if news_service_instance.alpha_vantage_api_key else "No API key!")

    print("\nCalling get_ticker_news('NVDA')...")
    news = await news_service_instance.get_ticker_news("NVDA")

    print(f"\nResults:")
    print(f"Number of articles returned: {len(news)}")

    if news:
        print(f"\nFirst article:")
        first = news[0]
        print(f"  Title: {first.get('title')}")
        print(f"  Provider: {first.get('provider')}")
        print(f"  Publish date: {first.get('publish_date')}")
        print(f"  Sentiment score: {first.get('ticker_sentiment_score')}")
        print(f"  Sentiment label: {first.get('ticker_sentiment_label')}")
    else:
        print("\n❌ No news returned!")
        print("This is the bug we need to fix.")

if __name__ == "__main__":
    asyncio.run(test_news_service())
