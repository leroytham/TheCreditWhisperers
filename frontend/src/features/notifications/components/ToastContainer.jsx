import React from 'react';
import ToastNotification from './ToastNotification';
import useAppStore from '../../../store/useAppStore';

/**
 * ToastContainer Component
 *
 * Manages multiple simultaneous toast notifications with positioning and stacking
 * Displays toasts in top-right corner with auto-dismiss functionality
 *
 * NOTE: Toasts are ephemeral UI messages from Zustand store.
 * For server-persisted notifications, see NotificationPageEnhanced.
 */
const ToastContainer = () => {
  const toasts = useAppStore(state => state.toasts);
  const removeToast = useAppStore(state => state.removeToast);

  // Show max 5 toasts at once (most recent)
  const activeToasts = toasts.slice(-5);

  const handleDismiss = (id) => {
    removeToast(id);
  };

  const handleRemindLater = (id) => {
    // For ephemeral toasts, just dismiss (remind feature only for server notifications)
    removeToast(id);
  };

  const handleAcknowledge = (id) => {
    // Just remove the toast
    removeToast(id);
  };

  return (
    <div className="fixed top-20 right-8 z-50 flex flex-col gap-3 pointer-events-none">
      {activeToasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
          style={{
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          <ToastNotification
            notification={toast}
            onDismiss={() => handleDismiss(toast.id)}
            onRemind={() => handleRemindLater(toast.id)}
            onAcknowledge={() => handleAcknowledge(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
