# app/api/notification_routes.py
"""
REST API endpoints for notification management.
"""

from fastapi import APIRouter, HTTPException, Query, Header, Depends
from typing import List, Optional
from datetime import datetime
import logging
from bson import ObjectId

from app.models.notification import (
    NotificationModel,
    NotificationPreferenceModel,
    PriceAlertModel,
    create_notification,
    get_notifications,
    get_unread_count,
    mark_as_read,
    mark_all_as_read,
    archive_notification,
    delete_notification,
    get_or_create_preferences,
    update_preferences,
    create_price_alert,
    get_price_alerts,
    delete_price_alert,
    get_active_alerts_for_ticker,
    trigger_price_alert,
    # Portfolio-specific functions
    get_portfolio_notifications,
    get_portfolio_unread_count,
    get_multi_portfolio_notifications,
    get_portfolio_alerts_for_ticker
)

from app.schemas.notification import (
    NotificationCreateRequest,
    NotificationUpdateRequest,
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    PreferenceUpdateRequest,
    PreferenceResponse,
    PriceAlertCreateRequest,
    PriceAlertUpdateRequest,
    PriceAlertResponse,
    PriceAlertListResponse,
    BulkOperationResponse,
    ErrorResponse
)

from app.database import get_notifications_collection, get_price_alerts_collection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# Authentication dependency (placeholder - replace with real auth)
async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """
    Extract user ID from authorization header.
    TODO: Replace with proper JWT validation.
    """
    if not authorization:
        # For development, use a default user ID
        return "default_user_id"

    # Parse Bearer token
    if authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        # TODO: Validate JWT token and extract user ID
        # For now, just return the token as user ID (NOT SECURE!)
        return token

    return "default_user_id"


# Notification Endpoints

@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    user_id: str = Depends(get_current_user),
    is_archived: Optional[bool] = Query(None, description="Filter by archived status"),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    portfolio_id: Optional[str] = Query(None, description="Filter by portfolio ID"),
    include_global: bool = Query(True, description="Include global notifications"),
    limit: int = Query(50, le=200, description="Maximum number of notifications to return"),
    offset: int = Query(0, ge=0, description="Number of notifications to skip")
):
    """
    Get notifications for the current user with optional filtering.
    Supports portfolio-aware filtering.
    """
    try:
        notifications = await get_notifications(
            user_id=user_id,
            is_archived=is_archived,
            is_read=is_read,
            category=category,
            portfolio_id=portfolio_id,
            include_global=include_global,
            limit=limit,
            offset=offset
        )

        # Get total count for pagination
        collection = get_notifications_collection()
        query = {"user_id": user_id}
        if is_archived is not None:
            query["is_archived"] = is_archived
        if is_read is not None:
            query["is_read"] = is_read
        if category:
            query["category"] = category

        # Portfolio filtering for count
        if portfolio_id:
            if include_global:
                query["$or"] = [
                    {"portfolio_id": portfolio_id},
                    {"is_global": True}
                ]
            else:
                query["portfolio_id"] = portfolio_id

        total_count = collection.count_documents(query)

        # Convert to response models
        notification_responses = [
            NotificationResponse(**notification.dict())
            for notification in notifications
        ]

        return NotificationListResponse(
            notifications=notification_responses,
            total_count=total_count,
            offset=offset,
            limit=limit,
            has_more=(offset + limit) < total_count
        )

    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=NotificationResponse)
