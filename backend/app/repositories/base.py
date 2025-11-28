# app/repositories/base.py
"""
Base Repository Implementation.

Provides common CRUD operations for all repositories using Motor (async MongoDB).
Subclasses define collection_name and optionally model_class for automatic conversion.

Design Decisions:
- Uses lazy initialization for database connection (via property)
- Supports both Pydantic models and raw dictionaries
- All methods include proper error handling and logging
- Thread-safe via Motor's async design
"""

from typing import Generic, TypeVar, Optional, List, Dict, Any, Type, Union
from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
import logging

from app.database import get_motor_database

logger = logging.getLogger(__name__)

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """
    Generic base repository with common CRUD operations.

    Subclasses must set:
        - collection_name: str - The MongoDB collection name
        - model_class: Type[T] (optional) - Pydantic model for automatic conversion

    Example:
        class NotificationRepository(BaseRepository[NotificationModel]):
            collection_name = "notifications"
            model_class = NotificationModel

            async def get_user_notifications(self, user_id: str) -> List[NotificationModel]:
                return await self.get_all(filters={"user_id": user_id})
    """

    collection_name: str = ""
    model_class: Optional[Type[T]] = None

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        """
        Initialize repository with optional database connection.

        Args:
            db: Optional Motor database instance. If not provided,
                will be lazily loaded from get_motor_database().
        """
        self._db = db
        self._collection: Optional[AsyncIOMotorCollection] = None

    @property
    def db(self) -> AsyncIOMotorDatabase:
        """
        Get the database instance (lazy initialization).

        Returns:
            AsyncIOMotorDatabase instance
        """
        if self._db is None:
            self._db = get_motor_database()
        return self._db

    @property
    def collection(self) -> AsyncIOMotorCollection:
        """
        Get the collection instance (lazy initialization).

        Returns:
            AsyncIOMotorCollection instance

        Raises:
            ValueError: If collection_name is not defined
        """
        if self._collection is None:
            if not self.collection_name:
                raise ValueError(
                    f"{self.__class__.__name__} must define collection_name"
                )
            self._collection = self.db[self.collection_name]
        return self._collection

    def _to_object_id(self, entity_id: str) -> Optional[ObjectId]:
        """
        Convert string ID to ObjectId safely.

        Args:
            entity_id: String representation of ObjectId

        Returns:
            ObjectId if valid, None otherwise
        """
        try:
            return ObjectId(entity_id)
        except InvalidId:
            logger.warning("Invalid ObjectId: %s", entity_id)
            return None

    def _to_model(self, doc: Optional[Dict[str, Any]]) -> Optional[T]:
        """
        Convert MongoDB document to model instance.

        Args:
            doc: MongoDB document dictionary

        Returns:
            Model instance if model_class is defined, dict otherwise
        """
        if doc is None:
            return None

        # Convert ObjectId to string for the _id field
        if "_id" in doc and isinstance(doc["_id"], ObjectId):
            doc["_id"] = str(doc["_id"])

        if self.model_class is None:
            return doc  # type: ignore

        try:
            return self.model_class(**doc)
        except Exception as e:
            logger.error(
                "Error converting document to %s: %s",
                self.model_class.__name__,
                e,
            )
            return doc  # type: ignore

    def _to_dict(self, entity: Union[T, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Convert model instance to MongoDB document.

        Args:
            entity: Pydantic model or dictionary

        Returns:
            Dictionary suitable for MongoDB insertion
        """
        if isinstance(entity, dict):
            return entity

        # Pydantic v2 uses model_dump()
        if hasattr(entity, "model_dump"):
            return entity.model_dump(by_alias=True, exclude_none=True)

        # Pydantic v1 fallback
        if hasattr(entity, "dict"):
            return entity.dict(by_alias=True, exclude_none=True)

        # Fallback for other objects
        return vars(entity) if hasattr(entity, "__dict__") else dict(entity)

    async def get_by_id(self, entity_id: str) -> Optional[T]:
        """
        Get entity by its unique identifier.

        Args:
            entity_id: The MongoDB ObjectId as a string

        Returns:
            The entity if found, None otherwise
        """
        object_id = self._to_object_id(entity_id)
        if object_id is None:
            return None

        try:
            doc = await self.collection.find_one({"_id": object_id})
            return self._to_model(doc)
        except Exception as e:
            logger.error(
                "Error getting %s by ID %s: %s",
                self.collection_name,
                entity_id,
                e,
            )
            raise

    async def get_all(
        self,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
        sort: Optional[List[tuple]] = None,
    ) -> List[T]:
        """
        Get all entities matching the given filters.

        Args:
            filters: MongoDB query filters
            limit: Maximum number of results to return
            offset: Number of results to skip (for pagination)
            sort: List of (field, direction) tuples for sorting

        Returns:
            List of matching entities
        """
        try:
            query = filters or {}
            cursor = self.collection.find(query)

            if offset > 0:
                cursor = cursor.skip(offset)

            if limit > 0:
                cursor = cursor.limit(limit)

            if sort:
                cursor = cursor.sort(sort)

            docs = await cursor.to_list(length=limit if limit > 0 else None)
            return [self._to_model(doc) for doc in docs]
        except Exception as e:
            logger.error(
                "Error getting all from %s with filters %s: %s",
                self.collection_name,
                filters,
                e,
            )
            raise

    async def create(self, entity: Union[T, Dict[str, Any]]) -> str:
        """
        Create a new entity in the database.

        Args:
            entity: The entity to create (model or dict)

        Returns:
            The ID of the created entity
        """
        try:
            doc = self._to_dict(entity)

            # Remove _id if it's None or empty to let MongoDB generate it
            if "_id" in doc and not doc["_id"]:
                del doc["_id"]

            result = await self.collection.insert_one(doc)
            entity_id = str(result.inserted_id)
            logger.debug("Created %s with ID %s", self.collection_name, entity_id)
            return entity_id
        except Exception as e:
            logger.error("Error creating %s: %s", self.collection_name, e)
            raise

    async def create_many(self, entities: List[Union[T, Dict[str, Any]]]) -> List[str]:
        """
        Create multiple entities in a single batch operation.

        Args:
            entities: List of entities to create

        Returns:
            List of created entity IDs
        """
        if not entities:
            return []

        try:
            docs = []
            for entity in entities:
                doc = self._to_dict(entity)
                if "_id" in doc and not doc["_id"]:
                    del doc["_id"]
                docs.append(doc)

            result = await self.collection.insert_many(docs)
            entity_ids = [str(oid) for oid in result.inserted_ids]
            logger.debug("Created %d %s documents", len(entity_ids), self.collection_name)
            return entity_ids
        except Exception as e:
            logger.error("Error creating multiple %s: %s", self.collection_name, e)
            raise

    async def update(self, entity_id: str, updates: Dict[str, Any]) -> bool:
        """
        Update an existing entity.

        Args:
            entity_id: The ID of the entity to update
            updates: Dictionary of field updates

        Returns:
            True if the entity was updated, False otherwise
        """
        object_id = self._to_object_id(entity_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.update_one(
                {"_id": object_id},
                {"$set": updates},
            )
            updated = result.modified_count > 0
            if updated:
                logger.debug("Updated %s %s", self.collection_name, entity_id)
            return updated
        except Exception as e:
            logger.error(
                "Error updating %s %s: %s",
                self.collection_name,
                entity_id,
                e,
            )
            raise

    async def update_many(
        self,
        filters: Dict[str, Any],
        updates: Dict[str, Any],
    ) -> int:
        """
        Update multiple entities matching the filters.

        Args:
            filters: MongoDB query filters
            updates: Dictionary of field updates

        Returns:
            Number of entities updated
        """
        try:
            result = await self.collection.update_many(
                filters,
                {"$set": updates},
            )
            count = result.modified_count
            if count > 0:
                logger.debug(
                    "Updated %d %s documents matching %s",
                    count,
                    self.collection_name,
                    filters,
                )
            return count
        except Exception as e:
            logger.error(
                "Error updating multiple %s: %s",
                self.collection_name,
                e,
            )
            raise

    async def delete(self, entity_id: str) -> bool:
        """
        Delete an entity by ID.

        Args:
            entity_id: The ID of the entity to delete

        Returns:
            True if the entity was deleted, False otherwise
        """
        object_id = self._to_object_id(entity_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.delete_one({"_id": object_id})
            deleted = result.deleted_count > 0
            if deleted:
                logger.debug("Deleted %s %s", self.collection_name, entity_id)
            return deleted
        except Exception as e:
            logger.error(
                "Error deleting %s %s: %s",
                self.collection_name,
                entity_id,
                e,
            )
            raise

    async def delete_many(self, filters: Dict[str, Any]) -> int:
        """
        Delete multiple entities matching the filters.

        Args:
            filters: MongoDB query filters

        Returns:
            Number of entities deleted
        """
        try:
            result = await self.collection.delete_many(filters)
            count = result.deleted_count
            if count > 0:
                logger.debug(
                    "Deleted %d %s documents matching %s",
                    count,
                    self.collection_name,
                    filters,
                )
            return count
        except Exception as e:
            logger.error(
                "Error deleting multiple %s: %s",
                self.collection_name,
                e,
            )
            raise

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count entities matching the given filters.

        Args:
            filters: MongoDB query filters

        Returns:
            Count of matching entities
        """
        try:
            return await self.collection.count_documents(filters or {})
        except Exception as e:
            logger.error(
                "Error counting %s with filters %s: %s",
                self.collection_name,
                filters,
                e,
            )
            raise

    async def exists(self, entity_id: str) -> bool:
        """
        Check if an entity exists by ID.

        Args:
            entity_id: The entity ID to check

        Returns:
            True if the entity exists, False otherwise
        """
        object_id = self._to_object_id(entity_id)
        if object_id is None:
            return False

        try:
            count = await self.collection.count_documents(
                {"_id": object_id},
                limit=1,
            )
            return count > 0
        except Exception as e:
            logger.error(
                "Error checking existence of %s %s: %s",
                self.collection_name,
                entity_id,
                e,
            )
            raise

    async def find_one(self, filters: Dict[str, Any]) -> Optional[T]:
        """
        Find a single entity matching the filters.

        Args:
            filters: MongoDB query filters

        Returns:
            The first matching entity, or None
        """
        try:
            doc = await self.collection.find_one(filters)
            return self._to_model(doc)
        except Exception as e:
            logger.error(
                "Error finding one %s with filters %s: %s",
                self.collection_name,
                filters,
                e,
            )
            raise
