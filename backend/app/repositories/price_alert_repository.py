# app/repositories/price_alert_repository.py
"""
Price Alert Repository Implementation.

Handles all database operations for price alerts.
Replaces DAL functions from app/models/notification.py
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging

from app.repositories.base import BaseRepository
from app.models.notification import PriceAlertModel

logger = logging.getLogger(__name__)


class PriceAlertRepository(BaseRepository[PriceAlertModel]):
    """
    Repository for price alert database operations.
    """

    collection_name = "price_alerts"
    model_class = PriceAlertModel

    async def create_alert(self, alert: PriceAlertModel) -> str:
        """
        Create a new price alert.

        Args:
            alert: The price alert model to create

        Returns:
            The ID of the created alert
        """
        doc = alert.to_mongo() if hasattr(alert, 'to_mongo') else self._to_dict(alert)

        try:
            result = await self.collection.insert_one(doc)
            alert_id = str(result.inserted_id)
            logger.debug("Created price alert %s for user %s", alert_id, alert.user_id)
            return alert_id
        except Exception as e:
            logger.error("Error creating price alert: %s", e)
            raise

    async def get_user_alerts(
        self,
        user_id: str,
        is_active: Optional[bool] = None,
        ticker: Optional[str] = None,
        portfolio_id: Optional[str] = None,
        include_global: bool = True,
    ) -> List[PriceAlertModel]:
        """
        Get price alerts for a user.

        Args:
            user_id: The user's ID
            is_active: Filter by active status
            ticker: Filter by ticker symbol
            portfolio_id: Filter by portfolio
            include_global: Include global alerts

        Returns:
            List of price alerts
        """
        query: Dict[str, Any] = {"user_id": user_id}

        if is_active is not None:
            query["is_active"] = is_active
        if ticker:
            query["ticker"] = ticker.upper()

        # Portfolio filtering
        if portfolio_id:
            if include_global:
                query["$or"] = [
                    {"portfolio_id": portfolio_id},
                    {"is_global": True},
                ]
            else:
                query["portfolio_id"] = portfolio_id

        return await self.get_all(
            filters=query,
            sort=[("created_at", -1)],
        )

    async def get_active_alerts(
        self,
        user_id: str,
        portfolio_id: Optional[str] = None,
    ) -> List[PriceAlertModel]:
        """
        Get active price alerts for a user.

        Args:
            user_id: The user's ID
            portfolio_id: Optional portfolio filter

        Returns:
            List of active alerts
        """
        return await self.get_user_alerts(
            user_id=user_id,
            is_active=True,
            portfolio_id=portfolio_id,
        )

    async def get_alerts_for_ticker(
        self,
        ticker: str,
        active_only: bool = True,
    ) -> List[PriceAlertModel]:
        """
        Get all alerts for a specific ticker (across all users).

        Args:
            ticker: Stock ticker symbol
            active_only: Only return active alerts

        Returns:
            List of alerts
        """
        query: Dict[str, Any] = {
            "ticker": ticker.upper(),
        }

        if active_only:
            query["is_active"] = True
            query["triggered"] = False

        return await self.get_all(filters=query)

    async def get_portfolio_alerts_for_ticker(
        self,
        ticker: str,
        portfolio_id: str,
    ) -> List[PriceAlertModel]:
        """
        Get all active alerts for a ticker in a specific portfolio.

        Args:
            ticker: Stock ticker symbol
            portfolio_id: Portfolio ID

        Returns:
            List of alerts
        """
        return await self.get_all(
            filters={
                "ticker": ticker.upper(),
                "portfolio_id": portfolio_id,
                "is_active": True,
                "triggered": False,
            }
        )

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
        object_id = self._to_object_id(alert_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "triggered": True,
                        "triggered_at": datetime.now(timezone.utc),
                        "triggered_price": triggered_price,
                        "is_active": False,  # Deactivate after triggering
                    }
                },
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error triggering alert %s: %s", alert_id, e)
            raise

    async def delete_alert(self, alert_id: str, user_id: str) -> bool:
        """
        Delete a price alert (with user verification).

        Args:
            alert_id: The alert ID
            user_id: The user ID (for ownership verification)

        Returns:
            True if deleted
        """
        object_id = self._to_object_id(alert_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.delete_one(
                {"_id": object_id, "user_id": user_id}
            )
            return result.deleted_count > 0
        except Exception as e:
            logger.error("Error deleting alert %s: %s", alert_id, e)
            raise

    async def update_alert(
        self,
        alert_id: str,
        user_id: str,
        updates: Dict[str, Any],
    ) -> Optional[PriceAlertModel]:
        """
        Update a price alert.

        Args:
            alert_id: The alert ID
            user_id: The user ID (for ownership verification)
            updates: Fields to update

        Returns:
            The updated alert, or None if not found
        """
        object_id = self._to_object_id(alert_id)
        if object_id is None:
            return None

        try:
            result = await self.collection.find_one_and_update(
                {"_id": object_id, "user_id": user_id},
                {"$set": updates},
                return_document=True,
            )

            if result:
                if hasattr(PriceAlertModel, 'from_mongo'):
                    return PriceAlertModel.from_mongo(result)
                return self._to_model(result)
            return None
        except Exception as e:
            logger.error("Error updating alert %s: %s", alert_id, e)
            raise

    async def deactivate_expired_alerts(self) -> int:
        """
        Deactivate alerts that have expired.

        Returns:
            Number of alerts deactivated
        """
        now = datetime.now(timezone.utc)

        try:
            result = await self.collection.update_many(
                {
                    "is_active": True,
                    "expires_at": {"$lt": now},
                },
                {
                    "$set": {"is_active": False}
                },
            )
            return result.modified_count
        except Exception as e:
            logger.error("Error deactivating expired alerts: %s", e)
            raise
