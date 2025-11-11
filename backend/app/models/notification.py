# app/models/notification.py
"""
Notification models for MongoDB with Pydantic validation.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, validator, model_validator
from bson import ObjectId
from enum import Enum

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

class AlertCondition(str, Enum):
    """Price alert condition types."""
    ABOVE = "above"
    BELOW = "below"
    PERCENT_INCREASE = "percent_increase"
    PERCENT_DECREASE = "percent_decrease"

class SentimentAlertCondition(str, Enum):
    """Sentiment alert condition types."""
    BECOMES_BULLISH = "becomes_bullish"  # Sentiment >= 0.35
    BECOMES_BEARISH = "becomes_bearish"  # Sentiment <= -0.35
    BECOMES_NEUTRAL = "becomes_neutral"  # Sentiment between -0.15 and 0.15
    CROSSES_ABOVE = "crosses_above"  # Custom threshold (e.g., > 0.5)
    CROSSES_BELOW = "crosses_below"  # Custom threshold (e.g., < -0.5)
    MOMENTUM_POSITIVE = "momentum_positive"  # Positive momentum > threshold
    MOMENTUM_NEGATIVE = "momentum_negative"  # Negative momentum < threshold

class AlertType(str, Enum):
    """Alert type enumeration."""
    PRICE = "price"
    SENTIMENT = "sentiment"


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


    def check_condition(self, current_price: float) -> bool:
        """Check if the alert condition is met."""
        if not self.is_active or self.triggered:
            return False

        if self.condition == AlertCondition.ABOVE:
            return current_price >= self.target_price
        elif self.condition == AlertCondition.BELOW:
            return current_price <= self.target_price
        elif self.condition == AlertCondition.PERCENT_INCREASE:
            if self.base_price:
                percent_change = ((current_price - self.base_price) / self.base_price) * 100
                return percent_change >= self.percent_change
        elif self.condition == AlertCondition.PERCENT_DECREASE:
            if self.base_price:
                percent_change = ((current_price - self.base_price) / self.base_price) * 100
                return percent_change <= -abs(self.percent_change)

        return False

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
        return cls(**doc)


class SentimentAlertModel(BaseModel):
    """
    Sentiment alert configuration stored in MongoDB.
    """
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="User ID who created the alert")
    ticker: str = Field(..., description="Stock ticker symbol")

    # Portfolio context
    portfolio_id: Optional[str] = Field(None, description="Portfolio ID this alert belongs to")
    portfolio_name: Optional[str] = Field(None, description="Portfolio name for display")
    is_global: bool = Field(False, description="True if alert applies to ticker across all portfolios")

    # Alert configuration
    condition: SentimentAlertCondition
    threshold: Optional[float] = Field(None, ge=-1.0, le=1.0, description="Sentiment threshold for crosses_above/below")
    momentum_threshold: Optional[float] = Field(None, ge=-1.0, le=1.0, description="Momentum threshold")

    # Previous state tracking for cross detection
    last_sentiment_score: Optional[float] = None
    last_momentum: Optional[float] = None
    last_checked_at: Optional[datetime] = None

    # State
    is_active: bool = True
    triggered: bool = False
    triggered_at: Optional[datetime] = None
    triggered_sentiment: Optional[float] = None

    # Notification settings
    notification_title: Optional[str] = None
    notification_message: Optional[str] = None
    priority: NotificationPriority = NotificationPriority.HIGH

    # Metadata
    notes: Optional[str] = Field(None, max_length=500)

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

    def check_condition(self, current_sentiment: float, current_momentum: Optional[float] = None) -> bool:
        """Check if the sentiment alert condition is met."""
        if not self.is_active or self.triggered:
            return False

        # Sentiment thresholds from scoring config
        BULLISH = 0.35
        BEARISH = -0.35
        NEUTRAL_LOW = -0.15
        NEUTRAL_HIGH = 0.15

        if self.condition == SentimentAlertCondition.BECOMES_BULLISH:
            # Check if crossed into bullish territory
            return (current_sentiment >= BULLISH and
                   (self.last_sentiment_score is None or self.last_sentiment_score < BULLISH))

        elif self.condition == SentimentAlertCondition.BECOMES_BEARISH:
            # Check if crossed into bearish territory
            return (current_sentiment <= BEARISH and
                   (self.last_sentiment_score is None or self.last_sentiment_score > BEARISH))

        elif self.condition == SentimentAlertCondition.BECOMES_NEUTRAL:
            # Check if crossed into neutral territory
            return (NEUTRAL_LOW <= current_sentiment <= NEUTRAL_HIGH and
                   (self.last_sentiment_score is None or
                    self.last_sentiment_score < NEUTRAL_LOW or
                    self.last_sentiment_score > NEUTRAL_HIGH))

        elif self.condition == SentimentAlertCondition.CROSSES_ABOVE:
            # Check if crossed above custom threshold
            if self.threshold is not None:
                return (current_sentiment >= self.threshold and
                       (self.last_sentiment_score is None or self.last_sentiment_score < self.threshold))

        elif self.condition == SentimentAlertCondition.CROSSES_BELOW:
            # Check if crossed below custom threshold
            if self.threshold is not None:
                return (current_sentiment <= self.threshold and
                       (self.last_sentiment_score is None or self.last_sentiment_score > self.threshold))

        elif self.condition == SentimentAlertCondition.MOMENTUM_POSITIVE:
            # Check if momentum crossed above threshold
            if current_momentum is not None and self.momentum_threshold is not None:
                return (current_momentum >= self.momentum_threshold and
                       (self.last_momentum is None or self.last_momentum < self.momentum_threshold))

        elif self.condition == SentimentAlertCondition.MOMENTUM_NEGATIVE:
            # Check if momentum crossed below threshold
            if current_momentum is not None and self.momentum_threshold is not None:
                return (current_momentum <= self.momentum_threshold and
                       (self.last_momentum is None or self.last_momentum > self.momentum_threshold))

        return False

    def to_mongo(self) -> Dict:
        """Convert to MongoDB document format."""
        doc = self.dict(by_alias=True, exclude_none=True)
        if 'id' in doc and doc['id']:
            doc['_id'] = ObjectId(doc['id'])
        else:
            doc.pop('_id', None)
        return doc

    @classmethod
    def from_mongo(cls, doc: Dict) -> 'SentimentAlertModel':
        """Create model from MongoDB document."""
        if doc and '_id' in doc:
            doc['_id'] = str(doc['_id'])
        return cls(**doc) if doc else None


# Data Access Layer Functions

async def create_notification(notification: NotificationModel) -> str:
    """Create a new notification in MongoDB."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()
    doc = notification.to_mongo()

    # Set expiration if not specified (default 365 days)
    if 'expires_at' not in doc:
        doc['expires_at'] = datetime.utcnow() + timedelta(days=365)

    result = collection.insert_one(doc)
    return str(result.inserted_id)


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
    """Get notifications for a user with filters."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()

    # Build query
    query = {"user_id": user_id}
    if is_archived is not None:
        query["is_archived"] = is_archived
    if is_read is not None:
        query["is_read"] = is_read
    if category:
        query["category"] = category

    # Portfolio filtering
    if portfolio_id:
        if include_global:
            # Include notifications for specific portfolio OR global notifications
            query["$or"] = [
                {"portfolio_id": portfolio_id},
                {"is_global": True}
            ]
        else:
            # Only notifications for specific portfolio
            query["portfolio_id"] = portfolio_id
    elif not include_global:
        # Exclude global notifications if not specifically included
        query["is_global"] = False

    # Execute query with sorting and pagination
    cursor = collection.find(query).sort("created_at", -1).skip(offset).limit(limit)

    notifications = []
    for doc in cursor:
        notifications.append(NotificationModel.from_mongo(doc))

    return notifications


async def get_unread_count(user_id: str) -> int:
    """Get count of unread notifications for a user."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()
    count = collection.count_documents({
        "user_id": user_id,
        "is_read": False,
        "is_archived": False
    })
    return count


