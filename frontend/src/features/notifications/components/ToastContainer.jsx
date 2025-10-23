import React from 'react';
import ToastNotification from './ToastNotification';
import useAppStore from '../../../store/useAppStore';

/**
 * ToastContainer Component
 *
 * Manages multiple simultaneous toast notifications with positioning and stacking
 * Displays notifications in top-right corner with auto-dismiss functionality
 */
const ToastContainer = () => {
  const notifications = useAppStore(state => state.notifications);
  const removeNotification = useAppStore(state => state.removeNotification);
  const updateNotification = useAppStore(state => state.updateNotification);

  // Filter for active toast notifications (not archived, recent)
  const activeToasts = notifications
    .filter(n => !n.isArchived && n.showAsToast)
    .slice(-5); // Show max 5 toasts at once

  const handleDismiss = (id) => {
    removeNotification(id);
  };

  const handleRemindLater = (id) => {
    // Mark as archived and schedule for later
    updateNotification(id, {
      isArchived: true,
      showAsToast: false,
      remindAt: Date.now() + (30 * 60 * 1000) // 30 minutes
    });
  };

  const handleAcknowledge = (id) => {
    // Mark as read and remove from toast view
    updateNotification(id, {
      isRead: true,
      isArchived: true,
      showAsToast: false
    });
  };

  return (
    <div className="fixed top-20 right-8 z-50 flex flex-col gap-3 pointer-events-none">
      {activeToasts.map((notification, index) => (
        <div
          key={notification.id}
          className="pointer-events-auto"
          style={{
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          <ToastNotification
            notification={notification}
            onDismiss={() => handleDismiss(notification.id)}
            onRemind={() => handleRemindLater(notification.id)}
            onAcknowledge={() => handleAcknowledge(notification.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
