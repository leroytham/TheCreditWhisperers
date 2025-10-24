#!/usr/bin/env python3
"""
Test script for exponential decay + relevance weighting sentiment analysis.

This script tests the new weighting algorithm with various scenarios to ensure
correct calculation of aggregated sentiment scores.
"""

import math
from datetime import datetime, timedelta

# Simulate the exponential decay function
def calculate_recency_weight(age_hours, decay_constant=0.0289):
    """Calculate recency weight using exponential decay."""
    return math.exp(-decay_constant * age_hours)

def calculate_combined_weight(relevance_score, recency_weight):
    """Calculate combined weight (relevance × recency)."""
    return relevance_score * recency_weight

def calculate_aggregated_score(articles):
    """
    Calculate weighted aggregated sentiment score.

    Args:
        articles: List of dicts with keys:
            - sentiment_score: float (-1 to 1)
            - relevance_score: float (0 < x <= 1)
            - age_hours: float (hours since publication)

    Returns:
        Tuple of (aggregated_score, total_weight, data_quality)
    """
    decay_constant = 0.0289  # 24-hour half-life
    weighted_total = 0.0
    weight_sum = 0.0

    for article in articles:
        sentiment = article['sentiment_score']
        relevance = article['relevance_score']
        age = article['age_hours']

        # Calculate weights
        recency_weight = calculate_recency_weight(age, decay_constant)
        combined_weight = calculate_combined_weight(relevance, recency_weight)

        # Accumulate weighted sentiment
        weighted_total += sentiment * combined_weight
        weight_sum += combined_weight

        print(f"  Article: sentiment={sentiment:+.2f}, age={age:.1f}h, "
              f"recency={recency_weight:.3f}, relevance={relevance:.2f}, "
              f"combined_weight={combined_weight:.3f}")

    # Determine data quality
    if weight_sum >= 0.1:
        data_quality = "good"
    elif weight_sum > 0:
        data_quality = "low_confidence"
    else:
        data_quality = "insufficient_recent_data"

    # Calculate final score
    aggregated_score = weighted_total / weight_sum if weight_sum > 0 else None

    return aggregated_score, weight_sum, data_quality


def test_scenario_1():
    """Test 1: Recent positive news dominates old negative news."""
    print("\n" + "="*80)
    print("TEST 1: Recent positive news dominates old negative news")
    print("="*80)

    articles = [
        {'sentiment_score': +0.7, 'relevance_score': 0.9, 'age_hours': 2},     # Recent good news
        {'sentiment_score': +0.5, 'relevance_score': 0.8, 'age_hours': 12},    # Earlier good news
        {'sentiment_score': -0.3, 'relevance_score': 0.6, 'age_hours': 48},    # Old bad news
        {'sentiment_score': -0.4, 'relevance_score': 0.5, 'age_hours': 72},    # Very old bad news
    ]

    score, weight, quality = calculate_aggregated_score(articles)
    print(f"\nResult: Score={score:+.3f}, Total Weight={weight:.3f}, Quality={quality}")
    print(f"Expected: Positive score (recent news dominates)")
    assert score > 0, "Recent positive news should dominate!"
    print("✓ PASSED")


def test_scenario_2():
    """Test 2: High relevance articles have more impact."""
    print("\n" + "="*80)
    print("TEST 2: High relevance articles have more impact")
    print("="*80)

    articles = [
        {'sentiment_score': +0.8, 'relevance_score': 1.0, 'age_hours': 6},    # Highly relevant positive
        {'sentiment_score': -0.5, 'relevance_score': 0.2, 'age_hours': 6},    # Low relevance negative
    ]

    score, weight, quality = calculate_aggregated_score(articles)
    print(f"\nResult: Score={score:+.3f}, Total Weight={weight:.3f}, Quality={quality}")
    print(f"Expected: Positive score (high relevance dominates)")
    assert score > 0, "High relevance positive should dominate low relevance negative!"
    print("✓ PASSED")


def test_scenario_3():
    """Test 3: 24-hour half-life verification."""
    print("\n" + "="*80)
    print("TEST 3: 24-hour half-life verification")
    print("="*80)

    # Two identical articles, one at 0h, one at 24h
    articles = [
        {'sentiment_score': +0.5, 'relevance_score': 1.0, 'age_hours': 0},
        {'sentiment_score': +0.5, 'relevance_score': 1.0, 'age_hours': 24},
    ]

    score, weight, quality = calculate_aggregated_score(articles)

    # Calculate expected: (0.5*1.0 + 0.5*0.5) / (1.0 + 0.5) = 0.75 / 1.5 = 0.5
    recency_24h = calculate_recency_weight(24)
    print(f"\nRecency weight at 24 hours: {recency_24h:.3f}")
    print(f"Expected: ~0.5 (half-life)")
    assert 0.48 <= recency_24h <= 0.52, "24-hour weight should be ~0.5 (half-life)!"
    print("✓ PASSED")


