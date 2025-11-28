# app/api/notification_routes.py
"""
REST API endpoints for notification management.

Uses Repository Pattern for data access via dependency injection.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime
import logging
from bson import ObjectId

# Models (Pydantic only - no DAL functions)
from app.models.notification import (
    NotificationModel,
    NotificationPreferenceModel,
    PriceAlertModel,
)

# Schemas for request/response
from app.schemas.notification import (
    NotificationCreateRequest,
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
)

# Repository factory functions for dependency injection
from app.repositories.factory import (
    get_notification_repository,
    get_preference_repository,
    get_price_alert_repository,
)
from app.repositories.notification_repository import NotificationRepository
from app.repositories.preference_repository import PreferenceRepository
from app.repositories.price_alert_repository import PriceAlertRepository

# Auth dependencies
from app.core.auth import get_current_user, get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


# =============================================================================
# NOTIFICATION ENDPOINTS
# =============================================================================

@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    user_id: str = Depends(get_current_user),
    is_archived: Optional[bool] = Query(None, description="Filter by archived status"),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    portfolio_id: Optional[str] = Query(None, description="Filter by portfolio ID"),
    include_global: bool = Query(True, description="Include global notifications"),
    limit: int = Query(50, le=200, description="Maximum number of notifications to return"),
    offset: int = Query(0, ge=0, description="Number of notifications to skip"),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Get notifications for the current user with optional filtering.
    Supports portfolio-aware filtering.
    """
    try:
        notifications = await repo.get_user_notifications(
            user_id=user_id,
            is_archived=is_archived,
            is_read=is_read,
            category=category,
            portfolio_id=portfolio_id,
            include_global=include_global,
            limit=limit,
            offset=offset,
        )

        # Get total count for pagination
        total_count = await repo.get_total_count(
            user_id=user_id,
            is_archived=is_archived,
            is_read=is_read,
            category=category,
            portfolio_id=portfolio_id,
            include_global=include_global,
        )

        # Convert to response models
        notification_responses = [
            NotificationResponse(**n.dict() if hasattr(n, 'dict') else n)
            for n in notifications
        ]

        return NotificationListResponse(
            notifications=notification_responses,
            total_count=total_count,
            offset=offset,
            limit=limit,
            has_more=(offset + limit) < total_count,
        )

    except Exception as e:
        logger.error("Error fetching notifications: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=NotificationResponse)
async def create_notification_endpoint(
    notification_data: NotificationCreateRequest,
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
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

        # Save to database via repository
        notification_id = await repo.create_notification(notification)
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
            logger.warning("Failed to send WebSocket notification: %s", ws_error)

        return NotificationResponse(**notification.dict())

    except Exception as e:
        logger.error("Error creating notification: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count_endpoint(
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Get the count of unread notifications for the current user.
    """
    try:
        count = await repo.get_unread_count(user_id)
        return UnreadCountResponse(count=count)

    except Exception as e:
        logger.error("Error getting unread count: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{notification_id}/read", response_model=BulkOperationResponse)
async def mark_notification_as_read(
    notification_id: str,
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Mark a specific notification as read.
    """
    try:
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID format")

        success = await repo.mark_single_as_read(notification_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")

        return BulkOperationResponse(
            success=True,
            affected_count=1,
            message="Notification marked as read",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error marking notification as read: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-all-read", response_model=BulkOperationResponse)
async def mark_all_notifications_as_read(
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Mark all active notifications as read for the current user.
    """
    try:
        count = await repo.mark_all_as_read(user_id)

        return BulkOperationResponse(
            success=True,
            affected_count=count,
            message=f"Marked {count} notifications as read",
        )

    except Exception as e:
        logger.error("Error marking all notifications as read: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{notification_id}/archive", response_model=BulkOperationResponse)
async def archive_notification_endpoint(
    notification_id: str,
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Archive a specific notification.
    """
    try:
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID format")

        success = await repo.archive_notification(notification_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")

        return BulkOperationResponse(
            success=True,
            affected_count=1,
            message="Notification archived",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error archiving notification: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{notification_id}", response_model=BulkOperationResponse)
async def delete_notification_endpoint(
    notification_id: str,
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Delete a specific notification.
    """
    try:
        if not ObjectId.is_valid(notification_id):
            raise HTTPException(status_code=400, detail="Invalid notification ID format")

        success = await repo.delete_notification(notification_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Notification not found")

        return BulkOperationResponse(
            success=True,
            affected_count=1,
            message="Notification deleted",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting notification: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear", response_model=BulkOperationResponse)
async def clear_notifications(
    is_archived: Optional[bool] = Query(None, description="Clear only archived/active notifications"),
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Clear notifications for the current user.
    """
    try:
        count = await repo.clear_notifications(user_id, is_archived)

        return BulkOperationResponse(
            success=True,
            affected_count=count,
            message=f"Cleared {count} notifications",
        )

    except Exception as e:
        logger.error("Error clearing notifications: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PORTFOLIO-SPECIFIC NOTIFICATION ENDPOINTS
# =============================================================================

@router.get("/portfolio/{portfolio_id}", response_model=NotificationListResponse)
async def get_portfolio_notifications_endpoint(
    portfolio_id: str,
    include_global: bool = Query(True, description="Include global notifications"),
    limit: int = Query(50, le=200, description="Maximum number to return"),
    offset: int = Query(0, ge=0, description="Number to skip"),
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Get notifications for a specific portfolio.
    """
    try:
        notifications = await repo.get_user_notifications(
            user_id=user_id,
            portfolio_id=portfolio_id,
            include_global=include_global,
            limit=limit,
            offset=offset,
        )

        # Get unread count for this portfolio
        count = await repo.get_unread_count(
            user_id=user_id,
            portfolio_id=portfolio_id,
            include_global=include_global,
        )

        notification_responses = [
            NotificationResponse(**n.dict() if hasattr(n, 'dict') else n)
            for n in notifications
        ]

        return NotificationListResponse(
            notifications=notification_responses,
            total_count=len(notification_responses),
            offset=offset,
            limit=limit,
            has_more=(offset + limit) < count,
        )

    except Exception as e:
        logger.error("Error fetching portfolio notifications: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portfolio/{portfolio_id}/unread-count", response_model=UnreadCountResponse)
async def get_portfolio_unread_count_endpoint(
    portfolio_id: str,
    include_global: bool = Query(True, description="Include global notifications"),
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Get unread notification count for a specific portfolio.
    """
    try:
        count = await repo.get_unread_count(
            user_id=user_id,
            portfolio_id=portfolio_id,
            include_global=include_global,
        )
        return UnreadCountResponse(count=count)

    except Exception as e:
        logger.error("Error getting portfolio unread count: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/multi-portfolio", response_model=NotificationListResponse)
async def get_multi_portfolio_notifications_endpoint(
    portfolio_ids: List[str],
    include_global: bool = Query(True, description="Include global notifications"),
    limit: int = Query(50, le=200, description="Maximum number to return"),
    offset: int = Query(0, ge=0, description="Number to skip"),
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Get notifications for multiple portfolios.
    """
    try:
        notifications = await repo.get_multi_portfolio_notifications(
            user_id=user_id,
            portfolio_ids=portfolio_ids,
            include_global=include_global,
            limit=limit,
            offset=offset,
        )

        notification_responses = [
            NotificationResponse(**n.dict() if hasattr(n, 'dict') else n)
            for n in notifications
        ]

        return NotificationListResponse(
            notifications=notification_responses,
            total_count=len(notification_responses),
            offset=offset,
            limit=limit,
            has_more=len(notification_responses) == limit,
        )

    except Exception as e:
        logger.error("Error fetching multi-portfolio notifications: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PREFERENCE ENDPOINTS
# =============================================================================

@router.get("/preferences", response_model=PreferenceResponse)
async def get_preferences_endpoint(
    user_id: str = Depends(get_current_user),
    repo: PreferenceRepository = Depends(get_preference_repository),
):
    """
    Get notification preferences for the current user.
    Creates default preferences if none exist.
    """
    try:
        prefs = await repo.get_or_create(user_id)
        return PreferenceResponse(**prefs.dict() if hasattr(prefs, 'dict') else prefs)

    except Exception as e:
        logger.error("Error getting preferences: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/preferences", response_model=PreferenceResponse)
async def update_preferences_endpoint(
    preference_data: PreferenceUpdateRequest,
    user_id: str = Depends(get_current_user),
    repo: PreferenceRepository = Depends(get_preference_repository),
):
    """
    Update notification preferences for the current user.
    """
    try:
        # Filter out None values
        updates = {k: v for k, v in preference_data.dict().items() if v is not None}

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        prefs = await repo.update_preferences(user_id, updates)
        return PreferenceResponse(**prefs.dict() if hasattr(prefs, 'dict') else prefs)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating preferences: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PRICE ALERT ENDPOINTS
# =============================================================================

@router.get("/alerts", response_model=PriceAlertListResponse)
async def list_price_alerts(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    ticker: Optional[str] = Query(None, description="Filter by ticker symbol"),
    portfolio_id: Optional[str] = Query(None, description="Filter by portfolio ID"),
    include_global: bool = Query(True, description="Include global alerts"),
    user_id: str = Depends(get_current_user),
    repo: PriceAlertRepository = Depends(get_price_alert_repository),
):
    """
    Get price alerts for the current user.
    Supports portfolio-aware filtering.
    """
    try:
        alerts = await repo.get_user_alerts(
            user_id=user_id,
            is_active=is_active,
            ticker=ticker,
            portfolio_id=portfolio_id,
            include_global=include_global,
        )

        alert_responses = [
            PriceAlertResponse(**a.dict() if hasattr(a, 'dict') else a)
            for a in alerts
        ]

        return PriceAlertListResponse(
            alerts=alert_responses,
            total_count=len(alert_responses),
        )

    except Exception as e:
        logger.error("Error fetching price alerts: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts", response_model=PriceAlertResponse)
async def create_price_alert_endpoint(
    alert_data: PriceAlertCreateRequest,
    user_id: str = Depends(get_current_user),
    repo: PriceAlertRepository = Depends(get_price_alert_repository),
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

        # Save to database via repository
        alert_id = await repo.create_alert(alert)
        alert.id = alert_id

        return PriceAlertResponse(**alert.dict())

    except Exception as e:
        logger.error("Error creating price alert: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/alerts/{alert_id}", response_model=PriceAlertResponse)
async def update_price_alert_endpoint(
    alert_id: str,
    alert_data: PriceAlertUpdateRequest,
    user_id: str = Depends(get_current_user),
    repo: PriceAlertRepository = Depends(get_price_alert_repository),
):
    """
    Update a price alert.
    """
    try:
        if not ObjectId.is_valid(alert_id):
            raise HTTPException(status_code=400, detail="Invalid alert ID format")

        # Filter out None values
        updates = {k: v for k, v in alert_data.dict().items() if v is not None}

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        alert = await repo.update_alert(alert_id, user_id, updates)

        if not alert:
            raise HTTPException(status_code=404, detail="Price alert not found")

        return PriceAlertResponse(**alert.dict() if hasattr(alert, 'dict') else alert)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating price alert: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/alerts/{alert_id}", response_model=BulkOperationResponse)
async def delete_price_alert_endpoint(
    alert_id: str,
    user_id: str = Depends(get_current_user),
    repo: PriceAlertRepository = Depends(get_price_alert_repository),
):
    """
    Delete a price alert.
    """
    try:
        if not ObjectId.is_valid(alert_id):
            raise HTTPException(status_code=400, detail="Invalid alert ID format")

        success = await repo.delete_alert(alert_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Price alert not found")

        return BulkOperationResponse(
            success=True,
            affected_count=1,
            message="Price alert deleted",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting price alert: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/ticker/{ticker}", response_model=PriceAlertListResponse)
async def get_alerts_for_ticker(
    ticker: str,
    admin_id: str = Depends(get_current_admin),
    repo: PriceAlertRepository = Depends(get_price_alert_repository),
):
    """
    Get all active alerts for a specific ticker (admin only).

    This endpoint returns alerts from ALL users for the specified ticker.
    Requires admin privileges.
    """
    try:
        alerts = await repo.get_alerts_for_ticker(ticker)

        alert_responses = [
            PriceAlertResponse(**a.dict() if hasattr(a, 'dict') else a)
            for a in alerts
        ]

        return PriceAlertListResponse(
            alerts=alert_responses,
            total_count=len(alert_responses),
        )

    except Exception as e:
        logger.error("Error fetching alerts for ticker: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TEST ENDPOINTS (for development)
# =============================================================================

@router.post("/test/create-sample", response_model=NotificationResponse)
async def create_sample_notification(
    user_id: str = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repository),
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
            metadata={"test": True, "timestamp": datetime.utcnow().isoformat()},
        )

        notification_id = await repo.create_notification(sample_notification)
        sample_notification.id = notification_id

        return NotificationResponse(**sample_notification.dict())

    except Exception as e:
        logger.error("Error creating sample notification: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
