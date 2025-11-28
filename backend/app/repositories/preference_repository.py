# app/repositories/preference_repository.py
"""
Notification Preference Repository Implementation.

Handles all database operations for user notification preferences.
"""

from typing import Optional, Dict, Any
from datetime import datetime, timezone
import logging

from app.repositories.base import BaseRepository
from app.models.notification import NotificationPreferenceModel

logger = logging.getLogger(__name__)


class PreferenceRepository(BaseRepository[NotificationPreferenceModel]):
    """
    Repository for notification preference database operations.
    """

    collection_name = "notification_preferences"
    model_class = NotificationPreferenceModel

    async def get_or_create(self, user_id: str) -> NotificationPreferenceModel:
        """
        Get or create notification preferences for a user.

        Args:
            user_id: The user's ID

        Returns:
            The user's notification preferences
        """
        doc = await self.find_one({"user_id": user_id})

        if doc:
            if isinstance(doc, NotificationPreferenceModel):
                return doc
            return NotificationPreferenceModel.from_mongo(doc) if hasattr(NotificationPreferenceModel, 'from_mongo') else NotificationPreferenceModel(**doc)

        # Create default preferences
        prefs = NotificationPreferenceModel(user_id=user_id)
        doc = prefs.to_mongo() if hasattr(prefs, 'to_mongo') else self._to_dict(prefs)

        try:
            await self.collection.insert_one(doc)
            return prefs
        except Exception as e:
            logger.error("Error creating preferences for user %s: %s", user_id, e)
            raise

    async def update_preferences(
        self,
        user_id: str,
        updates: Dict[str, Any],
    ) -> NotificationPreferenceModel:
        """
        Update notification preferences for a user.

        Args:
            user_id: The user's ID
            updates: Dictionary of fields to update

        Returns:
            The updated preferences
        """
        # Ensure updated_at is set
        updates["updated_at"] = datetime.now(timezone.utc)

        try:
            await self.collection.update_one(
                {"user_id": user_id},
                {"$set": updates},
                upsert=True,
            )
            return await self.get_or_create(user_id)
        except Exception as e:
            logger.error("Error updating preferences for user %s: %s", user_id, e)
            raise

    async def get_by_user(self, user_id: str) -> Optional[NotificationPreferenceModel]:
        """
        Get preferences for a user (without creating if not exists).

        Args:
            user_id: The user's ID

        Returns:
            The preferences if they exist, None otherwise
        """
        return await self.find_one({"user_id": user_id})

    async def delete_user_preferences(self, user_id: str) -> bool:
        """
        Delete preferences for a user.

        Args:
            user_id: The user's ID

        Returns:
            True if preferences were deleted
        """
        result = await self.collection.delete_one({"user_id": user_id})
        return result.deleted_count > 0
