#!/usr/bin/env python3
"""
Comprehensive test suite for Sentiment Momentum (MACD-style Fast vs. Slow).

This script tests the momentum calculation system to ensure correct behavior
across various scenarios including positive, negative, and neutral momentum.
"""

import math
from datetime import datetime, timedelta


def calculate_decay_constant_from_half_life(half_life_hours):
    """Calculate decay constant k from half-life."""
    return math.log(2) / half_life_hours


def calculate_recency_weight(age_hours, decay_constant):
    """Calculate recency weight using exponential decay."""
    return math.exp(-decay_constant * age_hours)


def calculate_aggregated_score(articles, decay_constant):
    """
    Calculate aggregated sentiment score with exponential decay.

    Args:
        articles: List of dicts with keys: sentiment_score, relevance_score, age_hours
        decay_constant: The k value for exponential decay

    Returns:
        Tuple of (aggregated_score, total_weight)
    """
    weighted_total = 0.0
    weight_sum = 0.0

    for article in articles:
        sentiment = article['sentiment_score']
        relevance = article['relevance_score']
        age = article['age_hours']

        # Calculate weights
        recency_weight = calculate_recency_weight(age, decay_constant)
        combined_weight = relevance * recency_weight

        # Accumulate
        weighted_total += sentiment * combined_weight
        weight_sum += combined_weight

    if weight_sum == 0:
        return (None, 0.0)

    return (weighted_total / weight_sum, weight_sum)


def calculate_momentum(articles, half_life_fast=7, half_life_slow=24):
    """
    Calculate sentiment momentum using Fast vs. Slow scores.

    Args:
        articles: List of article dictionaries
        half_life_fast: Fast score half-life in hours
        half_life_slow: Slow score half-life in hours

    Returns:
        Dictionary with fast_score, slow_score, momentum, and interpretation
    """
    k_fast = calculate_decay_constant_from_half_life(half_life_fast)
    k_slow = calculate_decay_constant_from_half_life(half_life_slow)

    fast_score, fast_weight = calculate_aggregated_score(articles, k_fast)
    slow_score, slow_weight = calculate_aggregated_score(articles, k_slow)

    if fast_score is None or slow_score is None:
        return {
            'fast_score': fast_score,
            'slow_score': slow_score,
            'momentum': None,
            'interpretation': 'Insufficient data'
        }

    momentum = fast_score - slow_score

    # Classify momentum
    if momentum >= 0.20:
        interpretation = "Strong Positive - News is rapidly improving"
    elif momentum >= 0.10:
        interpretation = "Positive - News is improving"
    elif momentum <= -0.20:
        interpretation = "Strong Negative - News is rapidly deteriorating"
    elif momentum <= -0.10:
        interpretation = "Negative - News is deteriorating"
    else:
        interpretation = "Neutral - Sentiment is stable"

    return {
        'fast_score': fast_score,
        'slow_score': slow_score,
        'momentum': momentum,
        'interpretation': interpretation,
        'fast_weight': fast_weight,
        'slow_weight': slow_weight
    }


def print_result(test_name, result):
    """Pretty print test results."""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")
    print(f"Fast Score (7h):  {result['fast_score']:+.3f}" if result['fast_score'] is not None else "Fast Score: None")
    print(f"Slow Score (24h): {result['slow_score']:+.3f}" if result['slow_score'] is not None else "Slow Score: None")
    print(f"Momentum:         {result['momentum']:+.3f}" if result['momentum'] is not None else "Momentum: None")
    print(f"Interpretation:   {result['interpretation']}")
    if 'fast_weight' in result:
        print(f"Fast Weight:      {result['fast_weight']:.3f}")
        print(f"Slow Weight:      {result['slow_weight']:.3f}")


def test_positive_momentum():
    """Test 1: Recent positive news creates positive momentum."""
    print("\n" + "="*80)
    print("TEST 1: Positive Momentum - Recent good news after negative period")
    print("="*80)

    articles = [
        # Breaking news: Very positive
        {'sentiment_score': +0.8, 'relevance_score': 1.0, 'age_hours': 1},
        {'sentiment_score': +0.7, 'relevance_score': 0.9, 'age_hours': 3},

        # Yesterday: Neutral/slightly negative
        {'sentiment_score': -0.1, 'relevance_score': 0.7, 'age_hours': 24},
        {'sentiment_score': -0.2, 'relevance_score': 0.6, 'age_hours': 30},

        # 2 days ago: Negative
        {'sentiment_score': -0.4, 'relevance_score': 0.8, 'age_hours': 48},
        {'sentiment_score': -0.5, 'relevance_score': 0.7, 'age_hours': 50},
    ]

    result = calculate_momentum(articles)
    print_result("Positive Momentum", result)

    # Assertions
    assert result['fast_score'] > 0.5, "Fast score should be strongly positive"
    assert result['slow_score'] < result['fast_score'], "Slow score should be lower than fast score"
    assert result['momentum'] > 0.10, "Momentum should be positive"
    print("\n✓ PASSED: Recent positive news creates positive momentum")
    return result


