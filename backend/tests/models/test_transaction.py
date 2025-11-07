# tests/models/test_transaction.py
"""
Tests for TransactionModel - MongoDB-based transaction tracking.

These tests ensure proper transaction validation, cash flow logic,
and database operations for Time-Weighted Return calculations.
"""

import unittest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, date
from bson import ObjectId
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.models.transaction import (
    TransactionModel,
    TransactionType,
    CreateTransactionRequest,
    TransactionSummary,
    create_transaction,
    get_transaction_by_id,
    get_transactions,
    get_cash_flows_between_dates,
    delete_transaction,
    update_transaction,
    get_transaction_stats
)


class TestTransactionModel(unittest.TestCase):
    """Test TransactionModel data structure and validation."""

    def test_buy_transaction_creation(self):
        """Test creating a BUY transaction."""
        transaction = TransactionModel(
            username="test_user",
            account_name="Main Account",
            account_no="ACC123",
            transaction_date=date(2024, 1, 15),
            transaction_type=TransactionType.BUY,
            symbol="AAPL",
            quantity=10,
            price=150.00,
            cash_flow=-1500.00,  # Negative = money out
            fees=10.00
        )

        self.assertEqual(transaction.username, "test_user")
        self.assertEqual(transaction.transaction_type, TransactionType.BUY)
        self.assertEqual(transaction.symbol, "AAPL")
        self.assertEqual(transaction.quantity, 10)
        self.assertEqual(transaction.cash_flow, -1500.00)
        self.assertIsInstance(transaction.created_at, datetime)

    def test_sell_transaction_creation(self):
        """Test creating a SELL transaction."""
        transaction = TransactionModel(
            username="test_user",
            account_name="Main Account",
            transaction_date=date(2024, 6, 15),
            transaction_type=TransactionType.SELL,
            symbol="AAPL",
            quantity=5,
            price=175.00,
            cash_flow=865.00,  # Positive = money in (after $10 fees)
            fees=10.00
        )

        self.assertEqual(transaction.transaction_type, TransactionType.SELL)
        self.assertEqual(transaction.cash_flow, 865.00)
        self.assertTrue(transaction.cash_flow > 0)

    def test_deposit_transaction_creation(self):
        """Test creating a DEPOSIT transaction."""
        transaction = TransactionModel(
            username="test_user",
            account_name="Main Account",
            transaction_date=date(2024, 3, 1),
            transaction_type=TransactionType.DEPOSIT,
            cash_flow=50000.00,  # Positive = money in
            notes="Initial deposit"
        )

        self.assertEqual(transaction.transaction_type, TransactionType.DEPOSIT)
        self.assertEqual(transaction.cash_flow, 50000.00)
        self.assertIsNone(transaction.symbol)
        self.assertIsNone(transaction.quantity)

    def test_withdrawal_transaction_creation(self):
        """Test creating a WITHDRAWAL transaction."""
        transaction = TransactionModel(
            username="test_user",
            account_name="Main Account",
            transaction_date=date(2024, 8, 1),
            transaction_type=TransactionType.WITHDRAWAL,
            cash_flow=-25000.00,  # Negative = money out
            notes="Partial withdrawal"
        )

        self.assertEqual(transaction.transaction_type, TransactionType.WITHDRAWAL)
        self.assertEqual(transaction.cash_flow, -25000.00)
        self.assertTrue(transaction.cash_flow < 0)

    def test_dividend_transaction_creation(self):
        """Test creating a DIVIDEND transaction."""
        transaction = TransactionModel(
            username="test_user",
            account_name="Main Account",
            transaction_date=date(2024, 4, 1),
            transaction_type=TransactionType.DIVIDEND,
            symbol="AAPL",
            cash_flow=25.00,  # Positive = money in
            notes="Q1 dividend payment"
        )

        self.assertEqual(transaction.transaction_type, TransactionType.DIVIDEND)
        self.assertEqual(transaction.symbol, "AAPL")
        self.assertEqual(transaction.cash_flow, 25.00)

    def test_cash_flow_cannot_be_zero(self):
        """Test that cash_flow cannot be zero."""
        with self.assertRaises(ValueError) as context:
            TransactionModel(
                username="test_user",
                account_name="Main Account",
                transaction_date=date(2024, 1, 15),
                transaction_type=TransactionType.DEPOSIT,
                cash_flow=0.00  # Invalid!
            )
        self.assertIn("cash_flow cannot be zero", str(context.exception))

    def test_buy_must_have_negative_cash_flow(self):
        """Test that BUY transactions must have negative cash_flow."""
        with self.assertRaises(ValueError) as context:
            TransactionModel(
                username="test_user",
                account_name="Main Account",
                transaction_date=date(2024, 1, 15),
                transaction_type=TransactionType.BUY,
                symbol="AAPL",
                quantity=10,
                price=150.00,
                cash_flow=1500.00  # Wrong sign!
            )
        self.assertIn("BUY must have negative cash_flow", str(context.exception))

    def test_sell_must_have_positive_cash_flow(self):
        """Test that SELL transactions must have positive cash_flow."""
        with self.assertRaises(ValueError) as context:
            TransactionModel(
                username="test_user",
                account_name="Main Account",
                transaction_date=date(2024, 1, 15),
                transaction_type=TransactionType.SELL,
                symbol="AAPL",
                quantity=10,
                price=150.00,
                cash_flow=-1500.00  # Wrong sign!
            )
        self.assertIn("SELL must have positive cash_flow", str(context.exception))

    def test_deposit_must_have_positive_cash_flow(self):
        """Test that DEPOSIT transactions must have positive cash_flow."""
        with self.assertRaises(ValueError) as context:
            TransactionModel(
                username="test_user",
                account_name="Main Account",
                transaction_date=date(2024, 1, 15),
                transaction_type=TransactionType.DEPOSIT,
                cash_flow=-50000.00  # Wrong sign!
            )
        self.assertIn("DEPOSIT must have positive cash_flow", str(context.exception))

    def test_withdrawal_must_have_negative_cash_flow(self):
        """Test that WITHDRAWAL transactions must have negative cash_flow."""
        with self.assertRaises(ValueError) as context:
            TransactionModel(
                username="test_user",
                account_name="Main Account",
                transaction_date=date(2024, 1, 15),
                transaction_type=TransactionType.WITHDRAWAL,
                cash_flow=25000.00  # Wrong sign!
            )
        self.assertIn("WITHDRAWAL must have negative cash_flow", str(context.exception))

    def test_buy_requires_symbol(self):
        """Test that BUY transactions require a symbol."""
        with self.assertRaises(ValueError) as context:
            TransactionModel(
                username="test_user",
                account_name="Main Account",
                transaction_date=date(2024, 1, 15),
                transaction_type=TransactionType.BUY,
                # symbol missing!
                quantity=10,
                price=150.00,
                cash_flow=-1500.00
            )
        self.assertIn("BUY requires a symbol", str(context.exception))

    def test_buy_requires_positive_quantity(self):
        """Test that BUY transactions require positive quantity."""
        with self.assertRaises(ValueError) as context:
            TransactionModel(
                username="test_user",
                account_name="Main Account",
                transaction_date=date(2024, 1, 15),
                transaction_type=TransactionType.BUY,
                symbol="AAPL",
                quantity=0,  # Invalid!
                price=150.00,
                cash_flow=-1500.00
            )
        self.assertIn("BUY requires positive quantity", str(context.exception))

    def test_deposit_does_not_require_symbol(self):
        """Test that DEPOSIT transactions don't require symbol or quantity."""
        transaction = TransactionModel(
            username="test_user",
            account_name="Main Account",
            transaction_date=date(2024, 1, 15),
            transaction_type=TransactionType.DEPOSIT,
            cash_flow=50000.00
        )

        self.assertIsNone(transaction.symbol)
        self.assertIsNone(transaction.quantity)

    def test_transaction_to_dict(self):
        """Test converting TransactionModel to dictionary."""
        transaction = TransactionModel(
            id="507f1f77bcf86cd799439011",
            username="test_user",
            account_name="Main Account",
            transaction_date=date(2024, 1, 15),
            transaction_type=TransactionType.BUY,
            symbol="AAPL",
            quantity=10,
            price=150.00,
            cash_flow=-1500.00
        )

        transaction_dict = transaction.to_dict()

        self.assertIsInstance(transaction_dict["_id"], ObjectId)
        self.assertEqual(transaction_dict["username"], "test_user")
        self.assertEqual(transaction_dict["symbol"], "AAPL")
        # Date converted to datetime
        self.assertIsInstance(transaction_dict["transaction_date"], datetime)

    def test_transaction_from_dict(self):
        """Test creating TransactionModel from dictionary."""
        transaction_dict = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "username": "test_user",
            "account_name": "Main Account",
            "transaction_date": datetime(2024, 1, 15),
            "transaction_type": "BUY",
            "symbol": "AAPL",
            "quantity": 10,
            "price": 150.00,
            "cash_flow": -1500.00,
            "fees": 10.00,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "source": "manual"
        }

        transaction = TransactionModel.from_dict(transaction_dict)

        self.assertEqual(transaction.id, "507f1f77bcf86cd799439011")
        self.assertEqual(transaction.username, "test_user")
        self.assertEqual(transaction.symbol, "AAPL")
        # Datetime converted back to date
        self.assertIsInstance(transaction.transaction_date, date)

    def test_transaction_summary_from_model(self):
        """Test creating TransactionSummary from TransactionModel."""
        transaction = TransactionModel(
            id="507f1f77bcf86cd799439011",
            username="test_user",
            account_name="Main Account",
            transaction_date=date(2024, 1, 15),
            transaction_type=TransactionType.BUY,
            symbol="AAPL",
            quantity=10,
            cash_flow=-1500.00,
            notes="Initial purchase"
        )

        summary = TransactionSummary.from_transaction_model(transaction)

        self.assertEqual(summary.transaction_id, "507f1f77bcf86cd799439011")
        self.assertEqual(summary.transaction_type, TransactionType.BUY)
        self.assertEqual(summary.symbol, "AAPL")
        self.assertEqual(summary.cash_flow, -1500.00)
        self.assertEqual(summary.notes, "Initial purchase")


