# tests/services/test_price_alert_portfolio.py
"""
Tests for portfolio-aware price alert functionality.
"""

import unittest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime
from bson import ObjectId

from app.services.price_alert_service import PriceAlertService
from app.models.notification import PriceAlertModel


class TestPriceAlertPortfolio(unittest.IsolatedAsyncioTestCase):
    """Test portfolio-aware price alert service."""

    def setUp(self):
        """Set up test fixtures."""
        self.service = PriceAlertService()
        self.user_id = "test_user"
        self.portfolio_id = "507f1f77bcf86cd799439011"
        self.ticker = "AAPL"

    async def test_add_alert_with_portfolio(self):
        """Test adding a price alert for a specific portfolio."""
        mock_collection = MagicMock()
        mock_result = MagicMock()
        mock_result.inserted_id = ObjectId()
        mock_collection.insert_one = AsyncMock(return_value=mock_result)

        with patch('app.services.price_alert_service.get_price_alerts_collection', return_value=mock_collection):
            alert_id = await self.service.add_alert(
                user_id=self.user_id,
                ticker=self.ticker,
                target_price=150.0,
                alert_type="above",
                portfolio_id=self.portfolio_id,
                portfolio_name="Main Account",
                is_global=False,
            )

        self.assertIsNotNone(alert_id)
        mock_collection.insert_one.assert_called_once()

        # Verify the alert data includes portfolio fields
        alert_data = mock_collection.insert_one.call_args[0][0]
        self.assertEqual(alert_data["portfolio_id"], self.portfolio_id)
        self.assertEqual(alert_data["portfolio_name"], "Main Account")
        self.assertFalse(alert_data["is_global"])

    async def test_add_alert_auto_assign_primary_portfolio(self):
        """Test adding alert auto-assigns primary portfolio when not specified."""
        mock_price_alerts = MagicMock()
        mock_portfolios = MagicMock()

        # Mock primary portfolio lookup
        mock_portfolios.find_one = AsyncMock(return_value={
            "_id": ObjectId(self.portfolio_id),
            "username": self.user_id,
            "account_name": "Primary Account",
            "portfolio_name": "My Primary Portfolio",
            "is_primary": True,
            "is_active": True,
        })

        mock_result = MagicMock()
        mock_result.inserted_id = ObjectId()
        mock_price_alerts.insert_one = AsyncMock(return_value=mock_result)

        with patch('app.services.price_alert_service.get_price_alerts_collection', return_value=mock_price_alerts), \
             patch('app.services.price_alert_service.get_portfolios_collection', return_value=mock_portfolios):

            alert_id = await self.service.add_alert(
                user_id=self.user_id,
                ticker=self.ticker,
                target_price=150.0,
                alert_type="above",
                # No portfolio_id provided - should auto-assign
            )

        self.assertIsNotNone(alert_id)

        # Verify portfolio was looked up and assigned
        mock_portfolios.find_one.assert_called_once()
        alert_data = mock_price_alerts.insert_one.call_args[0][0]
        self.assertEqual(alert_data["portfolio_id"], self.portfolio_id)
        self.assertEqual(alert_data["portfolio_name"], "My Primary Portfolio")

    async def test_add_global_alert(self):
        """Test adding a global price alert (applies to all portfolios)."""
        mock_collection = MagicMock()
        mock_result = MagicMock()
        mock_result.inserted_id = ObjectId()
        mock_collection.insert_one = AsyncMock(return_value=mock_result)

        with patch('app.services.price_alert_service.get_price_alerts_collection', return_value=mock_collection):
            alert_id = await self.service.add_alert(
                user_id=self.user_id,
                ticker=self.ticker,
                target_price=150.0,
                alert_type="above",
                is_global=True,
            )

        self.assertIsNotNone(alert_id)

        # Verify the alert is marked as global
        alert_data = mock_collection.insert_one.call_args[0][0]
        self.assertTrue(alert_data["is_global"])
        self.assertIsNone(alert_data.get("portfolio_id"))

    async def test_get_portfolio_alerts(self):
        """Test getting all alerts for a specific portfolio."""
        mock_collection = MagicMock()

        mock_alerts = [
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": self.portfolio_id,
                "portfolio_name": "Main Account",
                "ticker": "AAPL",
                "target_price": 150.0,
                "alert_type": "above",
                "is_active": True,
                "is_global": False,
                "created_at": datetime.utcnow(),
            },
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": self.portfolio_id,
                "portfolio_name": "Main Account",
                "ticker": "GOOGL",
                "target_price": 2800.0,
                "alert_type": "below",
                "is_active": True,
                "is_global": False,
                "created_at": datetime.utcnow(),
            },
        ]

        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=mock_alerts)
        mock_collection.find.return_value = mock_cursor

        with patch('app.services.price_alert_service.get_price_alerts_collection', return_value=mock_collection):
            alerts = await self.service.get_portfolio_alerts(
                user_id=self.user_id,
                portfolio_id=self.portfolio_id,
                include_global=False,
            )

        self.assertEqual(len(alerts), 2)
        self.assertEqual(alerts[0].ticker, "AAPL")
        self.assertEqual(alerts[1].ticker, "GOOGL")

        # Verify query filters by portfolio_id
        mock_collection.find.assert_called_once()
        query = mock_collection.find.call_args[0][0]
        self.assertEqual(query["portfolio_id"], self.portfolio_id)

    async def test_get_portfolio_alerts_include_global(self):
        """Test getting portfolio alerts including global ones."""
        mock_collection = MagicMock()

        mock_alerts = [
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": self.portfolio_id,
                "ticker": "AAPL",
                "target_price": 150.0,
                "is_active": True,
                "is_global": False,
                "created_at": datetime.utcnow(),
            },
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": None,
                "ticker": "MSFT",
                "target_price": 300.0,
                "is_active": True,
                "is_global": True,
                "created_at": datetime.utcnow(),
            },
        ]

        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=mock_alerts)
        mock_collection.find.return_value = mock_cursor

        with patch('app.services.price_alert_service.get_price_alerts_collection', return_value=mock_collection):
            alerts = await self.service.get_portfolio_alerts(
                user_id=self.user_id,
                portfolio_id=self.portfolio_id,
                include_global=True,
            )

        self.assertEqual(len(alerts), 2)

        # Verify query uses $or for portfolio and global
        mock_collection.find.assert_called_once()
        query = mock_collection.find.call_args[0][0]
        self.assertIn("$or", query)

    async def test_check_portfolio_alerts(self):
        """Test checking price alerts for a specific portfolio."""
        mock_alerts_collection = MagicMock()
        mock_notifications_service = MagicMock()

        # Mock active alerts for portfolio
        mock_alerts = [
            PriceAlertModel(
                id="alert1",
                user_id=self.user_id,
                portfolio_id=self.portfolio_id,
                portfolio_name="Main Account",
                ticker="AAPL",
                target_price=150.0,
                alert_type="above",
                is_active=True,
            ),
        ]

        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[a.model_dump(by_alias=True) for a in mock_alerts])
        mock_alerts_collection.find.return_value = mock_cursor
        mock_alerts_collection.update_one = AsyncMock()

        # Mock current price that triggers alert
        current_price = 155.0

        with patch('app.services.price_alert_service.get_price_alerts_collection', return_value=mock_alerts_collection), \
             patch.object(self.service, 'notification_service', mock_notifications_service):

            triggered = await self.service.check_portfolio_alerts(
                user_id=self.user_id,
                portfolio_id=self.portfolio_id,
                ticker=self.ticker,
                current_price=current_price,
            )

        # Verify alert was triggered
        self.assertGreater(len(triggered), 0)

        # Verify notification was sent with portfolio context
        mock_notifications_service.send_notification.assert_called()
        call_kwargs = mock_notifications_service.send_notification.call_args[1]
        self.assertEqual(call_kwargs["portfolio_id"], self.portfolio_id)
        self.assertEqual(call_kwargs["portfolio_name"], "Main Account")

    async def test_copy_alerts_to_portfolio(self):
        """Test copying alerts from one portfolio to another."""
        mock_collection = MagicMock()
        source_portfolio_id = "507f1f77bcf86cd799439011"
        target_portfolio_id = "507f1f77bcf86cd799439012"

        # Mock source alerts
        mock_source_alerts = [
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": source_portfolio_id,
                "ticker": "AAPL",
                "target_price": 150.0,
                "alert_type": "above",
                "is_active": True,
                "created_at": datetime.utcnow(),
            },
        ]

        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=mock_source_alerts)
        mock_collection.find.return_value = mock_cursor
        mock_collection.insert_many = AsyncMock()

        with patch('app.services.price_alert_service.get_price_alerts_collection', return_value=mock_collection):
            count = await self.service.copy_alerts_to_portfolio(
                user_id=self.user_id,
                source_portfolio_id=source_portfolio_id,
                target_portfolio_id=target_portfolio_id,
                target_portfolio_name="Target Portfolio",
            )

        self.assertEqual(count, 1)
        mock_collection.insert_many.assert_called_once()

        # Verify new alerts have target portfolio ID
        inserted_alerts = mock_collection.insert_many.call_args[0][0]
        self.assertEqual(inserted_alerts[0]["portfolio_id"], target_portfolio_id)
        self.assertEqual(inserted_alerts[0]["portfolio_name"], "Target Portfolio")


class TestPriceAlertModel(unittest.TestCase):
    """Test PriceAlertModel with portfolio fields."""

    def test_price_alert_with_portfolio(self):
        """Test creating a price alert with portfolio context."""
        alert = PriceAlertModel(
            user_id="test_user",
            portfolio_id="507f1f77bcf86cd799439011",
            portfolio_name="Main Account",
            is_global=False,
            ticker="AAPL",
            target_price=150.0,
            alert_type="above",
        )

        self.assertEqual(alert.portfolio_id, "507f1f77bcf86cd799439011")
        self.assertEqual(alert.portfolio_name, "Main Account")
        self.assertFalse(alert.is_global)
        self.assertEqual(alert.ticker, "AAPL")

    def test_global_price_alert(self):
        """Test creating a global price alert."""
        alert = PriceAlertModel(
            user_id="test_user",
            portfolio_id=None,
            is_global=True,
            ticker="MSFT",
            target_price=300.0,
            alert_type="below",
        )

        self.assertIsNone(alert.portfolio_id)
        self.assertTrue(alert.is_global)


if __name__ == '__main__':
    unittest.main()
