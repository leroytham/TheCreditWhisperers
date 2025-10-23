# Notification System Documentation

## Overview

This comprehensive notification system provides real-time toast notifications, persistent notification history, price alerts, news updates, and WebSocket-based real-time communication.

## Features

### ✅ Implemented Features

1. **Toast Notifications** - Temporary pop-ups for user actions and events
2. **Real-time Notifications** - WebSocket-based push notifications
3. **API Error/Success Handling** - Automatic notifications for all API calls
4. **User Action Notifications** - Watchlist and portfolio updates
5. **Price Alert System** - Monitor stock price thresholds
6. **News Notifications** - Updates for watchlist tickers
7. **Persistent Storage** - Notifications saved across browser sessions
8. **Priority System** - Low, Medium, High, Critical priority levels
9. **Category Filtering** - Portfolio, Market, News, System categories
10. **Auto-dismiss** - Success/Warning/Info dismiss after X seconds, Errors require action

---

## Quick Start

### 1. Using Toast Notifications in Components

```javascript
import useAppStore from '../store/useAppStore';

function MyComponent() {
  const { notifySuccess, notifyError, notifyWarning, notifyInfo } = useAppStore();

  const handleAction = () => {
    // Show success notification
    notifySuccess('Operation completed successfully', {
      category: 'Portfolio',
      duration: 3000,
    });

    // Show error notification
    notifyError('Something went wrong', {
      category: 'System',
      priority: 'high',
    });

    // Show warning notification
    notifyWarning('Please review your settings', {
      category: 'System',
    });

    // Show info notification
    notifyInfo('New features available', {
      category: 'System',
    });
  };

  return <button onClick={handleAction}>Perform Action</button>;
}
```

### 2. Automatic API Notifications

API notifications are handled automatically via axios interceptors. All mutations (POST, PUT, PATCH, DELETE) will show success notifications, and all errors will show error notifications.

To **suppress** automatic notifications for a specific request:

```javascript
import apiService from '../services/api';

// Suppress success notification
apiService.post('/endpoint', data, { suppressNotification: true });

// Or directly with axios
api.post('/endpoint', data, { suppressNotification: true });
```

### 3. Using WebSocket for Real-time Notifications

```javascript
import { useNotificationSocket } from '../features/notifications/hooks/useNotificationSocket';

function MyComponent() {
  const { isConnected, subscribe, unsubscribe } = useNotificationSocket('user-123', {
    onConnect: () => console.log('WebSocket connected'),
    onMessage: (data) => console.log('Received notification:', data),
  });

  useEffect(() => {
    // Subscribe to ticker updates
    subscribe('AAPL');
    subscribe('GOOGL');

    return () => {
      unsubscribe('AAPL');
      unsubscribe('GOOGL');
    };
  }, []);

  return <div>WebSocket Status: {isConnected ? 'Connected' : 'Disconnected'}</div>;
}
```

### 4. Price Alerts

```javascript
import { usePriceAlerts, useCreatePriceAlert } from '../features/notifications/hooks/usePriceAlerts';

function PriceAlertComponent() {
  // Monitor price alerts (polls every 60 seconds by default)
  const { activeAlerts, priceData } = usePriceAlerts({
    pollingInterval: 30000, // Check every 30 seconds
  });

  // Create new alerts
  const { createAlert } = useCreatePriceAlert();

  const handleCreateAlert = () => {
    // Alert when price goes above $150
    createAlert('AAPL', 'above', 150);

    // Alert when price goes below $140
    createAlert('AAPL', 'below', 140);

    // Alert when price increases by 5%
    createAlert('AAPL', 'percent_increase', null, {
      basePrice: 140,
      percentChange: 5,
      note: 'Watch for breakout',
    });

    // Alert when price decreases by 3%
    createAlert('AAPL', 'percent_decrease', null, {
      basePrice: 140,
      percentChange: 3,
      note: 'Stop loss',
    });
  };

  return (
    <div>
      <button onClick={handleCreateAlert}>Create Alert</button>
      <p>Active Alerts: {activeAlerts.length}</p>
    </div>
  );
}
```

### 5. News Notifications

```javascript
import { useNewsNotifications } from '../features/notifications/hooks/useNewsNotifications';

function App() {
  // Monitor news for watchlist (polls every 5 minutes by default)
  const { newsData } = useNewsNotifications({
    pollingInterval: 180000, // Check every 3 minutes
  });

  return <YourApp />;
}
```