async def create_notification_endpoint(
    notification_data: NotificationCreateRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Create a new notification for the current user.
    """
    try:
        # Create notification model
        notification = NotificationModel(
            user_id=user_id,
            **notification_data.dict()
        )

        # Save to database
        notification_id = await create_notification(notification)
        notification.id = notification_id

        # Broadcast via WebSocket (if enabled)
        try:
            from app.services.notification_service import NotificationService
            service = NotificationService()
            await service.send_notification(
                client_id=f"user-{user_id}",
                notification=notification.dict()
            )
        except Exception as ws_error:
            logger.warning(f"Failed to send WebSocket notification: {ws_error}")

        return NotificationResponse(**notification.dict())

    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count_endpoint(user_id: str = Depends(get_current_user)):
    """
    Get the count of unread notifications for the current user.
    """
    try:
        count = await get_unread_count(user_id)
        return UnreadCountResponse(count=count)

    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{notification_id}/read", response_model=BulkOperationResponse)
async def mark_notification_as_read(
    notification_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Mark a specific notification as read.
    """
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID format")

        success = await mark_as_read(notification_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")

        return BulkOperationResponse(
            success=True,
            affected_count=1,
            message="Notification marked as read"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-all-read", response_model=BulkOperationResponse)
async def mark_all_notifications_as_read(user_id: str = Depends(get_current_user)):
    """
    Mark all active notifications as read for the current user.
    """
    try:
        count = await mark_all_as_read(user_id)

        return BulkOperationResponse(
            success=True,
            affected_count=count,
            message=f"Marked {count} notifications as read"
        )

    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{notification_id}/archive", response_model=BulkOperationResponse)
async def archive_notification_endpoint(
    notification_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Archive a specific notification.
    """
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID format")

        success = await archive_notification(notification_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")

        return BulkOperationResponse(
            success=True,
            affected_count=1,
            message="Notification archived"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{notification_id}", response_model=BulkOperationResponse)
async def delete_notification_endpoint(
    notification_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Delete a specific notification.
    """
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID format")

        success = await delete_notification(notification_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")

        return BulkOperationResponse(
            success=True,
            affected_count=1,
            message="Notification deleted"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear", response_model=BulkOperationResponse)
async def clear_notifications(
    is_archived: Optional[bool] = Query(None, description="Clear only archived/active notifications"),
    user_id: str = Depends(get_current_user)
):
    """
    Clear notifications for the current user.
    """
    try:
        collection = get_notifications_collection()

        query = {"user_id": user_id}
        if is_archived is not None:
            query["is_archived"] = is_archived

        result = collection.delete_many(query)

        return BulkOperationResponse(
            success=True,
            affected_count=result.deleted_count,
            message=f"Cleared {result.deleted_count} notifications"
        )

    except Exception as e:
        logger.error(f"Error clearing notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Portfolio-Specific Notification Endpoints

@router.get("/portfolio/{portfolio_id}", response_model=NotificationListResponse)
async def get_portfolio_notifications_endpoint(
    portfolio_id: str,
    include_global: bool = Query(True, description="Include global notifications"),
    limit: int = Query(50, le=200, description="Maximum number to return"),
    offset: int = Query(0, ge=0, description="Number to skip"),
    user_id: str = Depends(get_current_user)
):
    """
    Get notifications for a specific portfolio.
    """
    try:
        notifications = await get_portfolio_notifications(
            user_id=user_id,
            portfolio_id=portfolio_id,
            include_global=include_global,
            limit=limit,
            offset=offset
        )

        # Get total count
        count = await get_portfolio_unread_count(
            user_id=user_id,
            portfolio_id=portfolio_id,
            include_global=include_global
        )

        notification_responses = [
            NotificationResponse(**notification.dict())
            for notification in notifications
        ]

        return NotificationListResponse(
            notifications=notification_responses,
            total_count=len(notification_responses),
            offset=offset,
            limit=limit,
            has_more=(offset + limit) < count
        )

    except Exception as e:
        logger.error(f"Error fetching portfolio notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portfolio/{portfolio_id}/unread-count", response_model=UnreadCountResponse)
async def get_portfolio_unread_count_endpoint(
    portfolio_id: str,
    include_global: bool = Query(True, description="Include global notifications"),
    user_id: str = Depends(get_current_user)
):
    """
    Get unread notification count for a specific portfolio.
    """
    try:
        count = await get_portfolio_unread_count(
            user_id=user_id,
            portfolio_id=portfolio_id,
            include_global=include_global
        )
        return UnreadCountResponse(count=count)

    except Exception as e:
        logger.error(f"Error getting portfolio unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/multi-portfolio", response_model=NotificationListResponse)
async def get_multi_portfolio_notifications_endpoint(
    portfolio_ids: List[str],
    include_global: bool = Query(True, description="Include global notifications"),
    limit: int = Query(50, le=200, description="Maximum number to return"),
    offset: int = Query(0, ge=0, description="Number to skip"),
    user_id: str = Depends(get_current_user)
):
    """
    Get notifications for multiple portfolios.
    """
    try:
        notifications = await get_multi_portfolio_notifications(
            user_id=user_id,
            portfolio_ids=portfolio_ids,
            include_global=include_global,
            limit=limit,
            offset=offset
        )

        notification_responses = [
            NotificationResponse(**notification.dict())
            for notification in notifications
        ]

        return NotificationListResponse(
            notifications=notification_responses,
            total_count=len(notification_responses),
            offset=offset,
            limit=limit,
            has_more=len(notification_responses) == limit
        )

    except Exception as e:
        logger.error(f"Error fetching multi-portfolio notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Preference Endpoints

@router.get("/preferences", response_model=PreferenceResponse)
async def get_preferences_endpoint(user_id: str = Depends(get_current_user)):
    """
    Get notification preferences for the current user.
    Creates default preferences if none exist.
    """
    try:
        prefs = await get_or_create_preferences(user_id)
        return PreferenceResponse(**prefs.dict())

    except Exception as e:
        logger.error(f"Error getting preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/preferences", response_model=PreferenceResponse)
async def update_preferences_endpoint(
    preference_data: PreferenceUpdateRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Update notification preferences for the current user.
    """
    try:
        # Filter out None values
        updates = {k: v for k, v in preference_data.dict().items() if v is not None}

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        prefs = await update_preferences(user_id, updates)
        return PreferenceResponse(**prefs.dict())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Price Alert Endpoints

@router.get("/alerts", response_model=PriceAlertListResponse)
async def list_price_alerts(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    ticker: Optional[str] = Query(None, description="Filter by ticker symbol"),
    portfolio_id: Optional[str] = Query(None, description="Filter by portfolio ID"),
    include_global: bool = Query(True, description="Include global alerts"),
    user_id: str = Depends(get_current_user)
):
    """
    Get price alerts for the current user.
    Supports portfolio-aware filtering.
    """
    try:
        alerts = await get_price_alerts(
            user_id=user_id,
            is_active=is_active,
            ticker=ticker,
            portfolio_id=portfolio_id,
            include_global=include_global
        )

        # Convert to response models
        alert_responses = [
            PriceAlertResponse(**alert.dict())
            for alert in alerts
        ]

        return PriceAlertListResponse(
            alerts=alert_responses,
            total_count=len(alert_responses)
        )

    except Exception as e:
        logger.error(f"Error fetching price alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts", response_model=PriceAlertResponse)
async def create_price_alert_endpoint(
    alert_data: PriceAlertCreateRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Create a new price alert.
    """
    try:
        # Create alert model
        alert = PriceAlertModel(
            user_id=user_id,
            **alert_data.dict()
        )

        # Save to database
        alert_id = await create_price_alert(alert)
        alert.id = alert_id

        return PriceAlertResponse(**alert.dict())

    except Exception as e:
        logger.error(f"Error creating price alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/alerts/{alert_id}", response_model=PriceAlertResponse)
async def update_price_alert_endpoint(
    alert_id: str,
    alert_data: PriceAlertUpdateRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Update a price alert.
    """
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(alert_id):
            raise HTTPException(status_code=400, detail="Invalid alert ID format")

        collection = get_price_alerts_collection()

        # Filter out None values
        updates = {k: v for k, v in alert_data.dict().items() if v is not None}

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        # Update the alert
        result = collection.find_one_and_update(
            {"_id": ObjectId(alert_id), "user_id": user_id},
            {"$set": updates},
            return_document=True
        )

        if not result:
            raise HTTPException(status_code=404, detail="Price alert not found")

        alert = PriceAlertModel.from_mongo(result)
        return PriceAlertResponse(**alert.dict())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating price alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/alerts/{alert_id}", response_model=BulkOperationResponse)
async def delete_price_alert_endpoint(
    alert_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Delete a price alert.
    """
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(alert_id):
            raise HTTPException(status_code=400, detail="Invalid alert ID format")

        success = await delete_price_alert(alert_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Price alert not found")

        return BulkOperationResponse(
            success=True,
            affected_count=1,
            message="Price alert deleted"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting price alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/ticker/{ticker}", response_model=PriceAlertListResponse)
async def get_alerts_for_ticker(
    ticker: str,
    user_id: str = Depends(get_current_user)
):
    """
    Get all active alerts for a specific ticker (admin endpoint).
    TODO: Add proper admin authentication.
    """
    try:
        alerts = await get_active_alerts_for_ticker(ticker)

        # Filter to only user's alerts (for now)
        user_alerts = [a for a in alerts if a.user_id == user_id]

        alert_responses = [
            PriceAlertResponse(**alert.dict())
            for alert in user_alerts
        ]

        return PriceAlertListResponse(
            alerts=alert_responses,
            total_count=len(alert_responses)
        )

    except Exception as e:
        logger.error(f"Error fetching alerts for ticker: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Test Endpoints (for development)

@router.post("/test/create-sample", response_model=NotificationResponse)
async def create_sample_notification(
    user_id: str = Depends(get_current_user)
):
    """
    Create a sample notification for testing.
    """
    try:
        sample_notification = NotificationModel(
            user_id=user_id,
            type="info",
            category="System",
            priority="medium",
            title="Test Notification",
            message="This is a test notification created via the API.",
            preview="Test notification",
            metadata={"test": True, "timestamp": datetime.utcnow().isoformat()}
        )

        notification_id = await create_notification(sample_notification)
        sample_notification.id = notification_id

        return NotificationResponse(**sample_notification.dict())

    except Exception as e:
        logger.error(f"Error creating sample notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))