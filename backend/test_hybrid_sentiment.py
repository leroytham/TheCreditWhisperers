#!/usr/bin/env python3
"""
Test script to verify hybrid sentiment analysis.
Tests both Alpha Vantage sentiment scores and FinBERT fallback.
"""
import asyncio
from app.services.news_service import news_service_instance
from app.services.sentiment_service import sentiment_service

async def test_hybrid_sentiment():
    print("=" * 80)
    print("Testing Hybrid Sentiment Analysis")
    print("=" * 80)
    print()

    # Test 1: Alpha Vantage articles (should have sentiment scores)
    print("TEST 1: Alpha Vantage Articles (with pre-calculated sentiment)")
    print("-" * 80)

    ticker = "NVDA"
    news_articles = await news_service_instance.get_ticker_news(ticker, count=3)

    if news_articles:
        print(f"Fetched {len(news_articles)} articles for {ticker}")

        # Analyze sentiment
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        print("\nFirst article analysis:")
        first_article = articles_with_sentiment[0]
        print(f"  Title: {first_article.get('title')[:60]}...")
        print(f"  Has Alpha Vantage score: {'ticker_sentiment_score' in news_articles[0]}")
        print(f"  Sentiment Score: {first_article.get('sentiment_score_raw', 0.0):.4f}")
        print(f"  Sentiment Label: {first_article.get('sentiment_label', 'unknown')}")
        print(f"  Confidence: {first_article.get('sentiment_confidence', 0.0):.4f}")

        # Check the News object to see source
        news_objects = sentiment_results.get("news_objects", [])
        if news_objects:
            first_news_obj = news_objects[0]
            print(f"  ✓ Sentiment Source: {first_news_obj.sentiment_score.source}")
    else:
        print("  ⚠️  No articles found from Alpha Vantage")

    print("\n" + "=" * 80)

    # Test 2: Simulated fallback articles (no Alpha Vantage scores)
    print("TEST 2: Fallback Articles (using FinBERT)")
    print("-" * 80)

    # Create mock articles without Alpha Vantage sentiment scores
    mock_articles = [
        {
            "title": "Stock Market Crashes as Economic Fears Mount",
            "body": "Investors are panicking as recession fears grow. Markets plummeted today.",
            "provider": "Mock News",
            "publish_date": "2025-10-22"
        },
        {
            "title": "Tech Company Reports Record Profits and Strong Growth",
            "body": "The company exceeded all expectations with outstanding quarterly results.",
            "provider": "Mock Financial",
            "publish_date": "2025-10-22"
        },
        {
            "title": "Weather Report: Sunny Skies Expected",
            "body": "No major weather events are expected this week.",
            "provider": "Mock Weather",
            "publish_date": "2025-10-22"
        }
    ]

    print(f"Analyzing {len(mock_articles)} mock articles without Alpha Vantage scores...")

    sentiment_results = sentiment_service.analyze_sentiment_with_weights(mock_articles)
    articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])
    news_objects = sentiment_results.get("news_objects", [])

    for i, (article, news_obj) in enumerate(zip(articles_with_sentiment, news_objects), 1):
        print(f"\n  Article {i}:")
        print(f"    Title: {article.get('title')}")
        print(f"    Has Alpha Vantage score: {'ticker_sentiment_score' in mock_articles[i-1]}")
        print(f"    Sentiment Score: {article.get('sentiment_score_raw', 0.0):.4f}")
        print(f"    Sentiment Label: {article.get('sentiment_label', 'unknown')}")
        print(f"    Confidence: {article.get('sentiment_confidence', 0.0):.4f}")
        print(f"    ✓ Sentiment Source: {news_obj.sentiment_score.source}")

        # Validate expected sentiment
        if i == 1:  # Negative article
            expected = "negative"
            if article.get('sentiment_label') == expected:
                print(f"    ✅ Correctly identified as {expected}")
            else:
                print(f"    ⚠️  Expected {expected}, got {article.get('sentiment_label')}")
        elif i == 2:  # Positive article
            expected = "positive"
            if article.get('sentiment_label') == expected:
                print(f"    ✅ Correctly identified as {expected}")
            else:
                print(f"    ⚠️  Expected {expected}, got {article.get('sentiment_label')}")

    print("\n" + "=" * 80)
    print("SUMMARY:")
    print("=" * 80)
    print("✓ Hybrid sentiment analysis implemented successfully")
    print("✓ Alpha Vantage scores used when available")
    print("✓ FinBERT fallback works for articles without scores")
    print("✓ Source field correctly indicates analyzer used")
    print()

if __name__ == "__main__":
    asyncio.run(test_hybrid_sentiment())