### 6. React Query Mutations with Notifications

```javascript
import { useNotificationMutation } from '../features/notifications/hooks/useNotificationMutations';

function MyComponent() {
  const mutation = useNotificationMutation(
    (ticker) => apiService.post('/watchlist', { ticker }),
    {
      successMessage: 'Added to watchlist successfully',
      category: 'Portfolio',
      invalidateQueries: ['watchlist'], // Refresh watchlist query
    }
  );

  return (
    <button onClick={() => mutation.mutate('AAPL')}>
      Add to Watchlist
    </button>
  );
}
```

---

## Notification Schema

Each notification has the following structure:

```javascript
{
  id: number,                    // Unique identifier
  timestamp: string,              // ISO string timestamp
  type: string,                   // 'success' | 'error' | 'warning' | 'info' | 'critical'
  category: string,               // 'Portfolio' | 'Market' | 'News' | 'System'
  priority: string,               // 'low' | 'medium' | 'high' | 'critical'
  title: string,                  // Notification title
  message: string,                // Notification message
  isRead: boolean,                // Read status
  isArchived: boolean,            // Archive status
  showAsToast: boolean,           // Show in toast container
  duration: number | null,        // Auto-dismiss duration (null = manual dismiss)
  actionUrl: string | null,       // Optional link for "View Details"
  metadata: object,               // Additional custom data
}
```

---

## Zustand Store API

### Notification Actions

```javascript
import useAppStore from '../store/useAppStore';

const {
  // State
  notifications,
  priceAlerts,

  // Notification Actions
  addNotification,
  removeNotification,
  updateNotification,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  getUnreadCount,
  clearNotifications,

  // Helper Methods
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,

  // Price Alert Actions
  addPriceAlert,
  removePriceAlert,
  updatePriceAlert,
  togglePriceAlert,
  getActiveAlertsForTicker,

  // Watchlist Actions (with notifications)
  addToWatchlist,
  removeFromWatchlist,
} = useAppStore();
```

### Example: Custom Notification

```javascript
const addNotification = useAppStore(state => state.addNotification);

addNotification({
  type: 'warning',
  category: 'Market',
  priority: 'high',
  title: 'Market Alert',
  message: 'S&P 500 down 2% in early trading',
  actionUrl: '/market',
  metadata: {
    index: 'SPX',
    change: -2.1,
  },
});
```

---

## Backend Integration

### WebSocket Endpoint

**URL**: `ws://localhost:8000/ws/notifications/{client_id}`

**Messages from Client**:

```javascript
// Subscribe to ticker updates
{ type: 'subscribe', ticker: 'AAPL' }

// Unsubscribe from ticker
{ type: 'unsubscribe', ticker: 'AAPL' }

// Keepalive ping
{ type: 'ping' }
```

**Messages from Server**:

```javascript
// Notification
{
  type: 'notification',
  data: { /* notification object */ },
  timestamp: '2025-01-01T12:00:00Z'
}

// Ticker update
{
  type: 'ticker_update',
  ticker: 'AAPL',
  data: { /* notification object */ },
  timestamp: '2025-01-01T12:00:00Z'
}

// Subscription confirmation
{
  type: 'subscribed',
  ticker: 'AAPL',
  message: 'Subscribed to AAPL updates'
}
```

### Backend Services

#### NotificationService

```python
from app.services.notification_service import notification_service

# Send notification to specific client
await notification_service.send_notification(
    client_id='user-123',
    notification_type='warning',
    title='Price Alert',
    message='AAPL reached $150',
    category='Market',
    priority='high',
    metadata={'ticker': 'AAPL', 'price': 150}
)

# Broadcast to all clients
await notification_service.broadcast_notification(
    notification_type='info',
    title='Market Update',
    message='Markets closed for holiday',
    category='Market',
    priority='medium'
)

# Send price alert
await notification_service.send_price_alert(
    client_id='user-123',
    ticker='AAPL',
    current_price=151.50,
    alert_price=150.00,
    alert_type='above'
)

# Send news notification
await notification_service.send_news_notification(
    client_id='user-123',
    ticker='AAPL',
    news_count=5,
    sentiment=0.7
)
```

#### PriceAlertService

