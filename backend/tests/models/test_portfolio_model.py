# tests/models/test_portfolio_model.py
"""
Tests for PortfolioModel - MongoDB-based portfolio persistence.
"""

import unittest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime
from bson import ObjectId

from app.models.portfolio_model import (
    PortfolioModel,
    PortfolioSummary,
    PortfolioHoldingModel,
    create_portfolio,
    get_portfolio_by_id,
    get_user_portfolios,
    get_user_primary_portfolio,
    set_primary_portfolio,
    update_portfolio_holdings_cache,
)


class TestPortfolioModel(unittest.TestCase):
    """Test PortfolioModel data structure."""

    def test_portfolio_model_creation(self):
        """Test creating a PortfolioModel instance."""
        portfolio = PortfolioModel(
            username="test_user",
            account_name="Main Account",
            portfolio_name="My Portfolio",
            account_no="ACC123",
            is_primary=True,
        )

        self.assertEqual(portfolio.username, "test_user")
        self.assertEqual(portfolio.account_name, "Main Account")
        self.assertEqual(portfolio.portfolio_name, "My Portfolio")
        self.assertTrue(portfolio.is_primary)
        self.assertTrue(portfolio.is_active)
        self.assertIsInstance(portfolio.created_at, datetime)

    def test_portfolio_model_to_dict(self):
        """Test converting PortfolioModel to dictionary."""
        portfolio = PortfolioModel(
            id="507f1f77bcf86cd799439011",
            username="test_user",
            account_name="Main Account",
        )

        portfolio_dict = portfolio.model_dump(by_alias=True)

        self.assertEqual(portfolio_dict["_id"], "507f1f77bcf86cd799439011")
        self.assertEqual(portfolio_dict["username"], "test_user")
        self.assertEqual(portfolio_dict["account_name"], "Main Account")

    def test_portfolio_summary_from_model(self):
        """Test creating PortfolioSummary from PortfolioModel."""
        portfolio = PortfolioModel(
            id="507f1f77bcf86cd799439011",
            username="test_user",
            account_name="Main Account",
            portfolio_name="My Portfolio",
            holdings_count=10,
            total_value=50000.0,
            tickers=["AAPL", "GOOGL", "MSFT"],
        )

        summary = PortfolioSummary.from_portfolio_model(portfolio)

        self.assertEqual(summary.portfolio_id, "507f1f77bcf86cd799439011")
        self.assertEqual(summary.portfolio_name, "My Portfolio")
        self.assertEqual(summary.holdings_count, 10)
        self.assertEqual(summary.total_value, 50000.0)
        self.assertEqual(len(summary.tickers), 3)


