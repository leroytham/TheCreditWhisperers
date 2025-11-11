import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, RefreshCw, AlertTriangle, Info, CheckCheck } from 'lucide-react';
import AppHeader from '../components/layout/AppHeader';
import NotificationList from '../features/notifications/components/NotificationList';
import NotificationModal from '../features/notifications/components/NotificationModal';
import UnifiedAlertModal from '../features/notifications/components/UnifiedAlertModal';
import UnifiedAlertList from '../features/notifications/components/UnifiedAlertList';
import useAppStore from '../store/useAppStore';
import {
  useNotifications,
  useUnreadCount,
  useNotificationPreferences,
  useNotificationSync
} from '../features/notifications/hooks/useNotifications';

/**
 * NotificationPageEnhanced - Server-backed Notification Center
 *
 * Displays notifications from the server with real-time updates,
 * filtering, and preference management
 */
const NotificationPageEnhanced = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isServerEnabled, setIsServerEnabled] = useState(true); // Feature flag for server mode
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Server-backed notifications (when enabled)
  const serverFilters = {
    is_archived: activeTab === 'archive',
    limit: 100,
  };

  const {
    notifications: serverNotifications,
    totalCount,
    isLoading: isLoadingNotifications,
    error: notificationsError,
    refetch: refetchNotifications,
    markAsRead: serverMarkAsRead,
    markAllAsRead: serverMarkAllAsRead,
    archive: serverArchive,
    deleteNotification: serverDelete,
    clearNotifications: serverClear,
    isMarkingAsRead,
    isMarkingAllAsRead,
    isArchiving,
    isDeleting,
    isClearing,
  } = useNotifications(isServerEnabled ? serverFilters : null);

  const { unreadCount, isLoading: isLoadingCount } = useUnreadCount();
  const { handleNewNotification } = useNotificationSync();

  // Notification preferences from server
  const {
    preferences,
    isLoading: isLoadingPreferences,
    updatePreferences,
    isUpdating,
  } = useNotificationPreferences();

  // Local state for category filters (synced with server preferences)
  const [categoryFilters, setCategoryFilters] = useState({
    Portfolio: true,
    Market: true,
    News: true,
    System: true,
  });

  // Sync local filters with server preferences
  useEffect(() => {
    if (preferences) {
      setCategoryFilters({
        Portfolio: preferences.enable_portfolio ?? true,
        Market: preferences.enable_market ?? true,
        News: preferences.enable_news ?? true,
        System: preferences.enable_system ?? true,
      });
    }
  }, [preferences]);

  // Fallback to local store if server is disabled
  const {
    notifications: localNotifications,
    markAsRead: localMarkAsRead,
    archiveNotification: localArchive,
    markAllAsRead: localMarkAllAsRead,
    clearActiveNotifications,
    clearArchivedNotifications
  } = useAppStore();

  // Determine which notifications to use
  const notifications = isServerEnabled ? serverNotifications : localNotifications;

  // Filter notifications based on category filters
  const filterNotifications = (notificationsList) => {
    return notificationsList.filter((notif) => {
      const category = notif.category || 'System';
      return categoryFilters[category] !== false;
    });
  };

  // Apply filters
  const activeNotifications = filterNotifications(
    notifications.filter(n => !n.is_archived && !n.isArchived)
  );
  const archivedNotifications = filterNotifications(
    notifications.filter(n => n.is_archived || n.isArchived)
  );

  const displayedNotifications = activeTab === 'active'
    ? activeNotifications
    : activeTab === 'archive'
    ? archivedNotifications
    : [];

  const newCount = isServerEnabled
    ? unreadCount
    : activeNotifications.filter(n => !n.is_read && !n.isRead).length;

  // Handlers
  const handleNotificationClick = async (notification) => {
    setSelectedNotification(notification);

    // Mark as read when clicked
    if (!notification.is_read && !notification.isRead) {
      if (isServerEnabled) {
        await serverMarkAsRead(notification.id);
      } else {
        localMarkAsRead(notification.id);
      }
    }
  };

  const handleCloseModal = () => {
    setSelectedNotification(null);
  };

  const handleMarkAllAsRead = async () => {
    if (isServerEnabled) {
      await serverMarkAllAsRead();
    } else {
      localMarkAllAsRead();
    }
  };

  const handleArchive = async (notificationId) => {
    if (isServerEnabled) {
      await serverArchive(notificationId);
    } else {
      localArchive(notificationId);
    }
    setSelectedNotification(null);
  };

  const handleDelete = async (notificationId) => {
    const confirm = window.confirm('Are you sure you want to delete this notification?');
    if (confirm) {
      if (isServerEnabled) {
        await serverDelete(notificationId);
      }
      setSelectedNotification(null);
    }
  };

  const handleClearAll = async () => {
    const tabName = activeTab === 'active' ? 'active' : 'archived';
    const confirm = window.confirm(`Are you sure you want to clear all ${tabName} notifications?`);
    if (confirm) {
      if (isServerEnabled) {
        await serverClear(activeTab === 'archive');
      } else {
        if (activeTab === 'active') {
          clearActiveNotifications();
        } else {
          clearArchivedNotifications();
        }
      }
    }
  };

  const handleCategoryFilterChange = async (category, enabled) => {
    // Update local state immediately
    const newFilters = { ...categoryFilters, [category]: enabled };
    setCategoryFilters(newFilters);

    // Update server preferences if enabled
    if (isServerEnabled) {
      const preferenceKey = `enable_${category.toLowerCase()}`;
      await updatePreferences({ [preferenceKey]: enabled });
    }
  };

  const handleGenerateTestNotification = async () => {
    if (isServerEnabled) {
      try {
        const { notificationApi } = await import('../services/notificationApi');
        const newNotification = await notificationApi.createSampleNotification();
        handleNewNotification(newNotification);
      } catch (error) {
        console.error('Failed to create test notification:', error);
      }
    } else {
      // Use local store test notifications
      const { notifyWithMetadata } = useAppStore.getState();
      notifyWithMetadata({
        type: 'info',
        category: 'System',
        title: 'Test Notification',
        message: 'This is a test notification from the enhanced page',
        preview: 'Test notification...',
      });
    }
  };

  const handleRefresh = () => {
    if (isServerEnabled) {
      refetchNotifications();
    }
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (confirmLogout) {
      sessionStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  };

  // Error display
  if (notificationsError && isServerEnabled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader activeTab="notifications" onLogout={handleLogout} />
        <main className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 p-6 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Error loading notifications</h3>
                  <p className="text-sm text-red-700 mt-1">{notificationsError.message}</p>
                  <button
                    onClick={() => setIsServerEnabled(false)}
                    className="mt-2 text-sm text-red-600 underline hover:text-red-500"
                  >
                    Switch to local mode
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader activeTab="notifications" onLogout={handleLogout} />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-full mx-auto">

          {/* Page Header with Server Status */}
          <section className="pb-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">
                Notification Center
                {isServerEnabled && (
                  <span className="ml-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Server-Backed
                  </span>
                )}
              </h1>
              {isServerEnabled && (
                <button
                  onClick={handleRefresh}
                  disabled={isLoadingNotifications}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  title="Refresh notifications"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoadingNotifications ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

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
                onClick={() => setActiveTab('alerts')}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'alerts'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Alerts
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

          {/* Notification Status Bar */}
          {activeTab !== 'subscriptions' && activeTab !== 'alerts' && (
            <section className="bg-white p-4 rounded-lg shadow my-8 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {displayedNotifications.length} Notifications{' '}
                {isServerEnabled && !isLoadingCount && (
                  <span className="text-gray-500 font-normal">({newCount} New)</span>
                )}
              </h2>
              <div className="flex gap-2">
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleGenerateTestNotification}
                    className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-600 rounded-md hover:bg-purple-50"
                  >
                    [DEV] Test Notification
                  </button>
                )}
                {newCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={isMarkingAllAsRead}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50"
                  >
                    {isMarkingAllAsRead ? 'Marking...' : 'Mark All as Read'}
                  </button>
                )}
                {displayedNotifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={isClearing}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
                  >
                    {isClearing ? 'Clearing...' : 'Clear All'}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Main Content */}
          {activeTab === 'alerts' ? (
            <div className="bg-white p-8 rounded-lg shadow">
              <UnifiedAlertList onCreateNew={() => setShowAlertModal(true)} />
            </div>
          ) : activeTab === 'subscriptions' ? (
            <div className="bg-white p-8 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Notification Preferences
                {isUpdating && (
                  <span className="ml-2 text-sm text-gray-500">Saving...</span>
                )}
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Category Filters</h3>
                  <div className="space-y-3">
                    {Object.entries(categoryFilters).map(([category, enabled]) => (
                      <label key={category} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => handleCategoryFilterChange(category, e.target.checked)}
                          disabled={isUpdating}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="ml-3 text-gray-700">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {isServerEnabled && preferences && (
                  <>
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Settings</h3>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={preferences.enable_toast}
                            onChange={(e) => updatePreferences({ enable_toast: e.target.checked })}
                            disabled={isUpdating}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                          />
                          <span className="ml-3 text-gray-700">Show toast notifications</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={preferences.enable_websocket}
                            onChange={(e) => updatePreferences({ enable_websocket: e.target.checked })}
                            disabled={isUpdating}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                          />
                          <span className="ml-3 text-gray-700">Enable real-time updates</span>
                        </label>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Alert Priority</h3>
                      <select
                        value={preferences.min_priority}
                        onChange={(e) => updatePreferences({ min_priority: e.target.value })}
                        disabled={isUpdating}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:opacity-50"
                      >
                        <option value="low">All notifications</option>
                        <option value="medium">Medium and above</option>
                        <option value="high">High and above</option>
                        <option value="critical">Critical only</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Alert Settings</h3>
                  <p className="text-gray-600">
                    Price alerts and news notifications are managed through your watchlist.
                  </p>
                </div>

                {!isServerEnabled && (
                  <div className="border-t pt-6">
                    <div className="bg-yellow-50 p-4 rounded-md">
                      <div className="flex">
                        <Info className="h-5 w-5 text-yellow-400" />
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Local Mode Active
                          </h3>
                          <p className="mt-1 text-sm text-yellow-700">
                            Preferences are stored locally and will not sync across devices.
                          </p>
                          <button
                            onClick={() => setIsServerEnabled(true)}
                            className="mt-2 text-sm text-yellow-600 underline hover:text-yellow-500"
                          >
                            Switch to server mode
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
                          onChange={(e) => handleCategoryFilterChange(category, e.target.checked)}
                          disabled={isUpdating}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="ml-3 text-gray-700">{category}</span>
                      </label>
                    ))}
                  </div>

                  {isServerEnabled && (
                    <div className="mt-6 pt-6 border-t">
                      <div className="text-sm text-gray-500">
                        <CheckCheck className="h-4 w-4 inline mr-1" />
                        Synced with server
                      </div>
                    </div>
                  )}
                </div>
              </aside>

              {/* Notifications List */}
              <section className="lg:col-span-2">
                {isLoadingNotifications && isServerEnabled ? (
                  <div className="bg-white p-8 rounded-lg shadow">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
                      <span className="ml-3 text-gray-500">Loading notifications...</span>
                    </div>
                  </div>
                ) : displayedNotifications.length === 0 ? (
                  <div className="bg-white p-8 rounded-lg shadow text-center">
                    <Bell className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No notifications</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {activeTab === 'active'
                        ? 'You have no active notifications.'
                        : 'Your archive is empty.'}
                    </p>
                  </div>
                ) : (
                  <NotificationList
                    notifications={displayedNotifications}
                    onNotificationClick={handleNotificationClick}
                    onArchive={handleArchive}
                    showArchive={activeTab === 'active'}
                  />
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Notification Modal */}
      {selectedNotification && (
        <NotificationModal
          notification={selectedNotification}
          onClose={handleCloseModal}
          onArchive={() => handleArchive(selectedNotification.id)}
          onDelete={() => handleDelete(selectedNotification.id)}
        />
      )}

      {/* Unified Alert Modal */}
      {showAlertModal && (
        <UnifiedAlertModal
          onClose={() => setShowAlertModal(false)}
          onSuccess={() => {
            setShowAlertModal(false);
            // Optionally show success message
          }}
          defaultAlertType="price"
        />
      )}
    </div>
  );
};

export default NotificationPageEnhanced;