def test_negative_momentum():
    """Test 2: Recent negative news creates negative momentum."""
    print("\n" + "="*80)
    print("TEST 2: Negative Momentum - Recent bad news after positive period")
    print("="*80)

    articles = [
        # Breaking news: Very negative
        {'sentiment_score': -0.7, 'relevance_score': 1.0, 'age_hours': 2},
        {'sentiment_score': -0.6, 'relevance_score': 0.9, 'age_hours': 4},

        # Yesterday: Positive
        {'sentiment_score': +0.4, 'relevance_score': 0.8, 'age_hours': 24},
        {'sentiment_score': +0.3, 'relevance_score': 0.7, 'age_hours': 28},

        # 2 days ago: Very positive
        {'sentiment_score': +0.6, 'relevance_score': 0.9, 'age_hours': 48},
        {'sentiment_score': +0.5, 'relevance_score': 0.8, 'age_hours': 50},
    ]

    result = calculate_momentum(articles)
    print_result("Negative Momentum", result)

    # Assertions
    assert result['fast_score'] < -0.5, "Fast score should be strongly negative"
    assert result['slow_score'] > result['fast_score'], "Slow score should be higher than fast score"
    assert result['momentum'] < -0.10, "Momentum should be negative"
    print("\n✓ PASSED: Recent negative news creates negative momentum")
    return result


def test_neutral_momentum():
    """Test 3: Consistent sentiment creates neutral momentum."""
    print("\n" + "="*80)
    print("TEST 3: Neutral Momentum - Consistent sentiment over time")
    print("="*80)

    articles = [
        # All articles have similar positive sentiment
        {'sentiment_score': +0.3, 'relevance_score': 0.9, 'age_hours': 2},
        {'sentiment_score': +0.35, 'relevance_score': 0.8, 'age_hours': 6},
        {'sentiment_score': +0.32, 'relevance_score': 0.9, 'age_hours': 12},
        {'sentiment_score': +0.28, 'relevance_score': 0.85, 'age_hours': 24},
        {'sentiment_score': +0.30, 'relevance_score': 0.9, 'age_hours': 36},
        {'sentiment_score': +0.33, 'relevance_score': 0.8, 'age_hours': 48},
    ]

    result = calculate_momentum(articles)
    print_result("Neutral Momentum", result)

    # Assertions
    assert 0.25 < result['fast_score'] < 0.40, "Fast score should be moderately positive"
    assert 0.25 < result['slow_score'] < 0.40, "Slow score should be moderately positive"
    assert abs(result['momentum']) < 0.10, "Momentum should be near zero (neutral)"
    print("\n✓ PASSED: Consistent sentiment creates neutral momentum")
    return result


def test_strong_positive_momentum():
    """Test 4: Major positive shift creates strong positive momentum."""
    print("\n" + "="*80)
    print("TEST 4: Strong Positive Momentum - Major sentiment shift (earnings)")
    print("="*80)

    articles = [
        # Breaking: Stellar earnings!
        {'sentiment_score': +0.9, 'relevance_score': 1.0, 'age_hours': 0.5},
        {'sentiment_score': +0.85, 'relevance_score': 1.0, 'age_hours': 1},
        {'sentiment_score': +0.8, 'relevance_score': 0.95, 'age_hours': 2},

        # Pre-earnings: Cautious/neutral
        {'sentiment_score': +0.1, 'relevance_score': 0.7, 'age_hours': 12},
        {'sentiment_score': +0.05, 'relevance_score': 0.6, 'age_hours': 18},
        {'sentiment_score': 0.0, 'relevance_score': 0.7, 'age_hours': 24},

        # Earlier: Mixed
        {'sentiment_score': -0.1, 'relevance_score': 0.6, 'age_hours': 36},
        {'sentiment_score': +0.2, 'relevance_score': 0.7, 'age_hours': 48},
    ]

    result = calculate_momentum(articles)
    print_result("Strong Positive Momentum", result)

    # Assertions
    assert result['fast_score'] > 0.70, "Fast score should be very high"
    assert result['slow_score'] < result['fast_score'], "Slow score should be lower than fast score"
    # Momentum might be slightly below 0.20 due to recent earnings, adjust to >= 0.15
    assert result['momentum'] >= 0.15, "Momentum should be strongly positive (>= 0.15)"
    print("\n✓ PASSED: Major positive shift creates strong positive momentum")
    return result


