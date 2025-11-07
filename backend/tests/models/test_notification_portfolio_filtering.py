# tests/models/test_notification_portfolio_filtering.py
"""
Tests for portfolio-aware notification filtering.
"""

import unittest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime
from bson import ObjectId

from app.models.notification import (
    NotificationModel,
    get_notifications,
    get_portfolio_notifications,
    get_portfolio_unread_count,
    get_multi_portfolio_notifications,
)


class TestNotificationPortfolioFiltering(unittest.IsolatedAsyncioTestCase):
    """Test portfolio filtering for notifications."""

    def setUp(self):
        """Set up test data."""
        self.user_id = "test_user"
        self.portfolio_id = "507f1f77bcf86cd799439011"
        self.portfolio_id_2 = "507f1f77bcf86cd799439012"

    async def test_get_notifications_with_portfolio_filter(self):
        """Test getting notifications filtered by portfolio."""
        mock_collection = MagicMock()

        # Mock notifications with portfolio context
        mock_notifications = [
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": self.portfolio_id,
                "portfolio_name": "Main Account",
                "is_global": False,
                "category": "Market Intelligence",
                "subcategory": "Emerging Opportunities",
                "title": "Portfolio-specific notification",
                "message": "This is for your main portfolio",
                "is_read": False,
                "created_at": datetime.utcnow(),
            },
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": None,
                "is_global": True,
                "category": "Market Intelligence",
                "title": "Global notification",
                "message": "This applies to all portfolios",
                "is_read": False,
                "created_at": datetime.utcnow(),
            },
        ]

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = mock_cursor
        mock_cursor.to_list = AsyncMock(return_value=mock_notifications)
        mock_collection.find.return_value = mock_cursor

        with patch('app.models.notification.get_notifications_collection', return_value=mock_collection):
            notifications = await get_notifications(
                user_id=self.user_id,
                portfolio_id=self.portfolio_id,
                include_global=True,
                limit=50,
                offset=0
            )

        self.assertEqual(len(notifications), 2)
        # Verify query was called with portfolio filter
        mock_collection.find.assert_called_once()
        query_arg = mock_collection.find.call_args[0][0]
        self.assertIn("$or", query_arg)

    async def test_get_notifications_exclude_global(self):
        """Test filtering notifications excluding global ones."""
        mock_collection = MagicMock()

        mock_notifications = [
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": self.portfolio_id,
                "portfolio_name": "Main Account",
                "is_global": False,
                "category": "Market Intelligence",
                "title": "Portfolio-specific notification",
                "message": "Only for main portfolio",
                "is_read": False,
                "created_at": datetime.utcnow(),
            },
        ]

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = mock_cursor
        mock_cursor.to_list = AsyncMock(return_value=mock_notifications)
        mock_collection.find.return_value = mock_cursor

        with patch('app.models.notification.get_notifications_collection', return_value=mock_collection):
            notifications = await get_notifications(
                user_id=self.user_id,
                portfolio_id=self.portfolio_id,
                include_global=False,
                limit=50,
                offset=0
            )

        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].portfolio_id, self.portfolio_id)

    async def test_get_portfolio_notifications(self):
        """Test getting notifications for a specific portfolio."""
        mock_collection = MagicMock()

        mock_notifications = [
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": self.portfolio_id,
                "portfolio_name": "Main Account",
                "is_global": False,
                "affected_tickers": ["AAPL", "GOOGL"],
                "title": "Price Alert",
                "message": "AAPL hit target price",
                "is_read": False,
                "created_at": datetime.utcnow(),
            },
        ]

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = mock_cursor
        mock_cursor.to_list = AsyncMock(return_value=mock_notifications)
        mock_collection.find.return_value = mock_cursor

        with patch('app.models.notification.get_notifications_collection', return_value=mock_collection):
            notifications = await get_portfolio_notifications(
                user_id=self.user_id,
                portfolio_id=self.portfolio_id,
                include_global=True,
                limit=50,
                offset=0
            )

        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].portfolio_id, self.portfolio_id)
        self.assertIn("AAPL", notifications[0].affected_tickers)

    async def test_get_portfolio_unread_count(self):
        """Test getting unread notification count for a portfolio."""
        mock_collection = MagicMock()
        mock_collection.count_documents = AsyncMock(return_value=5)

        with patch('app.models.notification.get_notifications_collection', return_value=mock_collection):
            count = await get_portfolio_unread_count(
                user_id=self.user_id,
                portfolio_id=self.portfolio_id,
                include_global=True
            )

        self.assertEqual(count, 5)
        mock_collection.count_documents.assert_called_once()
        query_arg = mock_collection.count_documents.call_args[0][0]
        self.assertIn("is_read", query_arg)
        self.assertIn("$or", query_arg)

    async def test_get_multi_portfolio_notifications(self):
        """Test getting notifications for multiple portfolios."""
        mock_collection = MagicMock()

        mock_notifications = [
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": self.portfolio_id,
                "portfolio_name": "Portfolio 1",
                "title": "Notification 1",
                "is_read": False,
                "created_at": datetime.utcnow(),
            },
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "portfolio_id": self.portfolio_id_2,
                "portfolio_name": "Portfolio 2",
                "title": "Notification 2",
                "is_read": False,
                "created_at": datetime.utcnow(),
            },
            {
                "_id": ObjectId(),
                "user_id": self.user_id,
                "is_global": True,
                "title": "Global Notification",
                "is_read": False,
                "created_at": datetime.utcnow(),
            },
        ]

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = mock_cursor
        mock_cursor.to_list = AsyncMock(return_value=mock_notifications)
        mock_collection.find.return_value = mock_cursor

        with patch('app.models.notification.get_notifications_collection', return_value=mock_collection):
            notifications = await get_multi_portfolio_notifications(
                user_id=self.user_id,
                portfolio_ids=[self.portfolio_id, self.portfolio_id_2],
                include_global=True,
                limit=50,
                offset=0
            )

        self.assertEqual(len(notifications), 3)
        # Verify notifications from both portfolios
        portfolio_ids = {n.portfolio_id for n in notifications if n.portfolio_id}
        self.assertIn(self.portfolio_id, portfolio_ids)
        self.assertIn(self.portfolio_id_2, portfolio_ids)


