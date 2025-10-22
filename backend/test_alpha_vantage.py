#!/usr/bin/env python3
"""
Debug script to test Alpha Vantage NEWS_SENTIMENT API directly.
This bypasses all application logic to see exactly what the API returns.
"""
import asyncio
import aiohttp
import json
from datetime import datetime

async def test_alpha_vantage():
    api_key = "14R274FT6K6GZP11"
    ticker = "NVDA"
    url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=1000&tickers={ticker}&apikey={api_key}"

    print(f"Testing Alpha Vantage API...")
    print(f"URL: {url}\n")

    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=30) as response:
            print(f"HTTP Status: {response.status}\n")
            data = await response.json()

            # Print response structure (first 2000 chars)
            print("=" * 80)
            print("RAW API RESPONSE (first 2000 characters):")
            print("=" * 80)
            print(json.dumps(data, indent=2)[:2000])
            print("\n")

            # Check what keys are in response
            print("=" * 80)
            print("RESPONSE KEYS:")
            print("=" * 80)
            print(f"Keys in response: {list(data.keys())}\n")

            # Check for error/info messages
            if "Information" in data:
                print(f"⚠️  API Information message: {data['Information']}\n")
            if "Note" in data:
                print(f"⚠️  API Note: {data['Note']}\n")
            if "Error Message" in data:
                print(f"❌ API Error: {data['Error Message']}\n")

            # Check for feed
            feed = data.get("feed", [])
            print("=" * 80)
            print("FEED ANALYSIS:")
            print("=" * 80)
            print(f"Number of articles in feed: {len(feed)}\n")

            if not feed:
                print("❌ No articles in feed - this is why news is empty!")
                return

            print(f"✓ Feed contains {len(feed)} articles\n")

            # Examine first article
            print("=" * 80)
            print("FIRST ARTICLE STRUCTURE:")
            print("=" * 80)
            first_article = feed[0]
            print(json.dumps(first_article, indent=2)[:1500])
            print("\n")

            # Check ticker_sentiment for NVDA
            print("=" * 80)
            print("TICKER SENTIMENT ANALYSIS:")
            print("=" * 80)
            ticker_sentiments = first_article.get("ticker_sentiment", [])
            print(f"Number of ticker_sentiment entries in first article: {len(ticker_sentiments)}\n")

            if ticker_sentiments:
                # Print all tickers mentioned
                tickers_found = [ts.get("ticker") for ts in ticker_sentiments]
                print(f"Tickers mentioned in first article: {tickers_found}\n")

                # Check if NVDA is in there
                nvda_sentiment = [ts for ts in ticker_sentiments if ts.get("ticker", "").upper() == "NVDA"]
                print(f"NVDA-specific sentiment found in first article: {len(nvda_sentiment) > 0}")

                if nvda_sentiment:
                    print(f"\n✓ NVDA sentiment data:")
                    print(json.dumps(nvda_sentiment[0], indent=2))
                else:
                    print(f"\n❌ No NVDA-specific sentiment in first article")
                    print("This means filtering would skip this article!")

            # Count how many articles have NVDA-specific sentiment
            print("\n" + "=" * 80)
            print("FULL FEED ANALYSIS:")
            print("=" * 80)
            nvda_count = 0
            for article in feed:
                ticker_sentiments = article.get("ticker_sentiment", [])
                for ts in ticker_sentiments:
                    if ts.get("ticker", "").upper() == "NVDA":
                        nvda_count += 1
                        break

            print(f"Total articles in feed: {len(feed)}")
            print(f"Articles with NVDA-specific sentiment: {nvda_count}")
            print(f"Articles that would be filtered out: {len(feed) - nvda_count}")
            print(f"\nPercentage kept after filtering: {(nvda_count / len(feed) * 100):.1f}%")

            if nvda_count == 0:
                print("\n❌ PROBLEM FOUND: No articles have NVDA-specific ticker_sentiment!")
                print("This is why your news endpoint returns empty results.")
                print("\nPossible solutions:")
                print("1. Use overall_sentiment_score instead of ticker-specific")
                print("2. Make ticker parameter optional in filtering")
                print("3. Use a different ticker that has more sentiment data")

if __name__ == "__main__":
    asyncio.run(test_alpha_vantage())