class TestPortfolioCRUDOperations(unittest.IsolatedAsyncioTestCase):
    """Test portfolio CRUD operations with mocked database."""

    async def test_create_portfolio(self):
        """Test creating a new portfolio in database."""
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.get_collection.return_value = mock_collection

        # Mock insert_one to return a result with inserted_id
        mock_result = MagicMock()
        mock_result.inserted_id = ObjectId("507f1f77bcf86cd799439011")
        mock_collection.insert_one = AsyncMock(return_value=mock_result)

        portfolio = PortfolioModel(
            username="test_user",
            account_name="Main Account",
        )

        with patch('app.models.portfolio_model.get_portfolios_collection', return_value=mock_collection):
            portfolio_id = await create_portfolio(mock_db, portfolio)

        self.assertEqual(portfolio_id, "507f1f77bcf86cd799439011")
        mock_collection.insert_one.assert_called_once()

    async def test_get_portfolio_by_id(self):
        """Test retrieving a portfolio by ID."""
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.get_collection.return_value = mock_collection

        # Mock find_one to return portfolio data
        mock_collection.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "username": "test_user",
            "account_name": "Main Account",
            "portfolio_name": "My Portfolio",
            "is_primary": True,
            "is_active": True,
            "holdings_count": 5,
            "total_value": 25000.0,
            "tickers": ["AAPL", "GOOGL"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

        with patch('app.models.portfolio_model.get_portfolios_collection', return_value=mock_collection):
            portfolio = await get_portfolio_by_id(mock_db, "507f1f77bcf86cd799439011")

        self.assertIsNotNone(portfolio)
        self.assertEqual(portfolio.username, "test_user")
        self.assertEqual(portfolio.account_name, "Main Account")
        self.assertTrue(portfolio.is_primary)

    async def test_get_portfolio_by_id_not_found(self):
        """Test retrieving a non-existent portfolio."""
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.get_collection.return_value = mock_collection
        mock_collection.find_one = AsyncMock(return_value=None)

        with patch('app.models.portfolio_model.get_portfolios_collection', return_value=mock_collection):
            portfolio = await get_portfolio_by_id(mock_db, "507f1f77bcf86cd799439011")

        self.assertIsNone(portfolio)

    async def test_get_user_portfolios(self):
        """Test retrieving all portfolios for a user."""
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.get_collection.return_value = mock_collection

        # Mock find to return multiple portfolios
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[
            {
                "_id": ObjectId("507f1f77bcf86cd799439011"),
                "username": "test_user",
                "account_name": "Account 1",
                "is_primary": True,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            },
            {
                "_id": ObjectId("507f1f77bcf86cd799439012"),
                "username": "test_user",
                "account_name": "Account 2",
                "is_primary": False,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            },
        ])
        mock_collection.find.return_value = mock_cursor

        with patch('app.models.portfolio_model.get_portfolios_collection', return_value=mock_collection):
            portfolios = await get_user_portfolios(mock_db, "test_user")

        self.assertEqual(len(portfolios), 2)
        self.assertEqual(portfolios[0].account_name, "Account 1")
        self.assertTrue(portfolios[0].is_primary)
        self.assertEqual(portfolios[1].account_name, "Account 2")
        self.assertFalse(portfolios[1].is_primary)

    async def test_get_user_primary_portfolio(self):
        """Test retrieving user's primary portfolio."""
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.get_collection.return_value = mock_collection

        mock_collection.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "username": "test_user",
            "account_name": "Main Account",
            "is_primary": True,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

        with patch('app.models.portfolio_model.get_portfolios_collection', return_value=mock_collection):
            portfolio = await get_user_primary_portfolio(mock_db, "test_user")

        self.assertIsNotNone(portfolio)
        self.assertTrue(portfolio.is_primary)
        self.assertEqual(portfolio.account_name, "Main Account")

    async def test_set_primary_portfolio(self):
        """Test setting a portfolio as primary."""
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.get_collection.return_value = mock_collection

        # Mock update operations
        mock_collection.update_many = AsyncMock()
        mock_collection.update_one = AsyncMock()

        with patch('app.models.portfolio_model.get_portfolios_collection', return_value=mock_collection):
            success = await set_primary_portfolio(
                mock_db,
                "test_user",
                "507f1f77bcf86cd799439011"
            )

        self.assertTrue(success)
        # Verify update_many was called to unset other primaries
        mock_collection.update_many.assert_called_once()
        # Verify update_one was called to set new primary
        mock_collection.update_one.assert_called_once()

    async def test_update_portfolio_holdings_cache(self):
        """Test updating portfolio holdings cache."""
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_db.get_collection.return_value = mock_collection

        mock_result = MagicMock()
        mock_result.modified_count = 1
        mock_collection.update_one = AsyncMock(return_value=mock_result)

        holdings = [
            {"symbol": "AAPL", "quantity": 100, "purchase_price": 150.0},
            {"symbol": "GOOGL", "quantity": 50, "purchase_price": 2800.0},
        ]

        with patch('app.models.portfolio_model.get_portfolios_collection', return_value=mock_collection):
            success = await update_portfolio_holdings_cache(
                mock_db,
                "507f1f77bcf86cd799439011",
                holdings
            )

        self.assertTrue(success)
        mock_collection.update_one.assert_called_once()


if __name__ == '__main__':
    unittest.main()