class TestTransactionCRUDOperations(unittest.IsolatedAsyncioTestCase):
    """Test transaction CRUD operations with mocked database."""

    async def test_create_transaction(self):
        """Test creating a new transaction in database."""
        mock_db = MagicMock()
        mock_collection = MagicMock()

        # Mock insert_one to return a result with inserted_id
        mock_result = MagicMock()
        mock_result.inserted_id = ObjectId("507f1f77bcf86cd799439011")
        mock_collection.insert_one = AsyncMock(return_value=mock_result)

        transaction_request = CreateTransactionRequest(
            account_name="Main Account",
            transaction_date=date(2024, 1, 15),
            transaction_type=TransactionType.BUY,
            symbol="AAPL",
            quantity=10,
            price=150.00,
            cash_flow=-1500.00
        )

        with patch('app.models.transaction.get_transactions_collection', return_value=mock_collection):
            transaction_id = await create_transaction(mock_db, "test_user", transaction_request)

        self.assertEqual(transaction_id, "507f1f77bcf86cd799439011")
        mock_collection.insert_one.assert_called_once()

    async def test_get_transaction_by_id(self):
        """Test retrieving a transaction by ID."""
        mock_db = MagicMock()
        mock_collection = MagicMock()

        mock_doc = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "username": "test_user",
            "account_name": "Main Account",
            "transaction_date": datetime(2024, 1, 15),
            "transaction_type": "BUY",
            "symbol": "AAPL",
            "quantity": 10,
            "price": 150.00,
            "cash_flow": -1500.00,
            "fees": 0.0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "source": "manual"
        }

        mock_collection.find_one = AsyncMock(return_value=mock_doc)

        with patch('app.models.transaction.get_transactions_collection', return_value=mock_collection):
            transaction = await get_transaction_by_id(mock_db, "507f1f77bcf86cd799439011")

        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.id, "507f1f77bcf86cd799439011")
        self.assertEqual(transaction.symbol, "AAPL")

    async def test_get_transactions_with_filters(self):
        """Test retrieving transactions with date and type filters."""
        mock_db = MagicMock()
        mock_collection = MagicMock()

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)

        mock_docs = [
            {
                "_id": ObjectId(),
                "username": "test_user",
                "account_name": "Main Account",
                "transaction_date": datetime(2024, 1, 15),
                "transaction_type": "BUY",
                "symbol": "AAPL",
                "quantity": 10,
                "cash_flow": -1500.00,
                "fees": 0.0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "source": "manual"
            }
        ]

        async def async_iterator():
            for doc in mock_docs:
                yield doc

        mock_cursor.__aiter__ = lambda self: async_iterator()
        mock_collection.find = MagicMock(return_value=mock_cursor)

        with patch('app.models.transaction.get_transactions_collection', return_value=mock_collection):
            transactions = await get_transactions(
                mock_db,
                "test_user",
                "Main Account",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31),
                transaction_type=TransactionType.BUY
            )

        self.assertEqual(len(transactions), 1)
        self.assertEqual(transactions[0].transaction_type, TransactionType.BUY)

    async def test_get_cash_flows_between_dates(self):
        """Test retrieving cash flows for TWR calculation."""
        mock_db = MagicMock()
        mock_collection = MagicMock()

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)

        mock_docs = [
            {
                "_id": ObjectId(),
                "username": "test_user",
                "account_name": "Main Account",
                "transaction_date": datetime(2024, 1, 15),
                "transaction_type": "DEPOSIT",
                "cash_flow": 50000.00,
                "fees": 0.0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "source": "manual"
            },
            {
                "_id": ObjectId(),
                "username": "test_user",
                "account_name": "Main Account",
                "transaction_date": datetime(2024, 6, 15),
                "transaction_type": "BUY",
                "symbol": "AAPL",
                "quantity": 10,
                "cash_flow": -1500.00,
                "fees": 0.0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "source": "manual"
            }
        ]

        async def async_iterator():
            for doc in mock_docs:
                yield doc

        mock_cursor.__aiter__ = lambda self: async_iterator()
        mock_collection.find = MagicMock(return_value=mock_cursor)

        with patch('app.models.transaction.get_transactions_collection', return_value=mock_collection):
            cash_flows = await get_cash_flows_between_dates(
                mock_db,
                "test_user",
                "Main Account",
                date(2024, 1, 1),
                date(2024, 12, 31)
            )

        self.assertEqual(len(cash_flows), 2)
        self.assertEqual(cash_flows[0]["amount"], 50000.00)
        self.assertEqual(cash_flows[1]["amount"], -1500.00)

    async def test_delete_transaction(self):
        """Test deleting a transaction."""
        mock_db = MagicMock()
        mock_collection = MagicMock()

        mock_result = MagicMock()
        mock_result.deleted_count = 1
        mock_collection.delete_one = AsyncMock(return_value=mock_result)

        with patch('app.models.transaction.get_transactions_collection', return_value=mock_collection):
            success = await delete_transaction(mock_db, "507f1f77bcf86cd799439011", "test_user")

        self.assertTrue(success)

    async def test_update_transaction(self):
        """Test updating a transaction."""
        mock_db = MagicMock()
        mock_collection = MagicMock()

        mock_result = MagicMock()
        mock_result.modified_count = 1
        mock_collection.update_one = AsyncMock(return_value=mock_result)

        updates = {
            "notes": "Updated notes",
            "fees": 15.00
        }

        with patch('app.models.transaction.get_transactions_collection', return_value=mock_collection):
            success = await update_transaction(mock_db, "507f1f77bcf86cd799439011", "test_user", updates)

        self.assertTrue(success)


if __name__ == '__main__':
    unittest.main()
