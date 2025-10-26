#!/usr/bin/env python3
"""
Quick diagnostic to test if the timeframe parameter is working in the API.
"""

import requests
import json

# Test the API directly
ticker = "AAPL"
base_url = "http://localhost:8000"  # Adjust if your backend runs on a different port

print("Testing /api/daily-sentiment endpoint with different timeframes...")
print("=" * 80)

timeframes = ['1W', '1M', '3M', '6M']

for tf in timeframes:
    url = f"{base_url}/api/daily-sentiment?ticker={ticker}&timeframe={tf}"
    print(f"\nTesting timeframe: {tf}")
    print(f"URL: {url}")

    try:
        response = requests.get(url, timeout=60)
        data = response.json()

        daily_data = data.get('daily', {})

        # Count how many days have articles
        days_with_articles = sum(1 for day_data in daily_data.values() if day_data['count'] > 0)
        total_days = len(daily_data)
        total_articles = sum(day_data['count'] for day_data in daily_data.values())

        print(f"  Total days in response: {total_days}")
        print(f"  Days with articles: {days_with_articles}")
        print(f"  Total articles across all days: {total_articles}")

        if days_with_articles > 0:
            dates_with_data = [date for date, day_data in daily_data.items() if day_data['count'] > 0]
            print(f"  Date range with data: {min(dates_with_data)} to {max(dates_with_data)}")
        else:
            print(f"  ⚠️  NO ARTICLES FOUND")

    except Exception as e:
        print(f"  ❌ Error: {e}")

print("\n" + "=" * 80)
print("\nExpected behavior:")
print("  • Longer timeframes (3M, 6M) should have MORE total days")
print("  • Longer timeframes should have MORE days with articles")
print("  • Longer timeframes should have MORE total articles")
print("\nIf all timeframes show similar results, the timeframe parameter isn't working.")
