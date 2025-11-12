# tests/services/test_portfolio_sentiment_service.py

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta, timezone
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.portfolio_sentiment_service import PortfolioSentimentService


class TestPortfolioSentimentService:
    """Test suite for PortfolioSentimentService"""

    @pytest.fixture
    def service(self):
        """Create a service instance for testing"""
        return PortfolioSentimentService()

    @pytest.fixture
    def mock_holdings(self):
        """Sample holdings data"""
        return [
            {"symbol": "AAPL", "quantity": 100, "market_value": 17000},
            {"symbol": "MSFT", "quantity": 50, "market_value": 19000},
            {"symbol": "GOOGL", "quantity": 30, "market_value": 4000}
        ]

    @pytest.fixture
    def mock_daily_sentiment_data(self):
        """Mock sentiment data for a single holding"""
        today = datetime.now(timezone.utc).date()
        return {
            "ticker": "AAPL",
            "daily": {
                today.strftime("%Y-%m-%d"): {
                    "score": 0.5,
                    "count": 10,
                    "headlines": [
                        {
                            "title": "Apple launches new product",
                            "provider": "Reuters",
                            "sentiment_score": 0.6,
                            "sentiment_label": "Positive",
                            "link": "http://example.com",
                            "relevance_score": 0.9
                        }
                    ]
                },
                (today - timedelta(days=1)).strftime("%Y-%m-%d"): {
                    "score": 0.3,
                    "count": 5,
                    "headlines": []
                }
            },
            "metadata": {
                "fast_score": 0.45,
                "slow_score": 0.40,
                "overall_weighted_score": 0.42,
                "sentiment_momentum": 0.05,
                "momentum_label": "Positive",
                "momentum_interpretation": "Building momentum",
                "momentum_quality": "good",
                "half_life_fast_hours": 24,
                "half_life_slow_hours": 168,
                "effective_news_volume": 5.2,
                "volume_interpretation": "Medium Coverage",
                "sentiment_breadth_score": 0.3,
                "num_bullish_articles": 8,
                "num_bearish_articles": 2,
                "total_directional_articles": 10,
                "breadth_interpretation": "Moderately Bullish",
                "breadth_quality": "good",
                "sentiment_z_score": 1.2,
                "z_score_interpretation": "Moderately Positive",
                "z_score_historical_mean": 0.2,
                "z_score_historical_std": 0.1,
                "z_score_days_of_history": 30,
                "z_score_quality": "good",
                "sentiment_volatility": 0.15,
                "volatility_quality": "good",
                "data_quality": "good",
                "source_concentration_hhi": 1200,
                "concentration_interpretation": "Well Diversified",
                "dominant_source": "Reuters",
                "top_sources": [{"source": "Reuters", "percentage": 60}],
                "dominant_topic": "Earnings",
                "topic_distribution": {"Earnings": 0.6, "Products": 0.4},
                "sentiment_by_topic": {"Earnings": 0.5, "Products": 0.4},
                "source_breakdown": {"Reuters": 60, "Bloomberg": 40}
            }
        }

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_basic(self, service, mock_holdings):
        """Test basic portfolio sentiment aggregation"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            # Mock return data for each holding
            today = datetime.now(timezone.utc).date()
            mock_fetch.return_value = {
                "ticker": "AAPL",
                "daily": {
                    today.strftime("%Y-%m-%d"): {"score": 0.5, "count": 10, "headlines": []}
                },
                "metadata": {
                    "fast_score": 0.5,
                    "slow_score": 0.4,
                    "overall_weighted_score": 0.45,
                    "sentiment_momentum": 0.1,
                    "effective_news_volume": 5.0,
                    "sentiment_breadth_score": 0.2,
                    "num_bullish_articles": 6,
                    "num_bearish_articles": 4,
                    "total_directional_articles": 10,
                    "sentiment_volatility": 0.1
                }
            }

            result = await service.get_portfolio_daily_sentiment(mock_holdings, days=1)

            # Assertions
            assert "daily" in result
            assert "metadata" in result
            assert result["holdings_count"] == 3
            assert result["valid_holdings"] == 3
            assert mock_fetch.call_count == 3

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_with_weights(self, service, mock_holdings):
        """Test that holdings are weighted correctly by market value"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            today = datetime.now(timezone.utc).date()
            date_str = today.strftime("%Y-%m-%d")

            # Different sentiment scores for different holdings
            async def fetch_side_effect(symbol, **kwargs):
                scores = {"AAPL": 0.8, "MSFT": 0.6, "GOOGL": 0.2}
                return {
                    "ticker": symbol,
                    "daily": {
                        date_str: {"score": scores.get(symbol, 0), "count": 10, "headlines": []}
                    },
                    "metadata": {
                        "fast_score": scores.get(symbol, 0),
                        "slow_score": scores.get(symbol, 0),
                        "overall_weighted_score": scores.get(symbol, 0),
                        "sentiment_momentum": 0.0,
                        "effective_news_volume": 5.0,
                        "sentiment_breadth_score": 0.0,
                        "num_bullish_articles": 5,
                        "num_bearish_articles": 5,
                        "total_directional_articles": 10,
                        "sentiment_volatility": 0.1
                    }
                }

            mock_fetch.side_effect = fetch_side_effect

            result = await service.get_portfolio_daily_sentiment(mock_holdings, days=1)

            # Calculate expected weighted score
            # Total value = 17000 + 19000 + 4000 = 40000
            # Weights: AAPL=0.425, MSFT=0.475, GOOGL=0.1
            # Expected score = 0.8*0.425 + 0.6*0.475 + 0.2*0.1 = 0.34 + 0.285 + 0.02 = 0.645
            expected_score = (0.8 * 17000 + 0.6 * 19000 + 0.2 * 4000) / 40000

            assert date_str in result["daily"]
            assert abs(result["daily"][date_str]["score"] - expected_score) < 0.01

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_empty_holdings(self, service):
        """Test with empty holdings list"""
        result = await service.get_portfolio_daily_sentiment([], days=7)

        assert result["holdings_count"] == 0
        assert result["valid_holdings"] == 0
        assert result["metadata"]["holdings_coverage"] == 0

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_invalid_holdings(self, service):
        """Test with holdings that have no market value"""
        invalid_holdings = [
            {"symbol": "AAPL", "quantity": 100, "market_value": 0},
            {"symbol": "", "quantity": 50, "market_value": 1000}
        ]

        result = await service.get_portfolio_daily_sentiment(invalid_holdings, days=7)

        assert result["holdings_count"] == 0
        assert result["valid_holdings"] == 0

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_timeframe_mapping(self, service, mock_holdings):
        """Test timeframe to days conversion"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "ticker": "AAPL",
                "daily": {},
                "metadata": {}
            }

            # Test various timeframes
            await service.get_portfolio_daily_sentiment(mock_holdings, timeframe='1M')
            # Check that fetch was called with timeframe parameter
            assert mock_fetch.call_args[1].get('timeframe') == '1M'

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_ytd_timeframe(self, service, mock_holdings):
        """Test YTD timeframe calculation"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {
                "ticker": "AAPL",
                "daily": {},
                "metadata": {}
            }

            result = await service.get_portfolio_daily_sentiment(mock_holdings, timeframe='YTD')

            # YTD should calculate days from start of year
            now = datetime.now(timezone.utc)
            start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)
            expected_days = (now - start_of_year).days

            # Check that the result contains the correct number of days
            assert len(result["daily"]) == expected_days

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_aggregates_metadata(self, service, mock_holdings):
        """Test that metadata is properly aggregated across holdings"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            today = datetime.now(timezone.utc).date()

            async def fetch_side_effect(symbol, **kwargs):
                return {
                    "ticker": symbol,
                    "daily": {
                        today.strftime("%Y-%m-%d"): {"score": 0.5, "count": 10, "headlines": []}
                    },
                    "metadata": {
                        "fast_score": 0.5,
                        "slow_score": 0.4,
                        "overall_weighted_score": 0.45,
                        "sentiment_momentum": 0.1,
                        "effective_news_volume": 5.0,
                        "sentiment_breadth_score": 0.2,
                        "num_bullish_articles": 6,
                        "num_bearish_articles": 4,
                        "total_directional_articles": 10,
                        "sentiment_volatility": 0.1,
                        "topic_distribution": {"Earnings": 0.6, "Products": 0.4},
                        "source_breakdown": {"Reuters": 0.6, "Bloomberg": 0.4}
                    }
                }

            mock_fetch.side_effect = fetch_side_effect

            result = await service.get_portfolio_daily_sentiment(mock_holdings, days=1)

            metadata = result["metadata"]
            # Check that metadata fields are present
            assert "fast_score" in metadata
            assert "slow_score" in metadata
            assert "overall_weighted_score" in metadata
            assert "sentiment_momentum" in metadata
            assert "effective_news_volume" in metadata
            assert "sentiment_breadth_score" in metadata
            assert "num_bullish_articles" in metadata
            assert "num_bearish_articles" in metadata
            # Check aggregated counts
            assert metadata["num_bullish_articles"] == 18  # 6 * 3 holdings
            assert metadata["num_bearish_articles"] == 12  # 4 * 3 holdings

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_handles_exceptions(self, service, mock_holdings):
        """Test that exceptions from individual holdings are handled gracefully"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            # First call succeeds, second raises exception, third succeeds
            mock_fetch.side_effect = [
                {
                    "ticker": "AAPL",
                    "daily": {datetime.now(timezone.utc).date().strftime("%Y-%m-%d"): {"score": 0.5, "count": 10, "headlines": []}},
                    "metadata": {"fast_score": 0.5, "slow_score": 0.4, "overall_weighted_score": 0.45}
                },
                Exception("API Error"),
                {
                    "ticker": "GOOGL",
                    "daily": {datetime.now(timezone.utc).date().strftime("%Y-%m-%d"): {"score": 0.3, "count": 5, "headlines": []}},
                    "metadata": {"fast_score": 0.3, "slow_score": 0.3, "overall_weighted_score": 0.3}
                }
            ]

            result = await service.get_portfolio_daily_sentiment(mock_holdings, days=1)

            # Should handle the error and return results from valid holdings
            assert result["holdings_count"] == 3
            assert result["valid_holdings"] == 2  # Only 2 succeeded

    @pytest.mark.asyncio
    async def test_get_portfolio_daily_sentiment_no_articles(self, service, mock_holdings):
        """Test holdings with no articles are not counted as valid"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            today = datetime.now(timezone.utc).date()

            async def fetch_side_effect(symbol, **kwargs):
                # Return data with count=0 (no articles)
                return {
                    "ticker": symbol,
                    "daily": {
                        today.strftime("%Y-%m-%d"): {"score": 0, "count": 0, "headlines": []}
                    },
                    "metadata": {}
                }

            mock_fetch.side_effect = fetch_side_effect

            result = await service.get_portfolio_daily_sentiment(mock_holdings, days=1)

            # Holdings with no articles should not be counted as valid
            assert result["valid_holdings"] == 0

    @pytest.mark.asyncio
    async def test_get_portfolio_rolling_sentiment_basic(self, service, mock_holdings):
        """Test rolling sentiment aggregation"""
        with patch.object(service, '_fetch_holding_rolling_sentiment', new_callable=AsyncMock) as mock_fetch:
            now = datetime.now(timezone.utc)
            mock_fetch.return_value = {
                "timeframe": "1W",
                "data": [
                    {
                        "timestamp": now.isoformat(),
                        "score": 0.5,
                        "article_count": 10,
                        "momentum": 0.1,
                        "headlines": []
                    }
                ]
            }

            result = await service.get_portfolio_rolling_sentiment(mock_holdings, timeframe="1W")

            assert "timeframe" in result
            assert "data" in result
            assert result["holdings_count"] == 3
            assert result["valid_holdings"] == 3

    @pytest.mark.asyncio
    async def test_get_portfolio_rolling_sentiment_weighted_aggregation(self, service, mock_holdings):
        """Test that rolling sentiment is weighted correctly"""
        with patch.object(service, '_fetch_holding_rolling_sentiment', new_callable=AsyncMock) as mock_fetch:
            now = datetime.now(timezone.utc)
            timestamp = now.replace(second=0, microsecond=0).isoformat()

            async def fetch_side_effect(symbol, timeframe):
                scores = {"AAPL": 0.8, "MSFT": 0.6, "GOOGL": 0.2}
                return {
                    "timeframe": timeframe,
                    "data": [
                        {
                            "timestamp": timestamp,
                            "score": scores.get(symbol, 0),
                            "article_count": 10,
                            "momentum": 0.0,
                            "headlines": []
                        }
                    ]
                }

            mock_fetch.side_effect = fetch_side_effect

            result = await service.get_portfolio_rolling_sentiment(mock_holdings, timeframe="1W")

            # Calculate expected weighted score
            # Total value = 40000, Weights: AAPL=0.425, MSFT=0.475, GOOGL=0.1
            expected_score = (0.8 * 17000 + 0.6 * 19000 + 0.2 * 4000) / 40000

            assert len(result["data"]) > 0
            assert abs(result["data"][0]["score"] - expected_score) < 0.01

    @pytest.mark.asyncio
    async def test_days_clamping(self, service, mock_holdings):
        """Test that days parameter is clamped to valid range"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {"ticker": "AAPL", "daily": {}, "metadata": {}}

            # Test minimum clamping
            result = await service.get_portfolio_daily_sentiment(mock_holdings, days=0)
            assert len(result["daily"]) == 1  # Should be clamped to 1

            # Test maximum clamping
            result = await service.get_portfolio_daily_sentiment(mock_holdings, days=10000)
            assert len(result["daily"]) == 7300  # Should be clamped to 7300

    @pytest.mark.asyncio
    async def test_topic_distribution_aggregation(self, service, mock_holdings):
        """Test that topic distribution is properly aggregated"""
        with patch.object(service, '_fetch_holding_daily_sentiment', new_callable=AsyncMock) as mock_fetch:
            today = datetime.now(timezone.utc).date()

            async def fetch_side_effect(symbol, **kwargs):
                return {
                    "ticker": symbol,
                    "daily": {
                        today.strftime("%Y-%m-%d"): {"score": 0.5, "count": 10, "headlines": []}
                    },
                    "metadata": {
                        "fast_score": 0.5,
                        "slow_score": 0.4,
                        "overall_weighted_score": 0.45,
                        "sentiment_momentum": 0.1,
                        "effective_news_volume": 5.0,
                        "sentiment_breadth_score": 0.2,
                        "num_bullish_articles": 6,
                        "num_bearish_articles": 4,
                        "total_directional_articles": 10,
                        "sentiment_volatility": 0.1,
                        "topic_distribution": {"Earnings": 0.7, "Products": 0.3},
                        "sentiment_by_topic": {"Earnings": 0.5, "Products": 0.3}
                    }
                }

            mock_fetch.side_effect = fetch_side_effect

            result = await service.get_portfolio_daily_sentiment(mock_holdings, days=1)

            metadata = result["metadata"]
            assert "topic_distribution" in metadata
            assert "dominant_topic" in metadata
            # Check that topics are present
            assert "Earnings" in metadata["topic_distribution"]
            assert "Products" in metadata["topic_distribution"]


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