def test_scenario_4():
    """Test 4: Insufficient data handling."""
    print("\n" + "="*80)
    print("TEST 4: Insufficient data (very old articles only)")
    print("="*80)

    # Only very old articles with low relevance
    articles = [
        {'sentiment_score': +0.3, 'relevance_score': 0.1, 'age_hours': 168},  # 7 days old, low relevance
        {'sentiment_score': -0.2, 'relevance_score': 0.1, 'age_hours': 336},  # 14 days old, low relevance
    ]

    score, weight, quality = calculate_aggregated_score(articles)
    score_str = f"{score:+.3f}" if score is not None else "None"
    print(f"\nResult: Score={score_str}, Total Weight={weight:.3f}, Quality={quality}")
    print(f"Expected: low_confidence or insufficient_recent_data (total weight < 0.1)")
    assert quality in ["low_confidence", "insufficient_recent_data"], "Should flag insufficient data!"
    print("✓ PASSED")


def test_scenario_5():
    """Test 5: Real-world example - Apple earnings announcement."""
    print("\n" + "="*80)
    print("TEST 5: Real-world scenario - Apple earnings announcement")
    print("="*80)

    articles = [
        # Breaking news: Strong earnings
        {'sentiment_score': +0.8, 'relevance_score': 1.0, 'age_hours': 1},
        {'sentiment_score': +0.7, 'relevance_score': 0.95, 'age_hours': 2},

        # Yesterday: Analyst upgrade
        {'sentiment_score': +0.4, 'relevance_score': 0.8, 'age_hours': 24},

        # 2 days ago: Mixed sentiment
        {'sentiment_score': +0.1, 'relevance_score': 0.6, 'age_hours': 48},
        {'sentiment_score': -0.2, 'relevance_score': 0.5, 'age_hours': 50},

        # 3 days ago: Concerns about supply chain (should have minimal impact)
        {'sentiment_score': -0.5, 'relevance_score': 0.7, 'age_hours': 72},
    ]

    score, weight, quality = calculate_aggregated_score(articles)
    print(f"\nResult: Score={score:+.3f}, Total Weight={weight:.3f}, Quality={quality}")
    print(f"Expected: Strongly positive (recent earnings news dominates)")
    assert score > 0.5, "Recent strong earnings should result in positive sentiment!"
    assert quality == "good", "Should have good data quality!"
    print("✓ PASSED")


def test_decay_curve():
    """Test 6: Verify exponential decay curve values."""
    print("\n" + "="*80)
    print("TEST 6: Exponential decay curve verification")
    print("="*80)

    decay_constant = 0.0289
    test_points = [0, 6, 12, 24, 48, 72, 168, 336]

    print("\nAge (hours) | Recency Weight | % of Original")
    print("-" * 50)

    for age in test_points:
        weight = calculate_recency_weight(age, decay_constant)
        percent = weight * 100
        print(f"{age:11.0f} | {weight:14.4f} | {percent:12.1f}%")

    # Verify key points
    weight_24h = calculate_recency_weight(24, decay_constant)
    assert 0.48 <= weight_24h <= 0.52, "24h should be ~50%"

    weight_48h = calculate_recency_weight(48, decay_constant)
    assert 0.23 <= weight_48h <= 0.27, "48h should be ~25%"

    weight_7d = calculate_recency_weight(168, decay_constant)
    assert weight_7d < 0.05, "7 days should be < 5%"

    print("\n✓ PASSED")


def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("EXPONENTIAL DECAY + RELEVANCE WEIGHTING TEST SUITE")
    print("="*80)
    print("\nFormula: RecencyWeight = e^(-k × age_hours)")
    print(f"         CombinedWeight = relevance_score × RecencyWeight")
    print(f"         AggregatedScore = Σ(sentiment × CombinedWeight) / Σ(CombinedWeight)")
    print(f"\nDecay constant k = 0.0289 (24-hour half-life)")

    try:
        test_scenario_1()
        test_scenario_2()
        test_scenario_3()
        test_scenario_4()
        test_scenario_5()
        test_decay_curve()

        print("\n" + "="*80)
        print("ALL TESTS PASSED ✓")
        print("="*80)
        print("\nThe exponential decay + relevance weighting algorithm is working correctly!")

    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