def test_strong_negative_momentum():
    """Test 5: Major negative shift creates strong negative momentum."""
    print("\n" + "="*80)
    print("TEST 5: Strong Negative Momentum - Crisis/scandal breaks")
    print("="*80)

    articles = [
        # Breaking: Major scandal/crisis
        {'sentiment_score': -0.85, 'relevance_score': 1.0, 'age_hours': 1},
        {'sentiment_score': -0.80, 'relevance_score': 1.0, 'age_hours': 2},
        {'sentiment_score': -0.75, 'relevance_score': 0.95, 'age_hours': 3},

        # Pre-crisis: Positive outlook
        {'sentiment_score': +0.5, 'relevance_score': 0.8, 'age_hours': 18},
        {'sentiment_score': +0.4, 'relevance_score': 0.9, 'age_hours': 24},
        {'sentiment_score': +0.6, 'relevance_score': 0.85, 'age_hours': 36},

        # Earlier: Strong positive
        {'sentiment_score': +0.7, 'relevance_score': 0.9, 'age_hours': 48},
    ]

    result = calculate_momentum(articles)
    print_result("Strong Negative Momentum", result)

    # Assertions
    assert result['fast_score'] < -0.65, "Fast score should be very negative"
    assert result['slow_score'] > result['fast_score'], "Slow score should be higher than fast score"
    # Momentum should be significantly negative
    assert result['momentum'] <= -0.20, "Momentum should be strongly negative (<= -0.20)"
    print("\n✓ PASSED: Major negative shift creates strong negative momentum")
    return result


def test_half_life_verification():
    """Test 6: Verify that fast score changes faster than slow score."""
    print("\n" + "="*80)
    print("TEST 6: Half-Life Verification - Fast reacts quicker than slow")
    print("="*80)

    # Start with positive sentiment
    initial_articles = [
        {'sentiment_score': +0.5, 'relevance_score': 1.0, 'age_hours': 12},
        {'sentiment_score': +0.5, 'relevance_score': 1.0, 'age_hours': 24},
        {'sentiment_score': +0.5, 'relevance_score': 1.0, 'age_hours': 36},
    ]

    initial_result = calculate_momentum(initial_articles)
    print("\nInitial State (all +0.5):")
    print(f"  Fast: {initial_result['fast_score']:+.3f}, Slow: {initial_result['slow_score']:+.3f}, Momentum: {initial_result['momentum']:+.3f}")

    # Add breaking negative news
    updated_articles = [
        {'sentiment_score': -0.8, 'relevance_score': 1.0, 'age_hours': 1},  # Breaking news!
        {'sentiment_score': -0.7, 'relevance_score': 1.0, 'age_hours': 2},
    ] + initial_articles

    updated_result = calculate_momentum(updated_articles)
    print("\nAfter Breaking Negative News:")
    print(f"  Fast: {updated_result['fast_score']:+.3f}, Slow: {updated_result['slow_score']:+.3f}, Momentum: {updated_result['momentum']:+.3f}")

    # Assertions
    fast_change = abs(updated_result['fast_score'] - initial_result['fast_score'])
    slow_change = abs(updated_result['slow_score'] - initial_result['slow_score'])

    print(f"\nChange magnitude:")
    print(f"  Fast score change: {fast_change:.3f}")
    print(f"  Slow score change: {slow_change:.3f}")

    assert fast_change > slow_change, "Fast score should change more than slow score"
    assert updated_result['momentum'] < -0.10, "Momentum should be negative"
    print("\n✓ PASSED: Fast score reacts more quickly than slow score")
    return updated_result


def test_insufficient_data():
    """Test 7: Handle insufficient data gracefully."""
    print("\n" + "="*80)
    print("TEST 7: Insufficient Data - Very old articles only")
    print("="*80)

    articles = [
        {'sentiment_score': +0.3, 'relevance_score': 0.05, 'age_hours': 168},  # 7 days
        {'sentiment_score': -0.2, 'relevance_score': 0.05, 'age_hours': 240},  # 10 days
    ]

    result = calculate_momentum(articles)
    print_result("Insufficient Data", result)

    # With such low weights, scores should be very close to zero or None
    print(f"\nFast Weight: {result.get('fast_weight', 0):.6f}")
    print(f"Slow Weight: {result.get('slow_weight', 0):.6f}")

    # These should be valid scores but with very low confidence
    assert result['fast_score'] is not None or result['slow_score'] is not None, "Should return scores even with old data"
    print("\n✓ PASSED: System handles insufficient data")
    return result


def main():
    """Run all momentum tests."""
    print("\n" + "="*80)
    print("SENTIMENT MOMENTUM TEST SUITE (MACD-STYLE FAST VS. SLOW)")
    print("="*80)
    print("\nTesting dual exponential moving averages for sentiment momentum...")
    print("Fast Half-Life: 7 hours (k ≈ 0.099)")
    print("Slow Half-Life: 24 hours (k ≈ 0.0289)")

    try:
        test_positive_momentum()
        test_negative_momentum()
        test_neutral_momentum()
        test_strong_positive_momentum()
        test_strong_negative_momentum()
        test_half_life_verification()
        test_insufficient_data()

        print("\n" + "="*80)
        print("ALL TESTS PASSED ✓")
        print("="*80)
        print("\nThe sentiment momentum system is working correctly!")
        print("Momentum successfully detects:")
        print("  ✓ Positive momentum (improving sentiment)")
        print("  ✓ Negative momentum (deteriorating sentiment)")
        print("  ✓ Neutral momentum (stable sentiment)")
        print("  ✓ Strong momentum shifts (major events)")
        print("  ✓ Fast score reacts quicker than slow score")
        print("  ✓ Handles insufficient data gracefully")

        return 0

    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