async def mark_as_read(notification_id: str, user_id: str) -> bool:
    """Mark a notification as read."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()
    result = collection.update_one(
        {"_id": ObjectId(notification_id), "user_id": user_id},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )
    return result.modified_count > 0


async def mark_all_as_read(user_id: str) -> int:
    """Mark all notifications as read for a user."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()
    result = collection.update_many(
        {"user_id": user_id, "is_archived": False},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )
    return result.modified_count


async def archive_notification(notification_id: str, user_id: str) -> bool:
    """Archive a notification."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()
    result = collection.update_one(
        {"_id": ObjectId(notification_id), "user_id": user_id},
        {"$set": {"is_archived": True, "archived_at": datetime.utcnow()}}
    )
    return result.modified_count > 0


async def delete_notification(notification_id: str, user_id: str) -> bool:
    """Delete a notification."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()
    result = collection.delete_one(
        {"_id": ObjectId(notification_id), "user_id": user_id}
    )
    return result.deleted_count > 0


async def get_or_create_preferences(user_id: str) -> NotificationPreferenceModel:
    """Get or create notification preferences for a user."""
    from app.database import get_notification_preferences_collection

    collection = get_notification_preferences_collection()
    doc = collection.find_one({"user_id": user_id})

    if doc:
        return NotificationPreferenceModel.from_mongo(doc)
    else:
        # Create default preferences
        prefs = NotificationPreferenceModel(user_id=user_id)
        doc = prefs.to_mongo()
        collection.insert_one(doc)
        return prefs


