# tests/services/test_sentiment_alert_service.py

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.sentiment_alert_service import SentimentAlertService


class TestSentimentAlertService:
    """Test suite for SentimentAlertService"""

    @pytest.fixture
    def service(self):
        """Create a service instance for testing"""
        return SentimentAlertService()

    @pytest.fixture
    def mock_sentiment_data(self):
        """Mock sentiment analysis data"""
        return {
            "overall_weighted_score": 0.6,
            "sentiment_momentum": 0.15,
            "fast_score": 0.65,
            "slow_score": 0.55
        }

    @pytest.fixture
    def mock_alert(self):
        """Mock sentiment alert"""
        from unittest.mock import MagicMock
        alert = MagicMock()
        alert.id = "alert_123"
        alert.user_id = "user_456"
        alert.ticker = "AAPL"
        alert.condition.value = "BECOMES_BULLISH"
        alert.threshold = 0.5
        alert.priority = "medium"
        alert.notification_title = "AAPL Sentiment Alert"
        alert.notification_message = "AAPL sentiment turned bullish"
        alert.portfolio_id = "portfolio_1"
        alert.portfolio_name = "My Portfolio"
        alert.is_global = False
        alert.check_condition = MagicMock(return_value=True)
        return alert

    def test_initialization(self, service):
        """Test service initialization"""
        assert service.monitoring_task is None
        assert service.is_running is False
        assert isinstance(service._ticker_cache, set)
        assert service._cache_updated_at is None

    @pytest.mark.asyncio
    async def test_get_all_monitored_tickers_fresh_cache(self, service):
        """Test fetching monitored tickers when cache is fresh"""
        # Set cache with recent timestamp
        service._ticker_cache = {"AAPL", "MSFT"}
        service._cache_updated_at = datetime.utcnow()

        tickers = await service.get_all_monitored_tickers()

        # Should return cached tickers
        assert tickers == {"AAPL", "MSFT"}

    @pytest.mark.asyncio
    async def test_get_all_monitored_tickers_stale_cache(self, service):
        """Test fetching monitored tickers when cache is stale"""
        from unittest.mock import MagicMock
        from datetime import timedelta

        # Set cache with old timestamp
        service._ticker_cache = {"OLD"}
        service._cache_updated_at = datetime.utcnow() - timedelta(seconds=120)

        # Mock database calls
        mock_collection = MagicMock()
        mock_cursor = [
            {"ticker": "AAPL", "is_active": True, "triggered": False},
            {"ticker": "MSFT", "is_active": True, "triggered": False}
        ]
        mock_collection.find.return_value = mock_cursor

        with patch('app.services.sentiment_alert_service.get_sentiment_alerts_collection', return_value=mock_collection):
            with patch('app.models.notification.SentimentAlertModel.from_mongo') as mock_from_mongo:
                # Create mock alerts
                mock_alert1 = MagicMock()
                mock_alert1.ticker = "AAPL"
                mock_alert2 = MagicMock()
                mock_alert2.ticker = "MSFT"

                mock_from_mongo.side_effect = [mock_alert1, mock_alert2]

                tickers = await service.get_all_monitored_tickers()

                # Should update cache with new tickers
                assert "AAPL" in tickers
                assert "MSFT" in tickers
                assert "OLD" not in tickers

    @pytest.mark.asyncio
    async def test_check_sentiment_alerts_no_sentiment_score(self, service):
        """Test alert checking when sentiment score is missing"""
        sentiment_data = {"sentiment_momentum": 0.1}  # Missing overall_weighted_score

        # Should return early without errors
        await service.check_sentiment_alerts("AAPL", sentiment_data)

    @pytest.mark.asyncio
    async def test_check_sentiment_alerts_no_active_alerts(self, service, mock_sentiment_data):
        """Test alert checking when no alerts are active"""
        with patch('app.models.notification.get_active_sentiment_alerts_for_ticker', new_callable=AsyncMock) as mock_get_alerts:
            mock_get_alerts.return_value = []

            await service.check_sentiment_alerts("AAPL", mock_sentiment_data)

            # Should complete without triggering any alerts
            mock_get_alerts.assert_called_once_with("AAPL")

    @pytest.mark.asyncio
    async def test_check_sentiment_alerts_triggers_alert(self, service, mock_sentiment_data, mock_alert):
        """Test successful alert triggering"""
        with patch('app.models.notification.get_active_sentiment_alerts_for_ticker', new_callable=AsyncMock) as mock_get_alerts:
            with patch('app.services.sentiment_alert_service.notification_service.send_notification', new_callable=AsyncMock) as mock_send:
                with patch('app.models.notification.trigger_sentiment_alert', new_callable=AsyncMock) as mock_trigger:
                    mock_get_alerts.return_value = [mock_alert]

                    await service.check_sentiment_alerts("AAPL", mock_sentiment_data)

                    # Should send notification
                    mock_send.assert_called_once()
                    call_kwargs = mock_send.call_args[1]
                    assert call_kwargs["client_id"] == "user_456"
                    assert call_kwargs["title"] == "AAPL Sentiment Alert"
                    assert "AAPL" in call_kwargs["metadata"]["ticker"]

                    # Should mark alert as triggered
                    mock_trigger.assert_called_once_with("alert_123", 0.6)

    @pytest.mark.asyncio
    async def test_check_sentiment_alerts_condition_not_met(self, service, mock_sentiment_data, mock_alert):
        """Test alert checking when condition is not met"""
        mock_alert.check_condition.return_value = False

        with patch('app.models.notification.get_active_sentiment_alerts_for_ticker', new_callable=AsyncMock) as mock_get_alerts:
            with patch('app.models.notification.update_sentiment_alert_state', new_callable=AsyncMock) as mock_update:
                mock_get_alerts.return_value = [mock_alert]

                await service.check_sentiment_alerts("AAPL", mock_sentiment_data)

                # Should update state but not trigger
                mock_update.assert_called_once_with("alert_123", 0.6, 0.15)

    @pytest.mark.asyncio
    async def test_check_sentiment_alerts_handles_exceptions(self, service, mock_sentiment_data, mock_alert):
        """Test that exceptions during alert processing are caught"""
        mock_alert.check_condition.side_effect = Exception("Test error")

        with patch('app.models.notification.get_active_sentiment_alerts_for_ticker', new_callable=AsyncMock) as mock_get_alerts:
            mock_get_alerts.return_value = [mock_alert]

            # Should not raise exception
            await service.check_sentiment_alerts("AAPL", mock_sentiment_data)

    def test_get_condition_description_becomes_bullish(self, service, mock_alert):
        """Test condition description for BECOMES_BULLISH"""
        from app.models.notification import SentimentAlertCondition

        mock_alert.condition = SentimentAlertCondition.BECOMES_BULLISH

        desc = service._get_condition_description(mock_alert, 0.6, None)

        assert "BULLISH" in desc
        assert "0.60" in desc

    def test_get_condition_description_becomes_bearish(self, service, mock_alert):
        """Test condition description for BECOMES_BEARISH"""
        from app.models.notification import SentimentAlertCondition

        mock_alert.condition = SentimentAlertCondition.BECOMES_BEARISH

        desc = service._get_condition_description(mock_alert, -0.6, None)

        assert "BEARISH" in desc
        assert "-0.60" in desc

    def test_get_condition_description_crosses_above(self, service, mock_alert):
        """Test condition description for CROSSES_ABOVE"""
        from app.models.notification import SentimentAlertCondition

        mock_alert.condition = SentimentAlertCondition.CROSSES_ABOVE
        mock_alert.threshold = 0.5

        desc = service._get_condition_description(mock_alert, 0.6, None)

        assert "crossed above" in desc
        assert "0.50" in desc
        assert "0.60" in desc

    def test_get_condition_description_crosses_below(self, service, mock_alert):
        """Test condition description for CROSSES_BELOW"""
        from app.models.notification import SentimentAlertCondition

        mock_alert.condition = SentimentAlertCondition.CROSSES_BELOW
        mock_alert.threshold = 0.5

        desc = service._get_condition_description(mock_alert, 0.3, None)

        assert "crossed below" in desc
        assert "0.50" in desc
        assert "0.30" in desc

    def test_get_condition_description_momentum_positive(self, service, mock_alert):
        """Test condition description for MOMENTUM_POSITIVE"""
        from app.models.notification import SentimentAlertCondition

        mock_alert.condition = SentimentAlertCondition.MOMENTUM_POSITIVE

        desc = service._get_condition_description(mock_alert, 0.5, 0.15)

        assert "momentum" in desc
        assert "positive" in desc

    @pytest.mark.asyncio
    async def test_check_sentiment_alerts_invalidates_cache_on_trigger(self, service, mock_sentiment_data, mock_alert):
        """Test that cache is invalidated when alerts are triggered"""
        service._cache_updated_at = datetime.utcnow()

        with patch('app.models.notification.get_active_sentiment_alerts_for_ticker', new_callable=AsyncMock) as mock_get_alerts:
            with patch('app.services.sentiment_alert_service.notification_service.send_notification', new_callable=AsyncMock):
                with patch('app.models.notification.trigger_sentiment_alert', new_callable=AsyncMock):
                    mock_get_alerts.return_value = [mock_alert]

                    await service.check_sentiment_alerts("AAPL", mock_sentiment_data)

                    # Cache should be invalidated
                    assert service._cache_updated_at is None

    @pytest.mark.asyncio
    async def test_check_sentiment_alerts_multiple_alerts(self, service, mock_sentiment_data, mock_alert):
        """Test checking multiple alerts for same ticker"""
        alert2 = MagicMock()
        alert2.id = "alert_789"
        alert2.user_id = "user_456"
        alert2.ticker = "AAPL"
        alert2.check_condition = MagicMock(return_value=True)
        alert2.notification_title = "AAPL Alert 2"
        alert2.notification_message = "Second alert"
        alert2.priority = "high"
        alert2.portfolio_id = None
        alert2.portfolio_name = None
        alert2.is_global = True
        alert2.condition.value = "CROSSES_ABOVE"
        alert2.threshold = 0.5

        with patch('app.models.notification.get_active_sentiment_alerts_for_ticker', new_callable=AsyncMock) as mock_get_alerts:
            with patch('app.services.sentiment_alert_service.notification_service.send_notification', new_callable=AsyncMock) as mock_send:
                with patch('app.models.notification.trigger_sentiment_alert', new_callable=AsyncMock):
                    mock_get_alerts.return_value = [mock_alert, alert2]

                    await service.check_sentiment_alerts("AAPL", mock_sentiment_data)

                    # Should send two notifications
                    assert mock_send.call_count == 2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
