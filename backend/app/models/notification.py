# app/models/notification.py
"""
Notification models for MongoDB with Pydantic validation.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, validator
from bson import ObjectId
from enum import Enum

from app.core.alert_validators import (
    validate_alert_condition,
    check_price_condition,
    AlertCondition as AlertConditionBase,
)

class NotificationType(str, Enum):
    """Notification type enumeration."""
    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    CRITICAL = "critical"

class NotificationCategory(str, Enum):
    """Notification category enumeration."""
    PORTFOLIO = "Portfolio"
    MARKET = "Market"
    NEWS = "News"
    SYSTEM = "System"

class NotificationPriority(str, Enum):
    """Notification priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

# Re-export AlertCondition from the validators module for backward compatibility
AlertCondition = AlertConditionBase


class NotificationModel(BaseModel):
    """
    MongoDB notification document model.
    """
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="User ID who receives the notification")

    # Portfolio context (new fields for portfolio-aware notifications)
    portfolio_id: Optional[str] = Field(None, description="Portfolio ID this notification relates to")
    portfolio_name: Optional[str] = Field(None, description="Portfolio name for display")
    is_global: bool = Field(False, description="True if notification applies to all portfolios")
    affected_tickers: List[str] = Field(default_factory=list, description="Tickers affected by this notification")
    holding_ids: List[str] = Field(default_factory=list, description="Specific holding IDs affected")

    # Core fields
    type: NotificationType
    category: NotificationCategory
    subcategory: Optional[str] = None
    priority: NotificationPriority = NotificationPriority.MEDIUM

    # Content
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=1000)
    preview: Optional[str] = Field(None, max_length=100)

    # Rich content (stored as dictionaries in MongoDB)
    signal_analysis: Optional[Dict[str, Any]] = None
    portfolio_impact: Optional[Dict[str, Any]] = None
    account_servicing: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

    # State tracking
    is_read: bool = False
    is_archived: bool = False
    read_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    # UI hints
    show_as_toast: bool = True
    duration: Optional[int] = Field(None, description="Toast duration in ms")
    action_url: Optional[str] = Field(None, max_length=500)
    modal_title: Optional[str] = Field(None, max_length=100)
    subject: Optional[str] = None
    body: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

    @validator('id', pre=True)
    def convert_object_id(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        return v

    @validator('metadata')
    def validate_metadata_size(cls, v):
        """Prevent huge metadata objects."""
        if v:
            import json
            if len(json.dumps(v, default=str)) > 10000:  # 10KB limit
                raise ValueError('Metadata too large (max 10KB)')
        return v

    def to_mongo(self) -> Dict:
        """Convert to MongoDB document format."""
        doc = self.dict(by_alias=True, exclude_none=True)
        if 'id' in doc and doc['id']:
            doc['_id'] = ObjectId(doc['id'])
        else:
            doc.pop('_id', None)
        return doc

    @classmethod
    def from_mongo(cls, doc: Dict) -> 'NotificationModel':
        """Create model from MongoDB document."""
        if doc and '_id' in doc:
            doc['_id'] = str(doc['_id'])
        return cls(**doc) if doc else None


class NotificationPreferenceModel(BaseModel):
    """
    User notification preferences stored in MongoDB.
    """
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="User ID")

    # Category toggles
    enable_portfolio: bool = True
    enable_market: bool = True
    enable_news: bool = True
    enable_system: bool = True

    # Delivery preferences
    enable_toast: bool = True
    enable_websocket: bool = True
    enable_email: bool = False  # Future feature
    enable_sms: bool = False    # Future feature

    # Priority thresholds
    min_priority: NotificationPriority = NotificationPriority.LOW

    # Quiet hours (optional, future feature)
    quiet_hours_start: Optional[int] = None  # Hour of day (0-23)
    quiet_hours_end: Optional[int] = None

    # Subscription settings
    subscribed_tickers: List[str] = Field(default_factory=list)
    watchlist_notifications: bool = True
    portfolio_notifications: bool = True

    # Portfolio-specific preferences (new fields)
    enabled_portfolios: List[str] = Field(default_factory=list, description="List of portfolio IDs to receive notifications for")
    portfolio_preferences: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Per-portfolio preference overrides")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

    @validator('id', pre=True)
    def convert_object_id(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        return v

    def to_mongo(self) -> Dict:
        """Convert to MongoDB document format."""
        doc = self.dict(by_alias=True, exclude_none=True)
        if 'id' in doc and doc['id']:
            doc['_id'] = ObjectId(doc['id'])
        else:
            doc.pop('_id', None)
        doc['updated_at'] = datetime.utcnow()  # Always update timestamp
        return doc

    @classmethod
    def from_mongo(cls, doc: Dict) -> 'NotificationPreferenceModel':
        """Create model from MongoDB document."""
        if doc and '_id' in doc:
            doc['_id'] = str(doc['_id'])
        return cls(**doc) if doc else None


class PriceAlertModel(BaseModel):
    """
    Price alert configuration stored in MongoDB.
    """
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="User ID who created the alert")
    ticker: str = Field(..., description="Stock ticker symbol")

    # Portfolio context (new fields)
    portfolio_id: Optional[str] = Field(None, description="Portfolio ID this alert belongs to")
    portfolio_name: Optional[str] = Field(None, description="Portfolio name for display")
    is_global: bool = Field(False, description="True if alert applies to ticker across all portfolios")

    # Alert configuration
    condition: AlertCondition
    target_price: Optional[float] = Field(None, gt=0)
    base_price: Optional[float] = Field(None, gt=0)
    percent_change: Optional[float] = Field(None, description="Percentage for percent conditions")

    # State
    is_active: bool = True
    triggered: bool = False
    triggered_at: Optional[datetime] = None
    triggered_price: Optional[float] = None

    # Notification settings
    notification_title: Optional[str] = None
    notification_message: Optional[str] = None
    priority: NotificationPriority = NotificationPriority.HIGH

    # Metadata
    notes: Optional[str] = Field(None, max_length=500)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None  # Optional expiration

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

    @validator('id', pre=True)
    def convert_object_id(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        return v

    @validator('condition')
    def validate_condition_fields(cls, v, values):
        """Validate that required fields are present for the condition."""
        return validate_alert_condition(v, values)

    def check_condition(self, current_price: float) -> bool:
        """Check if the alert condition is met."""
        if not self.is_active or self.triggered:
            return False

        return check_price_condition(
            condition=self.condition,
            current_price=current_price,
            target_price=self.target_price,
            base_price=self.base_price,
            percent_change=self.percent_change,
        )

    def to_mongo(self) -> Dict:
        """Convert to MongoDB document format."""
        doc = self.dict(by_alias=True, exclude_none=True)
        if 'id' in doc and doc['id']:
            doc['_id'] = ObjectId(doc['id'])
        else:
            doc.pop('_id', None)
        return doc

    @classmethod
    def from_mongo(cls, doc: Dict) -> 'PriceAlertModel':
        """Create model from MongoDB document."""
        if doc and '_id' in doc:
            doc['_id'] = str(doc['_id'])
        return cls(**doc) if doc else None


# =============================================================================
# DEPRECATED: Data Access Layer Functions
# =============================================================================
# These functions have been moved to the Repository Pattern implementation.
# See: app/repositories/notification_repository.py
#      app/repositories/preference_repository.py
#      app/repositories/price_alert_repository.py
#
# The functions below are kept for backward compatibility with existing code
# that hasn't been migrated yet. New code should use the repositories directly.
# =============================================================================

# Re-export repository factory functions for backward compatibility
# This allows existing code using `from app.models.notification import create_notification`
# to continue working while we migrate to the repository pattern.

async def create_notification(notification: NotificationModel) -> str:
    """
    DEPRECATED: Use NotificationRepository.create_notification() instead.

    Create a new notification in MongoDB.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.create_notification(notification)


async def get_notifications(
    user_id: str,
    is_archived: Optional[bool] = None,
    is_read: Optional[bool] = None,
    category: Optional[str] = None,
    portfolio_id: Optional[str] = None,
    include_global: bool = True,
    limit: int = 50,
    offset: int = 0
) -> List[NotificationModel]:
    """
    DEPRECATED: Use NotificationRepository.get_user_notifications() instead.

    Get notifications for a user with filters.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.get_user_notifications(
        user_id=user_id,
        is_archived=is_archived,
        is_read=is_read,
        category=category,
        portfolio_id=portfolio_id,
        include_global=include_global,
        limit=limit,
        offset=offset,
    )


async def get_unread_count(user_id: str) -> int:
    """
    DEPRECATED: Use NotificationRepository.get_unread_count() instead.

    Get count of unread notifications for a user.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.get_unread_count(user_id)


async def mark_as_read(notification_id: str, user_id: str) -> bool:
    """
    DEPRECATED: Use NotificationRepository.mark_single_as_read() instead.

    Mark a notification as read.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.mark_single_as_read(notification_id, user_id)


async def mark_all_as_read(user_id: str) -> int:
    """
    DEPRECATED: Use NotificationRepository.mark_all_as_read() instead.

    Mark all notifications as read for a user.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.mark_all_as_read(user_id)


async def archive_notification(notification_id: str, user_id: str) -> bool:
    """
    DEPRECATED: Use NotificationRepository.archive_notification() instead.

    Archive a notification.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.archive_notification(notification_id, user_id)


async def delete_notification(notification_id: str, user_id: str) -> bool:
    """
    DEPRECATED: Use NotificationRepository.delete_notification() instead.

    Delete a notification.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.delete_notification(notification_id, user_id)


async def get_or_create_preferences(user_id: str) -> NotificationPreferenceModel:
    """
    DEPRECATED: Use PreferenceRepository.get_or_create() instead.

    Get or create notification preferences for a user.
    """
    from app.repositories.factory import get_preference_repository
    repo = get_preference_repository()
    return await repo.get_or_create(user_id)


async def update_preferences(user_id: str, updates: Dict[str, Any]) -> NotificationPreferenceModel:
    """
    DEPRECATED: Use PreferenceRepository.update_preferences() instead.

    Update notification preferences for a user.
    """
    from app.repositories.factory import get_preference_repository
    repo = get_preference_repository()
    return await repo.update_preferences(user_id, updates)


async def create_price_alert(alert: PriceAlertModel) -> str:
    """
    DEPRECATED: Use PriceAlertRepository.create_alert() instead.

    Create a new price alert.
    """
    from app.repositories.factory import get_price_alert_repository
    repo = get_price_alert_repository()
    return await repo.create_alert(alert)


async def get_price_alerts(
    user_id: str,
    is_active: Optional[bool] = None,
    ticker: Optional[str] = None,
    portfolio_id: Optional[str] = None,
    include_global: bool = True
) -> List[PriceAlertModel]:
    """
    DEPRECATED: Use PriceAlertRepository.get_user_alerts() instead.

    Get price alerts for a user.
    """
    from app.repositories.factory import get_price_alert_repository
    repo = get_price_alert_repository()
    return await repo.get_user_alerts(
        user_id=user_id,
        is_active=is_active,
        ticker=ticker,
        portfolio_id=portfolio_id,
        include_global=include_global,
    )


async def get_active_alerts_for_ticker(ticker: str) -> List[PriceAlertModel]:
    """
    DEPRECATED: Use PriceAlertRepository.get_alerts_for_ticker() instead.

    Get all active alerts for a specific ticker (across all users).
    """
    from app.repositories.factory import get_price_alert_repository
    repo = get_price_alert_repository()
    return await repo.get_alerts_for_ticker(ticker)


async def trigger_price_alert(alert_id: str, triggered_price: float) -> bool:
    """
    DEPRECATED: Use PriceAlertRepository.trigger_alert() instead.

    Mark a price alert as triggered.
    """
    from app.repositories.factory import get_price_alert_repository
    repo = get_price_alert_repository()
    return await repo.trigger_alert(alert_id, triggered_price)


async def delete_price_alert(alert_id: str, user_id: str) -> bool:
    """
    DEPRECATED: Use PriceAlertRepository.delete_alert() instead.

    Delete a price alert.
    """
    from app.repositories.factory import get_price_alert_repository
    repo = get_price_alert_repository()
    return await repo.delete_alert(alert_id, user_id)


# Portfolio-specific notification functions (deprecated wrappers)

async def get_portfolio_notifications(
    user_id: str,
    portfolio_id: str,
    include_global: bool = True,
    limit: int = 50,
    offset: int = 0
) -> List[NotificationModel]:
    """
    DEPRECATED: Use NotificationRepository.get_user_notifications() instead.

    Get notifications for a specific portfolio.
    """
    return await get_notifications(
        user_id=user_id,
        portfolio_id=portfolio_id,
        include_global=include_global,
        limit=limit,
        offset=offset
    )


async def get_portfolio_unread_count(
    user_id: str,
    portfolio_id: str,
    include_global: bool = True
) -> int:
    """
    DEPRECATED: Use NotificationRepository.get_unread_count() instead.

    Get count of unread notifications for a specific portfolio.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.get_unread_count(
        user_id=user_id,
        portfolio_id=portfolio_id,
        include_global=include_global,
    )


async def get_multi_portfolio_notifications(
    user_id: str,
    portfolio_ids: List[str],
    include_global: bool = True,
    limit: int = 50,
    offset: int = 0
) -> List[NotificationModel]:
    """
    DEPRECATED: Use NotificationRepository.get_multi_portfolio_notifications() instead.

    Get notifications for multiple portfolios.
    """
    from app.repositories.factory import get_notification_repository
    repo = get_notification_repository()
    return await repo.get_multi_portfolio_notifications(
        user_id=user_id,
        portfolio_ids=portfolio_ids,
        include_global=include_global,
        limit=limit,
        offset=offset,
    )


async def get_portfolio_alerts_for_ticker(
    ticker: str,
    portfolio_id: str
) -> List[PriceAlertModel]:
    """
    DEPRECATED: Use PriceAlertRepository.get_portfolio_alerts_for_ticker() instead.

    Get all active alerts for a ticker in a specific portfolio.
    """
    from app.repositories.factory import get_price_alert_repository
    repo = get_price_alert_repository()
    return await repo.get_portfolio_alerts_for_ticker(ticker, portfolio_id)