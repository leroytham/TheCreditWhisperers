# tests/services/test_sector_sentiment_service.py

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
import math
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.sector_sentiment_service import SectorSentimentService


class TestSectorSentimentService:
    """Test suite for SectorSentimentService"""

    @pytest.fixture
    def service(self):
        """Create a service instance for testing"""
        return SectorSentimentService()

    @pytest.fixture
    def mock_sector_tickers(self):
        """Sample sector tickers"""
        return {"AAPL", "MSFT", "GOOGL", "NVDA"}

    @pytest.fixture
    def mock_article_with_ticker_sentiment(self):
        """Mock article with ticker sentiment data"""
        return {
            "title": "Tech stocks rally",
            "url": "http://example.com/article1",
            "publish_date": "2024-01-15",
            "publish_timestamp": "2024-01-15T10:00:00",
            "ticker_sentiment": [
                {
                    "ticker": "AAPL",
                    "ticker_sentiment_score": 0.5,
                    "ticker_sentiment_label": "Bullish",
                    "relevance_score": 0.8
                },
                {
                    "ticker": "MSFT",
                    "ticker_sentiment_score": 0.3,
                    "ticker_sentiment_label": "Somewhat-Bullish",
                    "relevance_score": 0.6
                },
                {
                    "ticker": "TSLA",  # Not in sector
                    "ticker_sentiment_score": 0.2,
                    "ticker_sentiment_label": "Neutral",
                    "relevance_score": 0.5
                }
            ]
        }

    def test_singleton_pattern(self):
        """Test that SectorSentimentService implements singleton pattern"""
        service1 = SectorSentimentService()
        service2 = SectorSentimentService()
        assert service1 is service2

    def test_initialization(self, service):
        """Test service initialization"""
        assert hasattr(service, 'half_life_fast')
        assert hasattr(service, 'half_life_slow')
        assert hasattr(service, 'k_fast')
        assert hasattr(service, 'k_slow')
        assert service.k_fast > 0
        assert service.k_slow > 0

    def test_extract_ticker_mentions_filters_by_sector(self, service, mock_article_with_ticker_sentiment, mock_sector_tickers):
        """Test that only tickers in sector are extracted"""
        now_utc = datetime.now(timezone.utc)

        mentions = service._extract_ticker_mentions(
            mock_article_with_ticker_sentiment,
            mock_sector_tickers,
            now_utc
        )

        # Should only include AAPL and MSFT (in sector), not TSLA
        tickers = [m["ticker"] for m in mentions]
        assert "AAPL" in tickers
        assert "MSFT" in tickers
        assert "TSLA" not in tickers
        assert len(mentions) == 2

    def test_extract_ticker_mentions_filters_low_relevance(self, service, mock_sector_tickers):
        """Test that low relevance mentions are filtered out"""
        article = {
            "title": "Test",
            "publish_date": "2024-01-15",
            "ticker_sentiment": [
                {
                    "ticker": "AAPL",
                    "ticker_sentiment_score": 0.5,
                    "ticker_sentiment_label": "Bullish",
                    "relevance_score": 0.05  # Below threshold
                },
                {
                    "ticker": "MSFT",
                    "ticker_sentiment_score": 0.3,
                    "ticker_sentiment_label": "Bullish",
                    "relevance_score": 0.8  # Above threshold
                }
            ]
        }

        now_utc = datetime.now(timezone.utc)
        mentions = service._extract_ticker_mentions(article, mock_sector_tickers, now_utc)

        # Should only include MSFT (high relevance)
        assert len(mentions) == 1
        assert mentions[0]["ticker"] == "MSFT"

    def test_extract_ticker_mentions_no_ticker_sentiment(self, service, mock_sector_tickers):
        """Test article with no ticker_sentiment field"""
        article = {
            "title": "Test article",
            "publish_date": "2024-01-15"
        }

        now_utc = datetime.now(timezone.utc)
        mentions = service._extract_ticker_mentions(article, mock_sector_tickers, now_utc)

        assert mentions == []

    def test_extract_ticker_mentions_calculates_age(self, service, mock_sector_tickers):
        """Test that article age is calculated correctly"""
        article = {
            "title": "Test",
            "publish_timestamp": "2024-01-15T10:00:00Z",
            "ticker_sentiment": [
                {
                    "ticker": "AAPL",
                    "ticker_sentiment_score": 0.5,
                    "ticker_sentiment_label": "Bullish",
                    "relevance_score": 0.8
                }
            ]
        }

        now_utc = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)  # 2 hours later
        mentions = service._extract_ticker_mentions(article, mock_sector_tickers, now_utc)

        assert len(mentions) == 1
        # Age should be approximately 2 hours
        assert abs(mentions[0]["age_hours"] - 2.0) < 0.1

    def test_calculate_combined_weight(self, service):
        """Test combined weight calculation"""
        relevance = 0.8
        age_hours = 10.0
        decay_constant = service.k_fast

        weight = service._calculate_combined_weight(relevance, age_hours, decay_constant)

        # Weight should be relevance * exp(-k * age)
        expected_weight = relevance * math.exp(-decay_constant * age_hours)
        assert abs(weight - expected_weight) < 0.001

    def test_calculate_combined_weight_zero_age(self, service):
        """Test combined weight with zero age"""
        weight = service._calculate_combined_weight(0.8, 0, service.k_fast)

        # With zero age, recency weight should be 1.0
        assert abs(weight - 0.8) < 0.001

    def test_aggregate_ticker_mentions_basic(self, service):
        """Test basic ticker mention aggregation"""
        mentions = [
            {
                "ticker": "AAPL",
                "sentiment_score": 0.5,
                "relevance_score": 0.8,
                "age_hours": 1.0
            },
            {
                "ticker": "AAPL",
                "sentiment_score": 0.3,
                "relevance_score": 0.6,
                "age_hours": 2.0
            }
        ]

        aggregated_score, total_weight, breadth_data = service._aggregate_ticker_mentions(
            mentions,
            service.k_fast
        )

        # Should return a weighted average
        assert aggregated_score is not None
        assert total_weight > 0
        assert isinstance(breadth_data, dict)

    def test_aggregate_ticker_mentions_empty(self, service):
        """Test aggregation with empty mentions"""
        aggregated_score, total_weight, breadth_data = service._aggregate_ticker_mentions(
            [],
            service.k_fast
        )

        assert aggregated_score is None
        assert total_weight == 0.0

    def test_aggregate_ticker_mentions_counts_breadth(self, service):
        """Test that bullish/bearish counts are correct"""
        mentions = [
            {
                "ticker": "AAPL",
                "sentiment_score": 0.5,  # Bullish
                "relevance_score": 0.8,
                "age_hours": 1.0
            },
            {
                "ticker": "MSFT",
                "sentiment_score": -0.5,  # Bearish
                "relevance_score": 0.6,
                "age_hours": 1.0
            },
            {
                "ticker": "GOOGL",
                "sentiment_score": 0.0,  # Neutral
                "relevance_score": 0.7,
                "age_hours": 1.0
            }
        ]

        _, _, breadth_data = service._aggregate_ticker_mentions(mentions, service.k_fast)

        assert breadth_data["num_bullish"] == 1
        assert breadth_data["num_bearish"] == 1
        assert breadth_data["total_directional"] == 2

    def test_empty_breadth_data(self, service):
        """Test _empty_breadth_data helper"""
        breadth = service._empty_breadth_data()

        assert breadth["breadth_score"] == 0.0
        assert breadth["num_bullish"] == 0
        assert breadth["num_bearish"] == 0
        assert breadth["total_directional"] == 0

    def test_calculate_combined_weight_high_decay(self, service):
        """Test that older articles have lower weight with high decay constant"""
        weight_recent = service._calculate_combined_weight(1.0, 1.0, service.k_fast)
        weight_old = service._calculate_combined_weight(1.0, 100.0, service.k_fast)

        # Old article should have lower weight
        assert weight_old < weight_recent

    def test_extract_ticker_mentions_with_pre_parsed_datetime(self, service, mock_sector_tickers):
        """Test that pre-parsed datetime is used when provided"""
        article = {
            "title": "Test",
            "ticker_sentiment": [
                {
                    "ticker": "AAPL",
                    "ticker_sentiment_score": 0.5,
                    "ticker_sentiment_label": "Bullish",
                    "relevance_score": 0.8
                }
            ]
        }

        now_utc = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        pub_datetime = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)

        mentions = service._extract_ticker_mentions(
            article,
            mock_sector_tickers,
            now_utc,
            pub_datetime=pub_datetime
        )

        # Age should be 2 hours
        assert abs(mentions[0]["age_hours"] - 2.0) < 0.1

    def test_aggregate_ticker_mentions_stores_combined_weight(self, service):
        """Test that combined_weight is stored in mentions"""
        mentions = [
            {
                "ticker": "AAPL",
                "sentiment_score": 0.5,
                "relevance_score": 0.8,
                "age_hours": 1.0
            }
        ]

        service._aggregate_ticker_mentions(mentions, service.k_fast)

        # Check that combined_weight was added to mention
        assert "combined_weight" in mentions[0]
        assert mentions[0]["combined_weight"] > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