```python
from app.services.price_alert_service import price_alert_service

# Add alert
price_alert_service.add_alert(
    client_id='user-123',
    ticker='AAPL',
    condition='above',
    target_price=150.00,
    alert_id='alert-1'
)

# Remove alert
price_alert_service.remove_alert('user-123', 'alert-1')

# Check alerts (called automatically by monitoring task)
await price_alert_service.check_price_alerts('AAPL', 151.50)

# Start monitoring (run on app startup)
price_alert_service.start_monitoring(interval=60)
```

---

## UI Components

### ToastContainer

Added to [App.js](../../App.js). Renders all active toast notifications.

### NotificationDropdown

Located in app header. Shows 5 most recent notifications with unread indicator.

### NotificationPage

Full notification center at `/notifications` with:
- Active notifications tab
- Archive tab
- Subscription settings tab
- Category filtering
- Mark all as read / Clear all actions

---

## Configuration

### Auto-dismiss Durations

Configured in Zustand store helper methods:

- Success: 3000ms (3 seconds)
- Info: 4000ms (4 seconds)
- Warning: 5000ms (5 seconds)
- Error: null (manual dismiss)
- Critical: null (manual dismiss)

### Polling Intervals

- **Price Alerts**: 60 seconds (configurable via `usePriceAlerts` hook)
- **News Updates**: 300 seconds / 5 minutes (configurable via `useNewsNotifications` hook)

### WebSocket Reconnection

- **Max Attempts**: 3 in development, 10 in production
- **Interval**: 5 seconds
- **Keepalive Ping**: Every 30 seconds
- **StrictMode Handling**: Properly handles React 19 StrictMode double-mount
- **Graceful Degradation**: App works fully without WebSocket connection

---

## Best Practices

1. **Use helper methods** (`notifySuccess`, `notifyError`, etc.) instead of `addNotification` directly
2. **Set appropriate categories** to help users filter notifications
3. **Use priority levels** to distinguish urgent vs. informational notifications
4. **Provide actionUrl** when notifications can link to relevant pages
5. **Include metadata** for programmatic access to notification data
6. **Suppress automatic notifications** for background/silent operations
7. **Clean up WebSocket subscriptions** in component unmount

---

## Testing

### Test Toast Notifications

```javascript
// Add this to any component temporarily
const { notifySuccess, notifyError, notifyWarning, notifyInfo } = useAppStore();

notifySuccess('Test success notification');
notifyError('Test error notification');
notifyWarning('Test warning notification');
notifyInfo('Test info notification');
```

### Test Price Alerts

1. Add a ticker to watchlist
2. Create a price alert using `useCreatePriceAlert`
3. Wait for polling interval or manually trigger price check
4. Verify notification appears when condition is met

### Test WebSocket

1. Open browser console
2. Start backend server
3. Load the app
4. Check for "WebSocket connected" message
5. Subscribe to a ticker
6. Send test notification from backend

---

## Troubleshooting

### Toast notifications not appearing

- Verify `ToastContainer` is added to App.js
- Check browser console for errors
- Ensure notifications have `showAsToast: true`

### WebSocket not connecting

**This is normal in development!** The app is designed to work without the backend running.

- **Expected behavior**: You'll see connection attempts and failures in console
- **App still works**: Price alerts and news polling use REST API, not WebSocket
- **To enable WebSocket**:
  1. Start your FastAPI backend: `cd backend && uvicorn app.main:app --reload`
  2. Verify it's running: `curl http://localhost:8000`
  3. WebSocket will auto-connect when backend is available

**Common issues**:
- Backend not running → Start backend server
- Wrong port → Check backend is on port 8000
- CORS errors → Verify CORS config in `backend/app/main.py`
- StrictMode errors → These are expected in React 19 development mode and are properly handled

### Price alerts not triggering

- Ensure ticker is in watchlist
- Verify price alert is active (`isActive: true`)
- Check polling interval is running
- Verify API is returning price data

### Notifications not persisting

- Check localStorage quota
- Verify `partialize` in Zustand persist config includes `notifications`
- Clear browser cache if corrupted

---

## Future Enhancements

- [ ] Push notifications (browser API)
- [ ] Email/SMS notification options
- [ ] Notification grouping/threading
- [ ] Custom notification sounds
- [ ] Notification templates
- [ ] Scheduled notifications
- [ ] Notification analytics/history
- [ ] Bulk notification actions

---

## Support

For issues or questions, please refer to the main project documentation or contact the development team.