async def update_preferences(user_id: str, updates: Dict[str, Any]) -> NotificationPreferenceModel:
    """Update notification preferences for a user."""
    from app.database import get_notification_preferences_collection

    collection = get_notification_preferences_collection()

    # Ensure updated_at is set
    updates["updated_at"] = datetime.utcnow()

    collection.update_one(
        {"user_id": user_id},
        {"$set": updates},
        upsert=True
    )

    # Return updated preferences
    return await get_or_create_preferences(user_id)


async def create_price_alert(alert: PriceAlertModel) -> str:
    """Create a new price alert."""
    from app.database import get_price_alerts_collection

    collection = get_price_alerts_collection()
    doc = alert.to_mongo()
    result = collection.insert_one(doc)
    return str(result.inserted_id)


async def get_price_alerts(
    user_id: str,
    is_active: Optional[bool] = None,
    ticker: Optional[str] = None,
    portfolio_id: Optional[str] = None,
    include_global: bool = True
) -> List[PriceAlertModel]:
    """Get price alerts for a user."""
    from app.database import get_price_alerts_collection

    collection = get_price_alerts_collection()

    # Build query
    query = {"user_id": user_id}
    if is_active is not None:
        query["is_active"] = is_active
    if ticker:
        query["ticker"] = ticker.upper()

    # Portfolio filtering
    if portfolio_id:
        if include_global:
            # Include alerts for specific portfolio OR global alerts
            query["$or"] = [
                {"portfolio_id": portfolio_id},
                {"is_global": True}
            ]
        else:
            # Only alerts for specific portfolio
            query["portfolio_id"] = portfolio_id

    # Execute query
    cursor = collection.find(query).sort("created_at", -1)

    alerts = []
    for doc in cursor:
        alerts.append(PriceAlertModel.from_mongo(doc))

    return alerts


async def get_active_alerts_for_ticker(ticker: str) -> List[PriceAlertModel]:
    """Get all active alerts for a specific ticker (across all users)."""
    from app.database import get_price_alerts_collection

    collection = get_price_alerts_collection()

    cursor = collection.find({
        "ticker": ticker.upper(),
        "is_active": True,
        "triggered": False
    })

    alerts = []
    for doc in cursor:
        alerts.append(PriceAlertModel.from_mongo(doc))

    return alerts


async def trigger_price_alert(alert_id: str, triggered_price: float) -> bool:
    """Mark a price alert as triggered."""
    from app.database import get_price_alerts_collection

    collection = get_price_alerts_collection()
    result = collection.update_one(
        {"_id": ObjectId(alert_id)},
        {
            "$set": {
                "triggered": True,
                "triggered_at": datetime.utcnow(),
                "triggered_price": triggered_price,
                "is_active": False  # Deactivate after triggering
            }
        }
    )
    return result.modified_count > 0


async def delete_price_alert(alert_id: str, user_id: str) -> bool:
    """Delete a price alert."""
    from app.database import get_price_alerts_collection

    collection = get_price_alerts_collection()
    result = collection.delete_one(
        {"_id": ObjectId(alert_id), "user_id": user_id}
    )
    return result.deleted_count > 0


# Sentiment Alert Functions

async def create_sentiment_alert(alert: SentimentAlertModel) -> str:
    """Create a new sentiment alert."""
    from app.database import get_sentiment_alerts_collection

    collection = get_sentiment_alerts_collection()
    doc = alert.to_mongo()
    result = collection.insert_one(doc)
    return str(result.inserted_id)


