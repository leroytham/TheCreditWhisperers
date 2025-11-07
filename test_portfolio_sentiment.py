#!/usr/bin/env python3
"""
Test script for portfolio sentiment endpoints
"""

import requests
import json
from datetime import datetime

# Backend base URL
BASE_URL = "http://localhost:8000/api"

# Test parameters
USERNAME = "john_doe"
ACCOUNT_NAME = "Investment Account"

def test_portfolio_daily_sentiment():
    """Test the portfolio daily sentiment endpoint"""
    print("\n=== Testing Portfolio Daily Sentiment ===")

    # Test different timeframes
    timeframes = ["1W", "1M", "3M", "6M", "YTD", "1Y"]

    for timeframe in timeframes:
        url = f"{BASE_URL}/portfolio/daily-sentiment/{USERNAME}/{ACCOUNT_NAME}"
        params = {"timeframe": timeframe}

        print(f"\nTesting timeframe: {timeframe}")
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Success! Got {len(data.get('daily', {}))} days of data")
                print(f"  Holdings count: {data.get('holdings_count', 0)}")
                print(f"  Valid holdings: {data.get('valid_holdings', 0)}")
                if data.get('metadata'):
                    print(f"  Dominant topic: {data['metadata'].get('dominant_topic', 'N/A')}")
                    print(f"  Coverage: {data['metadata'].get('holdings_coverage', 0):.1%}")
            else:
                print(f"✗ Error {response.status_code}: {response.text[:100]}")
        except Exception as e:
            print(f"✗ Request failed: {e}")

def test_portfolio_rolling_sentiment():
    """Test the portfolio rolling sentiment endpoint"""
    print("\n=== Testing Portfolio Rolling Sentiment ===")

    # Test different timeframes
    timeframes = ["1D", "1W", "1M", "3M", "6M", "1Y"]

    for timeframe in timeframes:
        url = f"{BASE_URL}/portfolio/rolling-sentiment/{USERNAME}/{ACCOUNT_NAME}"
        params = {"timeframe": timeframe}

        print(f"\nTesting timeframe: {timeframe}")
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Success! Got {len(data.get('data', []))} data points")
                print(f"  Holdings count: {data.get('holdings_count', 0)}")
                print(f"  Valid holdings: {data.get('valid_holdings', 0)}")
                print(f"  Coverage: {data.get('coverage', 0):.1%}")
            else:
                print(f"✗ Error {response.status_code}: {response.text[:100]}")
        except Exception as e:
            print(f"✗ Request failed: {e}")

def test_portfolio_sector_sentiment():
    """Test the portfolio sector sentiment endpoint"""
    print("\n=== Testing Portfolio Sector Sentiment ===")

    url = f"{BASE_URL}/portfolio/sentiment/{USERNAME}/{ACCOUNT_NAME}"

    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Success!")
            print(f"  Overall sentiment: {data.get('overall_sentiment', 0):.4f}")
            print(f"  Total portfolio value: ${data.get('total_portfolio_value', 0):,.2f}")

            sectors = data.get('sentiment_by_sector', {})
            print(f"  Number of sectors: {len(sectors)}")

            for sector, info in list(sectors.items())[:3]:  # Show first 3 sectors
                print(f"\n  {sector}:")
                print(f"    Sentiment: {info.get('sentiment_score', 0):.4f}")
                print(f"    Holdings: {info.get('holdings_count', 0)}")
                print(f"    Weight: {info.get('weight_in_portfolio', 0):.1%}")
        else:
            print(f"✗ Error {response.status_code}: {response.text[:100]}")
    except Exception as e:
        print(f"✗ Request failed: {e}")

def main():
    """Run all tests"""
    print("=" * 60)
    print("Portfolio Sentiment API Test Suite")
    print(f"Testing account: {USERNAME} / {ACCOUNT_NAME}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 60)

    test_portfolio_daily_sentiment()
    test_portfolio_rolling_sentiment()
    test_portfolio_sector_sentiment()

    print("\n" + "=" * 60)
    print("Test suite completed!")
    print("=" * 60)

if __name__ == "__main__":
    main()