# app/repositories/interfaces.py
"""
Repository Interface Definitions.

These abstract base classes define the contract for all repository implementations,
enabling dependency injection and easy mocking in tests.

Design Principles:
- All methods are async for consistency with Motor (async MongoDB driver)
- Generic type T represents the entity/model type
- Each domain gets its own interface extending IRepository
- Interfaces should be minimal - add methods only when needed
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List, Dict, Any, Tuple
from datetime import datetime

T = TypeVar("T")


class IRepository(ABC, Generic[T]):
    """
    Base repository interface defining standard CRUD operations.

    All repository implementations should inherit from this interface
    to ensure consistent data access patterns across the application.

    Type Parameters:
        T: The entity/model type this repository manages
    """

    @abstractmethod
    async def get_by_id(self, entity_id: str) -> Optional[T]:
        """
        Retrieve an entity by its unique identifier.

        Args:
            entity_id: The MongoDB ObjectId as a string

        Returns:
            The entity if found, None otherwise
        """
        pass

    @abstractmethod
    async def get_all(
        self,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[T]:
        """
        Retrieve all entities matching the given filters.

        Args:
            filters: MongoDB query filters
            limit: Maximum number of results to return
            offset: Number of results to skip (for pagination)

        Returns:
            List of matching entities
        """
        pass

    @abstractmethod
    async def create(self, entity: T) -> str:
        """
        Create a new entity in the database.

        Args:
            entity: The entity to create

        Returns:
            The ID of the created entity
        """
        pass

    @abstractmethod
    async def update(self, entity_id: str, updates: Dict[str, Any]) -> bool:
        """
        Update an existing entity.

        Args:
            entity_id: The ID of the entity to update
            updates: Dictionary of field updates

        Returns:
            True if the entity was updated, False otherwise
        """
        pass

    @abstractmethod
    async def delete(self, entity_id: str) -> bool:
        """
        Delete an entity by ID.

        Args:
            entity_id: The ID of the entity to delete

        Returns:
            True if the entity was deleted, False otherwise
        """
        pass

    @abstractmethod
    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count entities matching the given filters.

        Args:
            filters: MongoDB query filters

        Returns:
            Count of matching entities
        """
        pass