async def get_sentiment_alerts(
    user_id: str,
    is_active: Optional[bool] = None,
    ticker: Optional[str] = None,
    portfolio_id: Optional[str] = None,
    include_global: bool = True
) -> List[SentimentAlertModel]:
    """Get sentiment alerts for a user."""
    from app.database import get_sentiment_alerts_collection

    collection = get_sentiment_alerts_collection()

    # Build query
    query = {"user_id": user_id}
    if is_active is not None:
        query["is_active"] = is_active
    if ticker:
        query["ticker"] = ticker.upper()

    # Portfolio filtering
    if portfolio_id:
        if include_global:
            query["$or"] = [
                {"portfolio_id": portfolio_id},
                {"is_global": True}
            ]
        else:
            query["portfolio_id"] = portfolio_id
    elif not include_global:
        query["is_global"] = False

    # Execute query
    cursor = collection.find(query).sort("created_at", -1)

    alerts = []
    for doc in cursor:
        alerts.append(SentimentAlertModel.from_mongo(doc))

    return alerts


async def get_active_sentiment_alerts_for_ticker(ticker: str) -> List[SentimentAlertModel]:
    """Get all active sentiment alerts for a specific ticker."""
    from app.database import get_sentiment_alerts_collection

    collection = get_sentiment_alerts_collection()
    cursor = collection.find({
        "ticker": ticker.upper(),
        "is_active": True,
        "triggered": False
    })

    alerts = []
    for doc in cursor:
        alerts.append(SentimentAlertModel.from_mongo(doc))

    return alerts


async def update_sentiment_alert_state(
    alert_id: str,
    current_sentiment: float,
    current_momentum: Optional[float] = None
) -> bool:
    """Update sentiment alert's last checked state."""
    from app.database import get_sentiment_alerts_collection

    collection = get_sentiment_alerts_collection()
    result = collection.update_one(
        {"_id": ObjectId(alert_id)},
        {"$set": {
            "last_sentiment_score": current_sentiment,
            "last_momentum": current_momentum,
            "last_checked_at": datetime.utcnow()
        }}
    )
    return result.modified_count > 0


async def trigger_sentiment_alert(alert_id: str, triggered_sentiment: float) -> bool:
    """Mark a sentiment alert as triggered."""
    from app.database import get_sentiment_alerts_collection

    collection = get_sentiment_alerts_collection()
    result = collection.update_one(
        {"_id": ObjectId(alert_id)},
        {"$set": {
            "triggered": True,
            "triggered_at": datetime.utcnow(),
            "triggered_sentiment": triggered_sentiment,
            "is_active": False
        }}
    )
    return result.modified_count > 0


async def delete_sentiment_alert(alert_id: str, user_id: str) -> bool:
    """Delete a sentiment alert."""
    from app.database import get_sentiment_alerts_collection

    collection = get_sentiment_alerts_collection()
    result = collection.delete_one(
        {"_id": ObjectId(alert_id), "user_id": user_id}
    )
    return result.deleted_count > 0


# Portfolio-specific notification functions

async def get_portfolio_notifications(
    user_id: str,
    portfolio_id: str,
    include_global: bool = True,
    limit: int = 50,
    offset: int = 0
) -> List[NotificationModel]:
    """Get notifications for a specific portfolio."""
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
    """Get count of unread notifications for a specific portfolio."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()

    query = {
        "user_id": user_id,
        "is_read": False,
        "is_archived": False
    }

    if include_global:
        query["$or"] = [
            {"portfolio_id": portfolio_id},
            {"is_global": True}
        ]
    else:
        query["portfolio_id"] = portfolio_id

    count = collection.count_documents(query)
    return count


async def get_multi_portfolio_notifications(
    user_id: str,
    portfolio_ids: List[str],
    include_global: bool = True,
    limit: int = 50,
    offset: int = 0
) -> List[NotificationModel]:
    """Get notifications for multiple portfolios."""
    from app.database import get_notifications_collection

    collection = get_notifications_collection()

    query = {
        "user_id": user_id,
        "is_archived": False
    }

    if include_global:
        query["$or"] = [
            {"portfolio_id": {"$in": portfolio_ids}},
            {"is_global": True}
        ]
    else:
        query["portfolio_id"] = {"$in": portfolio_ids}

    cursor = collection.find(query).sort("created_at", -1).skip(offset).limit(limit)

    notifications = []
    for doc in cursor:
        notifications.append(NotificationModel.from_mongo(doc))

    return notifications


async def get_portfolio_alerts_for_ticker(
    ticker: str,
    portfolio_id: str
) -> List[PriceAlertModel]:
    """Get all active alerts for a ticker in a specific portfolio."""
    from app.database import get_price_alerts_collection

    collection = get_price_alerts_collection()

    cursor = collection.find({
        "ticker": ticker.upper(),
        "portfolio_id": portfolio_id,
        "is_active": True,
        "triggered": False
    })

    alerts = []
    for doc in cursor:
        alerts.append(PriceAlertModel.from_mongo(doc))

    return alerts