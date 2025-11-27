# Notification Service

Microservice for real-time notifications, price alerts, and WebSocket connections.

## Overview

The Notification Service handles all notification-related functionality including storing notifications in MongoDB, delivering real-time updates via WebSocket, and managing price alert triggers.

## Port

**8001**

## API Endpoints

### Health Checks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/live` | GET | Kubernetes liveness probe |
| `/health/ready` | GET | Kubernetes readiness probe |

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications/` | GET | List notifications for user |
| `/api/notifications/` | POST | Create new notification |
| `/api/notifications/unread-count` | GET | Get unread count |
| `/api/notifications/{id}/read` | PATCH | Mark notification as read |
| `/api/notifications/mark-all-read` | POST | Mark all as read |

### Internal

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/internal/price-alert` | POST | Receive price alert triggers |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws/notifications/{client_id}` | Real-time notification stream |

## Query Parameters

### `/api/notifications/`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `user_id` | string | Required | User identifier |
| `limit` | int | `50` | Max notifications |
| `offset` | int | `0` | Pagination offset |

## WebSocket Protocol

### Client Messages

```json
// Subscribe to ticker updates
{"type": "subscribe", "ticker": "AAPL"}

// Unsubscribe
{"type": "unsubscribe", "ticker": "AAPL"}

// Keepalive
{"type": "ping"}
```

### Server Messages

```json
// Notification
{
  "type": "notification",
  "data": {
    "title": "Price Alert",
    "message": "AAPL reached $150",
    "priority": "high"
  },
  "timestamp": "2025-01-01T12:00:00Z"
}

// Subscription confirmation
{
  "type": "subscribed",
  "ticker": "AAPL",
  "message": "Subscribed to AAPL updates"
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Service host | `0.0.0.0` |
| `PORT` | Service port | `8001` |
| `SERVICE_NAME` | Service identifier | `notification-service` |
| `MONGO_URI` | MongoDB connection string | Required |
| `MONGODB_DB_NAME` | Database name | `creditwhisperers` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `PUBSUB_ENABLED` | Enable Redis Pub/Sub | `true` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `API_BASE_URL` | Backend API URL | `http://localhost:8000` |

## Notification Model

```json
{
  "user_id": "string",
  "type": "price_alert|news|system",
  "title": "string",
  "message": "string",
  "priority": "low|medium|high|critical",
  "category": "Portfolio|Market|News|System",
  "is_read": false,
  "is_archived": false,
  "action_url": "string|null",
  "metadata": {},
  "created_at": "datetime",
  "expires_at": "datetime"
}
```

## Running

```bash
cd services/notification-service

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Example Requests

```bash
# List notifications
curl "http://localhost:8001/api/notifications/?user_id=user123"

# Get unread count
curl "http://localhost:8001/api/notifications/unread-count?user_id=user123"

# Create notification
curl -X POST "http://localhost:8001/api/notifications/" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "type": "price_alert",
    "title": "Price Alert",
    "message": "AAPL reached $150",
    "priority": "high",
    "category": "Market"
  }'

# Mark as read
curl -X PATCH "http://localhost:8001/api/notifications/abc123/read?user_id=user123"
```

## WebSocket Example

```javascript
const ws = new WebSocket('ws://localhost:8001/ws/notifications/user123');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe', ticker: 'AAPL' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Notification:', data);
};
```

## Related Documentation

- [Services Overview](../README.md)
- [Frontend Notifications](../../frontend/src/features/notifications/README.md)
