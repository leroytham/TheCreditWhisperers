#!/usr/bin/env python3
"""
Test script for Earnings Call Transcript API endpoint.
Tests the earnings service and API routes.
"""

import asyncio
import sys
import os

# Add parent directory to path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.earnings_service import earnings_service


async def test_earnings_service():
    """Test the earnings service directly."""
    print("=" * 70)
    print("Testing Earnings Service")
    print("=" * 70)
    
    ticker = "IBM"
    quarter = "2024Q1"
    
    print(f"\n1. Fetching earnings transcript for {ticker} - {quarter}...")
    result = await earnings_service.fetch_earnings_transcript(ticker, quarter)
    
    if "error" in result:
        print(f"   ❌ Error: {result['error']}")
        return False
    else:
        print(f"   ✅ Success!")
        print(f"   Symbol: {result.get('symbol')}")
        print(f"   Quarter: {result.get('quarter')}")
        print(f"   Total Segments: {result.get('total_segments')}")
        
        if result.get('transcript'):
            first_segment = result['transcript'][0]
            print(f"\n   First Segment:")
            print(f"   - Speaker: {first_segment.get('speaker')}")
            print(f"   - Title: {first_segment.get('title')}")
            print(f"   - Sentiment: {first_segment.get('sentiment')}")
            print(f"   - Word Count: {first_segment.get('word_count')}")
            print(f"   - Content Preview: {first_segment.get('content', '')[:100]}...")
    
    print(f"\n2. Testing quarter validation...")
    
    # Test invalid quarter format
    invalid_quarters = ["2024", "2024Q5", "2024Q", "Q1", "abcd"]
    for q in invalid_quarters:
        is_valid = earnings_service._validate_quarter_format(q)
        status = "❌" if is_valid else "✅"
        print(f"   {status} {q}: {'Valid' if is_valid else 'Invalid'} (expected: Invalid)")
    
    # Test valid quarter format
    valid_quarters = ["2024Q1", "2023Q4", "2020Q2"]
    for q in valid_quarters:
        is_valid = earnings_service._validate_quarter_format(q)
        status = "✅" if is_valid else "❌"
        print(f"   {status} {q}: {'Valid' if is_valid else 'Invalid'} (expected: Valid)")
    
    print(f"\n3. Fetching available quarters for {ticker}...")
    quarters = await earnings_service.get_available_quarters(ticker, years_back=3)
    print(f"   ✅ Found {len(quarters)} potential quarters")
    print(f"   Most recent 5: {quarters[:5]}")
    
    return True


async def test_error_handling():
    """Test error handling for invalid inputs."""
    print("\n" + "=" * 70)
    print("Testing Error Handling")
    print("=" * 70)
    
    # Test invalid ticker
    print("\n1. Testing invalid ticker...")
    result = await earnings_service.fetch_earnings_transcript("INVALID_TICKER_XYZ", "2024Q1")
    if "error" in result:
        print(f"   ✅ Correctly handled error: {result['error']}")
    else:
        print(f"   ❌ Should have returned an error")
    
    # Test invalid quarter format
    print("\n2. Testing invalid quarter format...")
    result = await earnings_service.fetch_earnings_transcript("IBM", "2024Q5")
    if "error" in result and "Invalid quarter format" in result['error']:
        print(f"   ✅ Correctly handled error: {result['error']}")
    else:
        print(f"   ❌ Should have returned an error for invalid quarter")
    
    # Test very old quarter (likely no data)
    print("\n3. Testing quarter with no data...")
    result = await earnings_service.fetch_earnings_transcript("IBM", "2010Q1")
    if "error" in result or not result.get('transcript'):
        print(f"   ✅ Correctly handled missing data")
    else:
        print(f"   ⚠️  Unexpectedly found data for 2010Q1")


async def main():
    """Run all tests."""
    print("\n🚀 Starting Earnings Call Transcript API Tests\n")
    
    try:
        success = await test_earnings_service()
        await test_error_handling()
        
        print("\n" + "=" * 70)
        print("✅ All tests completed!")
        print("=" * 70)
        
        print("\nTo test the API endpoint, start the server with:")
        print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        print("\nThen visit:")
        print("  http://localhost:8000/api/stocks/IBM/earnings-transcript?quarter=2024Q1")
        print("  http://localhost:8000/api/stocks/IBM/earnings-quarters?years_back=5")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


if __name__ == "__main__":
    asyncio.run(main())
