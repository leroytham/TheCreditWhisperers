# app/repositories/notification_repository.py
"""
Notification Repository Implementation.

Handles all database operations for notifications, including:
- User notification retrieval with portfolio filtering
- Marking notifications as read/unread
- Archiving and deletion
- Unread count queries

Replaces DAL functions from app/models/notification.py
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging

from app.repositories.base import BaseRepository
from app.models.notification import NotificationModel

logger = logging.getLogger(__name__)


class NotificationRepository(BaseRepository[NotificationModel]):
    """
    Repository for notification database operations.

    Implements all notification-related data access previously in notification.py.
    Uses Motor (async MongoDB) for non-blocking database operations.
    """

    collection_name = "notifications"
    model_class = NotificationModel

    async def get_user_notifications(
        self,
        user_id: str,
        portfolio_id: Optional[str] = None,
        include_global: bool = True,
        is_read: Optional[bool] = None,
        is_archived: Optional[bool] = None,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[NotificationModel]:
        """
        Get notifications for a user with optional portfolio filtering.

        Args:
            user_id: The user's ID
            portfolio_id: Filter by specific portfolio (optional)
            include_global: Include global notifications when filtering by portfolio
            is_read: Filter by read status (None = all)
            is_archived: Filter by archived status (None = all)
            category: Filter by notification category
            limit: Maximum results to return
            offset: Pagination offset

        Returns:
            List of notifications sorted by created_at (descending)
        """
        query: Dict[str, Any] = {"user_id": user_id}

        if is_archived is not None:
            query["is_archived"] = is_archived

        if is_read is not None:
            query["is_read"] = is_read

        if category:
            query["category"] = category

        # Portfolio filtering
        if portfolio_id:
            if include_global:
                query["$or"] = [
                    {"portfolio_id": portfolio_id},
                    {"is_global": True},
                ]
            else:
                query["portfolio_id"] = portfolio_id
        elif not include_global:
            query["is_global"] = False

        return await self.get_all(
            filters=query,
            limit=limit,
            offset=offset,
            sort=[("created_at", -1)],
        )

    async def create_notification(self, notification: NotificationModel) -> str:
        """
        Create a new notification with default expiration.

        Args:
            notification: The notification model to create

        Returns:
            The ID of the created notification
        """
        doc = notification.to_mongo() if hasattr(notification, 'to_mongo') else self._to_dict(notification)

        # Set expiration if not specified (default 365 days)
        if 'expires_at' not in doc or doc.get('expires_at') is None:
            doc['expires_at'] = datetime.now(timezone.utc) + timedelta(days=365)

        try:
            result = await self.collection.insert_one(doc)
            notification_id = str(result.inserted_id)
            logger.debug("Created notification %s for user %s", notification_id, notification.user_id)
            return notification_id
        except Exception as e:
            logger.error("Error creating notification: %s", e)
            raise

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

    async def mark_single_as_read(self, notification_id: str, user_id: str) -> bool:
        """
        Mark a single notification as read (with user verification).

        Args:
            notification_id: The notification ID
            user_id: The user ID (for ownership verification)

        Returns:
            True if notification was marked as read
        """
        object_id = self._to_object_id(notification_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.update_one(
                {"_id": object_id, "user_id": user_id},
                {
                    "$set": {
                        "is_read": True,
                        "read_at": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error marking notification as read: %s", e)
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
            "is_archived": False,
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
        include_global: bool = True,
    ) -> int:
        """
        Get count of unread notifications.

        Args:
            user_id: The user's ID
            portfolio_id: Optional portfolio filter
            include_global: Include global notifications in count

        Returns:
            Count of unread notifications
        """
        query: Dict[str, Any] = {
            "user_id": user_id,
            "is_read": False,
            "is_archived": False,
        }

        if portfolio_id:
            if include_global:
                query["$or"] = [
                    {"portfolio_id": portfolio_id},
                    {"is_global": True},
                ]
            else:
                query["portfolio_id"] = portfolio_id

        return await self.count(query)

    async def archive_notification(self, notification_id: str, user_id: str) -> bool:
        """
        Archive a notification.

        Args:
            notification_id: The notification ID
            user_id: The user ID (for ownership verification)

        Returns:
            True if notification was archived
        """
        object_id = self._to_object_id(notification_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.update_one(
                {"_id": object_id, "user_id": user_id},
                {
                    "$set": {
                        "is_archived": True,
                        "archived_at": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error archiving notification: %s", e)
            raise

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

    async def delete_notification(self, notification_id: str, user_id: str) -> bool:
        """
        Delete a notification (with user verification).

        Args:
            notification_id: The notification ID
            user_id: The user ID (for ownership verification)

        Returns:
            True if notification was deleted
        """
        object_id = self._to_object_id(notification_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.delete_one(
                {"_id": object_id, "user_id": user_id}
            )
            return result.deleted_count > 0
        except Exception as e:
            logger.error("Error deleting notification: %s", e)
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

    async def clear_notifications(
        self,
        user_id: str,
        is_archived: Optional[bool] = None,
    ) -> int:
        """
        Clear notifications for a user.

        Args:
            user_id: The user's ID
            is_archived: Optional filter for archived/active notifications

        Returns:
            Number of notifications deleted
        """
        query: Dict[str, Any] = {"user_id": user_id}
        if is_archived is not None:
            query["is_archived"] = is_archived

        return await self.delete_many(query)

    async def get_multi_portfolio_notifications(
        self,
        user_id: str,
        portfolio_ids: List[str],
        include_global: bool = True,
        limit: int = 50,
        offset: int = 0,
    ) -> List[NotificationModel]:
        """
        Get notifications for multiple portfolios.

        Args:
            user_id: The user's ID
            portfolio_ids: List of portfolio IDs to include
            include_global: Include global notifications
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of notifications
        """
        query: Dict[str, Any] = {
            "user_id": user_id,
            "is_archived": False,
        }

        if include_global:
            query["$or"] = [
                {"portfolio_id": {"$in": portfolio_ids}},
                {"is_global": True},
            ]
        else:
            query["portfolio_id"] = {"$in": portfolio_ids}

        return await self.get_all(
            filters=query,
            limit=limit,
            offset=offset,
            sort=[("created_at", -1)],
        )

    async def get_total_count(
        self,
        user_id: str,
        is_archived: Optional[bool] = None,
        is_read: Optional[bool] = None,
        category: Optional[str] = None,
        portfolio_id: Optional[str] = None,
        include_global: bool = True,
    ) -> int:
        """
        Get total count of notifications matching filters.

        Args:
            user_id: The user's ID
            is_archived: Filter by archived status
            is_read: Filter by read status
            category: Filter by category
            portfolio_id: Filter by portfolio
            include_global: Include global notifications

        Returns:
            Total count of matching notifications
        """
        query: Dict[str, Any] = {"user_id": user_id}

        if is_archived is not None:
            query["is_archived"] = is_archived
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

        return await self.count(query)
