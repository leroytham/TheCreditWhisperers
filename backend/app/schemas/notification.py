# app/schemas/notification.py
"""
Pydantic schemas for notification API request/response validation.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, validator
from app.models.notification import (
    NotificationType,
    NotificationCategory,
    NotificationPriority,
    AlertCondition
)
from app.core.alert_validators import validate_alert_condition


# Request Schemas

class NotificationCreateRequest(BaseModel):
    """Schema for creating a notification via API."""
    type: NotificationType = NotificationType.INFO
    category: NotificationCategory
    subcategory: Optional[str] = None
    priority: NotificationPriority = NotificationPriority.MEDIUM
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=1000)
    preview: Optional[str] = Field(None, max_length=100)

    # Rich content (optional)
    signal_analysis: Optional[Dict[str, Any]] = None
    portfolio_impact: Optional[Dict[str, Any]] = None
    account_servicing: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

    # UI hints
    show_as_toast: bool = True
    duration: Optional[int] = None
    action_url: Optional[str] = Field(None, max_length=500)
    modal_title: Optional[str] = Field(None, max_length=100)
    subject: Optional[str] = None
    body: Optional[str] = None

    @validator('metadata')
    def validate_metadata_size(cls, v):
        """Limit metadata size."""
        if v:
            import json
            if len(json.dumps(v, default=str)) > 10000:
                raise ValueError('Metadata too large (max 10KB)')
        return v


class NotificationUpdateRequest(BaseModel):
    """Schema for updating a notification."""
    is_read: Optional[bool] = None
    is_archived: Optional[bool] = None


class PreferenceUpdateRequest(BaseModel):
    """Schema for updating notification preferences."""
    enable_portfolio: Optional[bool] = None
    enable_market: Optional[bool] = None
    enable_news: Optional[bool] = None
    enable_system: Optional[bool] = None
    enable_toast: Optional[bool] = None
    enable_websocket: Optional[bool] = None
    enable_email: Optional[bool] = None
    enable_sms: Optional[bool] = None
    min_priority: Optional[NotificationPriority] = None
    quiet_hours_start: Optional[int] = Field(None, ge=0, le=23)
    quiet_hours_end: Optional[int] = Field(None, ge=0, le=23)
    subscribed_tickers: Optional[List[str]] = None
    watchlist_notifications: Optional[bool] = None
    portfolio_notifications: Optional[bool] = None


class PriceAlertCreateRequest(BaseModel):
    """Schema for creating a price alert."""
    ticker: str = Field(..., min_length=1, max_length=10)
    condition: AlertCondition
    target_price: Optional[float] = Field(None, gt=0)
    base_price: Optional[float] = Field(None, gt=0)
    percent_change: Optional[float] = None
    notification_title: Optional[str] = None
    notification_message: Optional[str] = None
    priority: NotificationPriority = NotificationPriority.HIGH
    notes: Optional[str] = Field(None, max_length=500)

    @validator('ticker')
    def uppercase_ticker(cls, v):
        """Ensure ticker is uppercase."""
        return v.upper()

    @validator('condition')
    def validate_condition_fields(cls, v, values):
        """Validate required fields for condition type."""
        return validate_alert_condition(v, values)


class PriceAlertUpdateRequest(BaseModel):
    """Schema for updating a price alert."""
    is_active: Optional[bool] = None
    target_price: Optional[float] = Field(None, gt=0)
    percent_change: Optional[float] = None
    notification_title: Optional[str] = None
    notification_message: Optional[str] = None
    priority: Optional[NotificationPriority] = None
    notes: Optional[str] = Field(None, max_length=500)


# Response Schemas

class NotificationResponse(BaseModel):
    """Schema for notification response."""
    id: str
    user_id: str
    type: NotificationType
    category: NotificationCategory
    subcategory: Optional[str]
    priority: NotificationPriority
    title: str
    message: str
    preview: Optional[str]

    # Rich content
    signal_analysis: Optional[Dict[str, Any]]
    portfolio_impact: Optional[Dict[str, Any]]
    account_servicing: Optional[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]]

    # State
    is_read: bool
    is_archived: bool
    read_at: Optional[datetime]
    archived_at: Optional[datetime]

    # UI hints
    show_as_toast: bool
    duration: Optional[int]
    action_url: Optional[str]
    modal_title: Optional[str]
    subject: Optional[str]
    body: Optional[str]

    # Timestamps
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list response."""
    notifications: List[NotificationResponse]
    total_count: int
    offset: int
    limit: int
    has_more: bool


class UnreadCountResponse(BaseModel):
    """Schema for unread notification count response."""
    count: int


class PreferenceResponse(BaseModel):
    """Schema for notification preferences response."""
    user_id: str
    enable_portfolio: bool
    enable_market: bool
    enable_news: bool
    enable_system: bool
    enable_toast: bool
    enable_websocket: bool
    enable_email: bool
    enable_sms: bool
    min_priority: NotificationPriority
    quiet_hours_start: Optional[int]
    quiet_hours_end: Optional[int]
    subscribed_tickers: List[str]
    watchlist_notifications: bool
    portfolio_notifications: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PriceAlertResponse(BaseModel):
    """Schema for price alert response."""
    id: str
    user_id: str
    ticker: str
    condition: AlertCondition
    target_price: Optional[float]
    base_price: Optional[float]
    percent_change: Optional[float]
    is_active: bool
    triggered: bool
    triggered_at: Optional[datetime]
    triggered_price: Optional[float]
    notification_title: Optional[str]
    notification_message: Optional[str]
    priority: NotificationPriority
    notes: Optional[str]
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PriceAlertListResponse(BaseModel):
    """Schema for price alert list response."""
    alerts: List[PriceAlertResponse]
    total_count: int


class BulkOperationResponse(BaseModel):
    """Schema for bulk operation response."""
    success: bool
    affected_count: int
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    """Schema for error response."""
    error: str
    detail: Optional[str] = None
    status_code: int


# WebSocket message schemas

class WebSocketNotificationMessage(BaseModel):
    """Schema for WebSocket notification message."""
    type: str = "notification"
    notification: NotificationResponse
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class WebSocketTickerUpdate(BaseModel):
    """Schema for WebSocket ticker update message."""
    type: str = "ticker_update"
    ticker: str
    price: float
    change: float
    change_percent: float
    volume: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class WebSocketSubscriptionMessage(BaseModel):
    """Schema for WebSocket subscription confirmation."""
    type: str  # "subscribed" or "unsubscribed"
    ticker: Optional[str] = None
    channel: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }