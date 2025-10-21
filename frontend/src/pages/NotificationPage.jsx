import React, { useState } from 'react';
import AppHeader from '../components/layout/AppHeader';
import NotificationFilters from '../features/notifications/components/NotificationFilters';
import NotificationList from '../features/notifications/components/NotificationList';
import NotificationModal from '../features/notifications/components/NotificationModal';
import { mockNotifications } from '../features/notifications/data/mockNotifications';

/**
 * NotificationPage - Notification Center page
 *
 * Displays active notifications, archive, and subscriptions with filtering capabilities
 */
const NotificationPage = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [filters, setFilters] = useState({
    selectAll: false,
    marketSignals: {
      enabled: true,
      criticalThreats: true,
      emergingOpportunities: true,
      marketIntelligence: true,
    },
    operationalAlerts: {
      enabled: true,
      accountServicing: true,
      tradeSettlement: false,
      complianceReporting: false,
    },
  });

  // Filter notifications based on current filters
  const filterNotifications = (notifications) => {
    return notifications.filter((notif) => {
      if (notif.category === 'Market Signals') {
        if (!filters.marketSignals.enabled) return false;
        if (notif.subcategory === 'Critical Threats' && !filters.marketSignals.criticalThreats) return false;
        if (notif.subcategory === 'Emerging Opportunities' && !filters.marketSignals.emergingOpportunities) return false;
        if (notif.subcategory === 'Market Intelligence' && !filters.marketSignals.marketIntelligence) return false;
      }
      if (notif.category === 'Operational Alerts') {
        if (!filters.operationalAlerts.enabled) return false;
        if (notif.subcategory === 'Account Servicing' && !filters.operationalAlerts.accountServicing) return false;
        if (notif.subcategory === 'Trade & Settlement' && !filters.operationalAlerts.tradeSettlement) return false;
        if (notif.subcategory === 'Compliance & Reporting' && !filters.operationalAlerts.complianceReporting) return false;
      }
      return true;
    });
  };

  const activeNotifications = filterNotifications(mockNotifications.filter(n => !n.archived));
  const archivedNotifications = filterNotifications(mockNotifications.filter(n => n.archived));
  const newCount = activeNotifications.filter(n => n.isNew).length;

  const displayedNotifications = activeTab === 'active' ? activeNotifications : archivedNotifications;

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
  };

  const handleCloseModal = () => {
    setSelectedNotification(null);
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
            <section className="bg-white p-4 rounded-lg shadow my-8">
              <h2 className="text-xl font-semibold text-gray-900">
                {displayedNotifications.length} Notifications{' '}
                <span className="text-gray-500 font-normal">({newCount} New)</span>
              </h2>
            </section>
          )}

          {/* Main Grid */}
          {activeTab === 'subscriptions' ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription Settings</h2>
              <p className="text-gray-600">Configure your notification preferences and alert subscriptions here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Filters Sidebar */}
              <aside className="lg:col-span-1">
                <NotificationFilters filters={filters} setFilters={setFilters} />
              </aside>

              {/* Notifications List */}
              <div className="lg:col-span-2">
                <NotificationList
                  notifications={displayedNotifications}
                  onNotificationClick={handleNotificationClick}
                />
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
