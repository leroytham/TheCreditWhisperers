import React from 'react';
import ToastNotification from './ToastNotification';
import useAppStore from '../../../store/useAppStore';
import type { Toast } from '../../../types';

// Type for ToastNotification component props
interface ToastNotificationData {
  id: string | number;
  type?: 'success' | 'error' | 'warning' | 'info' | 'critical';
  title?: string;
  message?: string;
  duration?: number;
  category?: string;
  timestamp?: string | number | Date;
  actionUrl?: string;
}

/**
 * ToastContainer Component
 *
 * Manages multiple simultaneous toast notifications with positioning and stacking
 * Displays toasts in top-right corner with auto-dismiss functionality
 *
 * NOTE: Toasts are ephemeral UI messages from Zustand store.
 * For server-persisted notifications, see NotificationPageEnhanced.
 */
const ToastContainer: React.FC = () => {
  const toasts = useAppStore(state => state.toasts);
  const removeToast = useAppStore(state => state.removeToast);

  // Show max 5 toasts at once (most recent)
  const activeToasts = toasts.slice(-5);

  const handleDismiss = (id: string | number): void => {
    removeToast(id);
  };

  const handleRemindLater = (id: string | number): void => {
    // For ephemeral toasts, just dismiss (remind feature only for server notifications)
    removeToast(id);
  };

  const handleAcknowledge = (id: string | number): void => {
    // Just remove the toast
    removeToast(id);
  };

  // Convert Toast to ToastNotificationData (handle null -> undefined conversion)
  const toNotificationData = (toast: Toast): ToastNotificationData => ({
    id: toast.id,
    type: toast.type,
    title: toast.title,
    message: toast.message,
    duration: toast.duration ?? undefined, // Convert null to undefined
    category: toast.category,
    timestamp: toast.timestamp,
    actionUrl: toast.actionUrl ?? undefined, // Convert null to undefined
  });

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
            notification={toNotificationData(toast)}
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
