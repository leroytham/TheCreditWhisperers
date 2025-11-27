# =============================================================================
# Notification Models for MongoDB with Pydantic validation
# =============================================================================
# Adapted for standalone notification microservice

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, validator
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


class NotificationModel(BaseModel):
    """MongoDB notification document model."""
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="User ID who receives the notification")

    # Portfolio context
    portfolio_id: Optional[str] = Field(None, description="Portfolio ID this notification relates to")
    portfolio_name: Optional[str] = Field(None, description="Portfolio name for display")
    is_global: bool = Field(False, description="True if notification applies to all portfolios")
    affected_tickers: List[str] = Field(default_factory=list, description="Tickers affected")
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

    # Rich content
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
            if len(json.dumps(v, default=str)) > 10000:
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
    """User notification preferences stored in MongoDB."""
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
    enable_email: bool = False
    enable_sms: bool = False

    # Priority thresholds
    min_priority: NotificationPriority = NotificationPriority.LOW

    # Quiet hours
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None

    # Subscription settings
    subscribed_tickers: List[str] = Field(default_factory=list)
    watchlist_notifications: bool = True
    portfolio_notifications: bool = True

    # Portfolio-specific preferences
    enabled_portfolios: List[str] = Field(default_factory=list)
    portfolio_preferences: Dict[str, Dict[str, Any]] = Field(default_factory=dict)

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
        doc['updated_at'] = datetime.utcnow()
        return doc

    @classmethod
    def from_mongo(cls, doc: Dict) -> 'NotificationPreferenceModel':
        """Create model from MongoDB document."""
        if doc and '_id' in doc:
            doc['_id'] = str(doc['_id'])
        return cls(**doc) if doc else None


class PriceAlertModel(BaseModel):
    """Price alert configuration stored in MongoDB."""
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="User ID who created the alert")
    ticker: str = Field(..., description="Stock ticker symbol")

    # Portfolio context
    portfolio_id: Optional[str] = Field(None, description="Portfolio ID this alert belongs to")
    portfolio_name: Optional[str] = Field(None, description="Portfolio name for display")
    is_global: bool = Field(False, description="True if alert applies across all portfolios")

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
        return cls(**doc) if doc else None
