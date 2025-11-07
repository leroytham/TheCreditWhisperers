import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import AppHeader from '../components/layout/AppHeader';
import NotificationList from '../features/notifications/components/NotificationList';
import NotificationModal from '../features/notifications/components/NotificationModal';
import useAppStore from '../store/useAppStore';

/**
 * NotificationPage - Notification Center page
 *
 * Displays active notifications, archive, and subscriptions with filtering capabilities
 */
const NotificationPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [categoryFilters, setCategoryFilters] = useState({
    Portfolio: true,
    Market: true,
    News: true,
    System: true,
  });

  // Get notifications from store
  const { notifications, markAsRead, archiveNotification, markAllAsRead, clearNotifications, clearActiveNotifications, clearArchivedNotifications, notifySuccess, notifyError, notifyWarning, notifyInfo } = useAppStore();

  // Filter notifications based on category filters
  const filterNotifications = (notificationsList) => {
    return notificationsList.filter((notif) => {
      return categoryFilters[notif.category] !== false;
    });
  };

  const activeNotifications = filterNotifications(notifications.filter(n => !n.isArchived));
  const archivedNotifications = filterNotifications(notifications.filter(n => n.isArchived));
  const newCount = activeNotifications.filter(n => !n.isRead).length;

  const displayedNotifications = activeTab === 'active' ? activeNotifications : archivedNotifications;

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
    // Mark as read when clicked
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  const handleCloseModal = () => {
    setSelectedNotification(null);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleClearAll = () => {
    const tabName = activeTab === 'active' ? 'active' : 'archived';
    const confirm = window.confirm(`Are you sure you want to clear all ${tabName} notifications?`);
    if (confirm) {
      if (activeTab === 'active') {
        clearActiveNotifications();
      } else {
        clearArchivedNotifications();
      }
    }
  };

  const handleGenerateTestNotifications = () => {
    // Get the notifyWithMetadata helper
    const { notifyWithMetadata } = useAppStore.getState();

    // Simple notifications
    notifySuccess('Portfolio updated successfully', {
      category: 'Portfolio',
      actionUrl: '/portfolio'
    });

    notifyError('Failed to fetch market data', {
      category: 'Market',
      priority: 'high'
    });

    notifyWarning('AAPL price reached alert threshold: $150.00', {
      category: 'Market',
      actionUrl: '/entity?ticker=AAPL'
    });

    notifyInfo('3 new articles available for AAPL', {
      category: 'News',
      actionUrl: '/entity?ticker=AAPL'
    });

    // Enriched notification with full metadata
    notifyWithMetadata({
      type: 'warning',
      category: 'Market',
      subcategory: 'Market Signals',
      title: 'Critical Sentiment Alert',
      message: 'AAPL sentiment dropped significantly (-0.45) with 3x normal news volume',
      preview: 'AAPL sentiment dropped significantly (-0.45)...',
      modalTitle: 'Market Alert: AAPL',
      subject: 'Critical Sentiment Change Detected',
      body: 'Apple Inc. (AAPL) has experienced a sharp decline in sentiment score from +0.12 to -0.45 over the past 24 hours, coinciding with a 3x increase in news volume compared to the 7-day average. This suggests a significant negative market event or news development.',
      priority: 'high',
      signalAnalysis: {
        triggerRule: 'Sentiment < -0.3 AND Volume > 2x Avg',
        sentimentScore: -0.45,
        volumeChange: '+200%',
      },
      portfolioImpact: {
        ticker: 'AAPL',
        price: '$147.52',
        change: '-3.2%',
      },
      actionUrl: '/entity?ticker=AAPL',
    });
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (confirmLogout) {
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader activeTab="notifications" onLogout={handleLogout} />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-full mx-auto">

          {/* Page Header */}
          <section className="pb-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-900">Notification Center</h1>
            <nav className="-mb-px flex space-x-8 mt-4" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('active')}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'active'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Active Notifications{' '}
                <span className="bg-gray-200 text-gray-600 ml-2 py-0.5 px-2 rounded-full text-xs font-medium">
                  {activeNotifications.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('archive')}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'archive'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Archive{' '}
                <span className="bg-gray-200 text-gray-600 ml-2 py-0.5 px-2 rounded-full text-xs font-medium">
                  {archivedNotifications.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'subscriptions'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Subscriptions
              </button>
            </nav>
          </section>

          {/* Notification Status */}
          {activeTab !== 'subscriptions' && (
            <section className="bg-white p-4 rounded-lg shadow my-8 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {displayedNotifications.length} Notifications{' '}
                <span className="text-gray-500 font-normal">({newCount} New)</span>
              </h2>
              <div className="flex gap-2">
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleGenerateTestNotifications}
                    className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-600 rounded-md hover:bg-purple-50"
                  >
                    [DEV] Generate Test Notifications
                  </button>
                )}
                {newCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-600 rounded-md hover:bg-blue-50"
                  >
                    Mark All as Read
                  </button>
                )}
                {displayedNotifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-600 rounded-md hover:bg-red-50"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Main Grid */}
          {activeTab === 'subscriptions' ? (
            <div className="bg-white p-8 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Category Filters</h3>
                  <div className="space-y-3">
                    {Object.entries(categoryFilters).map(([category, enabled]) => (
                      <label key={category} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setCategoryFilters({ ...categoryFilters, [category]: e.target.checked })}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-3 text-gray-700">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Alert Settings</h3>
                  <p className="text-gray-600">Price alerts and news notifications are managed through your watchlist.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Filters Sidebar */}
              <aside className="lg:col-span-1">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter by Category</h3>
                  <div className="space-y-3">
                    {Object.entries(categoryFilters).map(([category, enabled]) => (
                      <label key={category} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setCategoryFilters({ ...categoryFilters, [category]: e.target.checked })}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-3 text-gray-700">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </aside>

              {/* Notifications List */}
              <div className="lg:col-span-2">
                {displayedNotifications.length > 0 ? (
                  <NotificationList
                    notifications={displayedNotifications}
                    onNotificationClick={handleNotificationClick}
                  />
                ) : (
                  <div className="bg-white p-12 rounded-lg shadow text-center">
                    <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No notifications yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      You'll receive notifications here when:
                    </p>
                    <ul className="text-left max-w-md mx-auto space-y-2 text-gray-700 mb-8">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>API operations complete or encounter errors</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>You add or remove items from your watchlist</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Price alerts are triggered for monitored stocks</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>New news articles arrive for your watched tickers</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Real-time market events occur via WebSocket</span>
                      </li>
                    </ul>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => navigate('/portfolio')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                      >
                        Go to Portfolio
                      </button>
                      {process.env.NODE_ENV === 'development' && (
                        <button
                          onClick={handleGenerateTestNotifications}
                          className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                        >
                          Generate Test Notifications
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Notification Modal */}
      {selectedNotification && (
        <NotificationModal
          notification={selectedNotification}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default NotificationPage;
