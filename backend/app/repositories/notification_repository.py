# app/repositories/notification_repository.py
"""
Notification Repository Implementation.

Handles all database operations for notifications, including:
- User notification retrieval with portfolio filtering
- Marking notifications as read/unread
- Archiving and deletion
- Unread count queries

This will be fully implemented in Phase 2.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class NotificationRepository(BaseRepository):
    """
    Repository for notification database operations.

    Implements INotificationRepository interface with Motor (async MongoDB).
    """

    collection_name = "notifications"
    model_class = None  # Will be set to NotificationModel in Phase 2

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
    ) -> List[Dict[str, Any]]:
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
        query: Dict[str, Any] = {
            "user_id": user_id,
            "is_archived": is_archived,
        }

        if is_read is not None:
            query["is_read"] = is_read

        if category:
            query["category"] = category

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
            limit=limit,
            offset=offset,
            sort=[("created_at", -1)],
        )

    async def mark_as_read(self, notification_ids: List[str]) -> int:
        """
        Mark multiple notifications as read.

        Args:
            notification_ids: List of notification IDs to mark as read

        Returns:
            Number of notifications actually marked as read
        """
        if not notification_ids:
            return 0

        try:
            object_ids = [ObjectId(nid) for nid in notification_ids]
            result = await self.collection.update_many(
                {"_id": {"$in": object_ids}},
                {
                    "$set": {
                        "is_read": True,
                        "read_at": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count
        except Exception as e:
            logger.error("Error marking notifications as read: %s", e)
            raise

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
        query: Dict[str, Any] = {
            "user_id": user_id,
            "is_read": False,
        }

        if portfolio_id:
            query["$or"] = [
                {"portfolio_id": portfolio_id},
                {"is_global": True},
            ]

        try:
            result = await self.collection.update_many(
                query,
                {
                    "$set": {
                        "is_read": True,
                        "read_at": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count
        except Exception as e:
            logger.error("Error marking all notifications as read: %s", e)
            raise

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
        query: Dict[str, Any] = {
            "user_id": user_id,
            "is_read": False,
            "is_archived": False,
        }

        if portfolio_id:
            query["$or"] = [
                {"portfolio_id": portfolio_id},
                {"is_global": True},
            ]

        return await self.count(query)

    async def archive_notifications(self, notification_ids: List[str]) -> int:
        """
        Archive multiple notifications.

        Args:
            notification_ids: List of notification IDs to archive

        Returns:
            Number of notifications archived
        """
        if not notification_ids:
            return 0

        try:
            object_ids = [ObjectId(nid) for nid in notification_ids]
            result = await self.collection.update_many(
                {"_id": {"$in": object_ids}},
                {
                    "$set": {
                        "is_archived": True,
                        "archived_at": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count
        except Exception as e:
            logger.error("Error archiving notifications: %s", e)
            raise

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
        return await self.delete_many(
            {
                "user_id": user_id,
                "created_at": {"$lt": older_than},
            }
        )