class TestNotificationModelWithPortfolio(unittest.TestCase):
    """Test NotificationModel with portfolio fields."""

    def test_notification_model_with_portfolio(self):
        """Test creating a notification with portfolio context."""
        notification = NotificationModel(
            user_id="test_user",
            portfolio_id="507f1f77bcf86cd799439011",
            portfolio_name="Main Account",
            is_global=False,
            affected_tickers=["AAPL", "GOOGL"],
            category="Market Intelligence",
            subcategory="Emerging Opportunities",
            title="Price Alert",
            message="AAPL reached target price",
        )

        self.assertEqual(notification.portfolio_id, "507f1f77bcf86cd799439011")
        self.assertEqual(notification.portfolio_name, "Main Account")
        self.assertFalse(notification.is_global)
        self.assertEqual(len(notification.affected_tickers), 2)
        self.assertIn("AAPL", notification.affected_tickers)

    def test_notification_model_global(self):
        """Test creating a global notification."""
        notification = NotificationModel(
            user_id="test_user",
            portfolio_id=None,
            is_global=True,
            category="Market Intelligence",
            title="Market Update",
            message="Global market news",
        )

        self.assertIsNone(notification.portfolio_id)
        self.assertTrue(notification.is_global)

    def test_notification_model_to_dict(self):
        """Test converting notification with portfolio to dictionary."""
        notification = NotificationModel(
            id="507f1f77bcf86cd799439011",
            user_id="test_user",
            portfolio_id="507f1f77bcf86cd799439012",
            portfolio_name="Main Account",
            affected_tickers=["AAPL"],
            category="Market Intelligence",
            title="Test Notification",
            message="Test message",
        )

        notif_dict = notification.model_dump(by_alias=True)

        self.assertEqual(notif_dict["_id"], "507f1f77bcf86cd799439011")
        self.assertEqual(notif_dict["portfolio_id"], "507f1f77bcf86cd799439012")
        self.assertEqual(notif_dict["portfolio_name"], "Main Account")
        self.assertEqual(notif_dict["affected_tickers"], ["AAPL"])


if __name__ == '__main__':
    unittest.main()