class INotificationRepository(IRepository["NotificationModel"]):
    """
    Notification-specific repository interface.

    Extends IRepository with notification-specific operations like
    marking as read, filtering by portfolio, and archiving.
    """

    @abstractmethod
    async def get_user_notifications(
        self,
        user_id: str,
        portfolio_id: Optional[str] = None,
        include_global: bool = True,
        is_read: Optional[bool] = None,
        is_archived: bool = False,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List["NotificationModel"]:
        """
        Get notifications for a user with optional portfolio filtering.

        Args:
            user_id: The user's ID
            portfolio_id: Filter by specific portfolio (optional)
            include_global: Include global notifications when filtering by portfolio
            is_read: Filter by read status (None = all)
            is_archived: Filter by archived status
            category: Filter by notification category
            limit: Maximum results to return
            offset: Pagination offset

        Returns:
            List of notifications sorted by created_at (descending)
        """
        pass

    @abstractmethod
    async def mark_as_read(self, notification_ids: List[str]) -> int:
        """
        Mark multiple notifications as read.

        Args:
            notification_ids: List of notification IDs to mark as read

        Returns:
            Number of notifications actually marked as read
        """
        pass

    @abstractmethod
    async def mark_all_as_read(
        self,
        user_id: str,
        portfolio_id: Optional[str] = None,
    ) -> int:
        """
        Mark all notifications as read for a user.

        Args:
            user_id: The user's ID
            portfolio_id: Optional portfolio filter

        Returns:
            Number of notifications marked as read
        """
        pass

    @abstractmethod
    async def get_unread_count(
        self,
        user_id: str,
        portfolio_id: Optional[str] = None,
    ) -> int:
        """
        Get count of unread notifications.

        Args:
            user_id: The user's ID
            portfolio_id: Optional portfolio filter

        Returns:
            Count of unread notifications
        """
        pass

    @abstractmethod
    async def archive_notifications(self, notification_ids: List[str]) -> int:
        """
        Archive multiple notifications.

        Args:
            notification_ids: List of notification IDs to archive

        Returns:
            Number of notifications archived
        """
        pass

    @abstractmethod
    async def delete_old_notifications(
        self,
        user_id: str,
        older_than: datetime,
    ) -> int:
        """
        Delete notifications older than a given date.

        Args:
            user_id: The user's ID
            older_than: Delete notifications created before this date

        Returns:
            Number of notifications deleted
        """
        pass


class ITransactionRepository(IRepository["TransactionModel"]):
    """
    Transaction-specific repository interface.

    Handles portfolio transaction operations like trades, deposits, withdrawals.
    """

    @abstractmethod
    async def get_by_account(
        self,
        account_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List["TransactionModel"]:
        """
        Get transactions for an account within a date range.

        Args:
            account_id: The account ID
            start_date: Filter transactions after this date
            end_date: Filter transactions before this date
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of transactions sorted by date (descending)
        """
        pass

    @abstractmethod
    async def get_summary(
        self,
        account_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Get aggregated transaction summary for an account.

        Args:
            account_id: The account ID
            start_date: Start of summary period
            end_date: End of summary period

        Returns:
            Summary with totals for buys, sells, deposits, withdrawals
        """
        pass


class IPortfolioRepository(IRepository["PortfolioModel"]):
    """
    Portfolio-specific repository interface.
    """

    @abstractmethod
    async def get_by_username(
        self,
        username: str,
        include_inactive: bool = False,
    ) -> List["PortfolioModel"]:
        """
        Get all portfolios for a user.

        Args:
            username: The user's username
            include_inactive: Include inactive portfolios

        Returns:
            List of portfolios
        """
        pass

    @abstractmethod
    async def get_primary_portfolio(self, username: str) -> Optional["PortfolioModel"]:
        """
        Get the user's primary portfolio.

        Args:
            username: The user's username

        Returns:
            The primary portfolio if set, None otherwise
        """
        pass

    @abstractmethod
    async def set_primary_portfolio(
        self,
        username: str,
        portfolio_id: str,
    ) -> bool:
        """
        Set a portfolio as the user's primary.

        Args:
            username: The user's username
            portfolio_id: The portfolio to set as primary

        Returns:
            True if successful
        """
        pass


class IHoldingRepository(IRepository["HoldingModel"]):
    """
    Stock holding-specific repository interface.
    """

    @abstractmethod
    async def get_by_account(
        self,
        account_id: str,
        include_closed: bool = False,
    ) -> List["HoldingModel"]:
        """
        Get all holdings for an account.

        Args:
            account_id: The account ID
            include_closed: Include closed positions (quantity = 0)

        Returns:
            List of holdings
        """
        pass

    @abstractmethod
    async def get_by_ticker(
        self,
        account_id: str,
        ticker: str,
    ) -> Optional["HoldingModel"]:
        """
        Get a specific holding by ticker.

        Args:
            account_id: The account ID
            ticker: Stock ticker symbol

        Returns:
            The holding if found, None otherwise
        """
        pass

    @abstractmethod
    async def update_quantity(
        self,
        holding_id: str,
        quantity_delta: float,
        avg_cost: Optional[float] = None,
    ) -> bool:
        """
        Update holding quantity (buy/sell).

        Args:
            holding_id: The holding ID
            quantity_delta: Amount to add (positive) or subtract (negative)
            avg_cost: New average cost (for buys)

        Returns:
            True if updated successfully
        """
        pass


class IAccountRepository(IRepository["AccountModel"]):
    """
    Account-specific repository interface.
    """

    @abstractmethod
    async def get_by_username(
        self,
        username: str,
        projection: Optional[Dict[str, int]] = None,
    ) -> List["AccountModel"]:
        """
        Get all accounts for a user.

        Args:
            username: The user's username
            projection: Optional field projection

        Returns:
            List of accounts
        """
        pass

    @abstractmethod
    async def get_by_account_name(
        self,
        username: str,
        account_name: str,
        projection: Optional[Dict[str, int]] = None,
    ) -> Optional["AccountModel"]:
        """
        Get a specific account by username and account name.

        Args:
            username: The user's username
            account_name: The account name (client_account_name)
            projection: Optional field projection

        Returns:
            The account if found, None otherwise
        """
        pass

    @abstractmethod
    async def get_by_account_no(
        self,
        username: str,
        account_no: str,
    ) -> Optional["AccountModel"]:
        """
        Get a specific account by username and account number.

        Args:
            username: The user's username
            account_no: The account number

        Returns:
            The account if found, None otherwise
        """
        pass

    @abstractmethod
    async def create_account(
        self,
        username: str,
        account_name: str,
        account_no: str,
        open_date: Optional[str] = None,
        **kwargs,
    ) -> str:
        """
        Create a new account.

        Args:
            username: The user's username
            account_name: The account name
            account_no: The account number
            open_date: Account open date
            **kwargs: Additional fields

        Returns:
            The ID of the created account
        """
        pass

    @abstractmethod
    async def update_account(
        self,
        account_id: str,
        updates: Dict[str, Any],
    ) -> bool:
        """
        Update an account with arbitrary fields.

        Args:
            account_id: The account ID
            updates: Dictionary of fields to update

        Returns:
            True if updated successfully
        """
        pass

    @abstractmethod
    async def update_balance(
        self,
        account_id: str,
        amount_delta: float,
    ) -> Tuple[bool, float]:
        """
        Update account balance atomically.

        Args:
            account_id: The account ID
            amount_delta: Amount to add (positive) or subtract (negative)

        Returns:
            Tuple of (success, new_balance)
        """
        pass

    @abstractmethod
    async def delete_account(
        self,
        account_id: str,
        username: str,
    ) -> bool:
        """
        Delete an account (with ownership check).

        Args:
            account_id: The account ID
            username: The username (for ownership verification)

        Returns:
            True if deleted successfully
        """
        pass

    @abstractmethod
    async def account_exists(
        self,
        username: str,
        account_no: str,
    ) -> bool:
        """
        Check if an account exists by username and account number.

        Args:
            username: The user's username
            account_no: The account number

        Returns:
            True if account exists
        """
        pass


class IPriceAlertRepository(IRepository["PriceAlertModel"]):
    """
    Price alert-specific repository interface.
    """

    @abstractmethod
    async def get_active_alerts(
        self,
        user_id: str,
        portfolio_id: Optional[str] = None,
    ) -> List["PriceAlertModel"]:
        """
        Get active price alerts for a user.

        Args:
            user_id: The user's ID
            portfolio_id: Optional portfolio filter

        Returns:
            List of active alerts
        """
        pass

    @abstractmethod
    async def get_alerts_for_ticker(
        self,
        ticker: str,
        active_only: bool = True,
    ) -> List["PriceAlertModel"]:
        """
        Get all alerts for a specific ticker.

        Args:
            ticker: Stock ticker symbol
            active_only: Only return active alerts

        Returns:
            List of alerts
        """
        pass

    @abstractmethod
    async def trigger_alert(
        self,
        alert_id: str,
        triggered_price: float,
    ) -> bool:
        """
        Mark an alert as triggered.

        Args:
            alert_id: The alert ID
            triggered_price: The price that triggered the alert

        Returns:
            True if successful
        """
        pass
