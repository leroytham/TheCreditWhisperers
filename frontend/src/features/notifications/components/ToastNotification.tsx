import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X, LucideIcon } from 'lucide-react';

// Type definitions
type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'critical';

interface ToastNotificationData {
  id: string | number;
  type?: NotificationType;
  title?: string;
  message?: string;
  duration?: number;
  category?: string;
  timestamp?: string | number | Date;
  actionUrl?: string;
}

interface ToastNotificationProps {
  notification: ToastNotificationData;
  onRemind?: () => void;
  onAcknowledge?: () => void;
  onDismiss?: () => void;
}

interface TypeConfig {
  icon: LucideIcon;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  titleColor: string;
  textColor: string;
}

/**
 * ToastNotification Component
 *
 * Floating toast notification that appears in the top-right corner
 * Supports multiple types: success, error, warning, info, critical
 * Auto-dismisses based on type unless it's an error or critical notification
 */
const ToastNotification: React.FC<ToastNotificationProps> = ({
  notification,
  onRemind,
  onAcknowledge,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    if (notification) {
      // Slide in after a brief delay
      setTimeout(() => setIsVisible(true), 100);

      // Auto-dismiss for non-error types
      if (notification.type !== 'error' && notification.type !== 'critical') {
        const autoDismissTime = notification.duration || 5000; // 5 seconds default
        const timer = setTimeout(() => {
          handleDismiss();
        }, autoDismissTime);

        return () => clearTimeout(timer);
      }
    }
  }, [notification]);

  if (!notification) return null;

  const handleRemind = () => {
    setIsVisible(false);
    setTimeout(() => onRemind && onRemind(), 300);
  };

  const handleAcknowledge = () => {
    setIsVisible(false);
    setTimeout(() => onAcknowledge && onAcknowledge(), 300);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss && onDismiss(), 300);
  };

  // Configuration for different notification types
  const typeConfig = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      textColor: 'text-green-800'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      textColor: 'text-red-800'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900',
      textColor: 'text-yellow-800'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      textColor: 'text-blue-800'
    },
    critical: {
      icon: AlertTriangle,
      bgColor: 'bg-white',
      borderColor: 'border-red-500',
      iconColor: 'text-red-600',
      titleColor: 'text-gray-900',
      textColor: 'text-gray-700'
    }
  };

  const type = notification.type || 'info';
  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  // For critical notifications, show UBS branding
  const isCritical = type === 'critical';

  return (
    <div
      className={`w-full max-w-sm ${config.bgColor} shadow-lg rounded-lg pointer-events-auto border ${config.borderColor} transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start">
          {/* Icon or Logo */}
          <div className="flex-shrink-0">
            {isCritical ? (
              <svg
                className="h-6 w-6 text-red-600"
                viewBox="0 0 80 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.328,2.703v34.592h9.277v-8.471h4.922c10.378,0,18.06-7.391,18.06-17.481S26.905,2.703,16.527,2.703H2.328z M16.236,21.031h-4.631V10.496h4.631c3.562,0,5.932,2.373,5.932,5.267S19.799,21.031,16.236,21.031z"
                  fill="#D92D20"
                />
                <path
                  d="M47.781,25.434h-6.223v11.861h-9.277V2.703h15.5c8.891,0,14.686,5.358,14.686,13.062c0,5.12-2.91,9.368-7.301,11.595l9.277,10.232h-10.378L47.781,25.434z M47.405,18.261h-5.841V9.86h5.841c2.463,0,4.34,1.464,4.34,4.201S49.868,18.261,47.405,18.261z"
                  fill="#D92D20"
                />
              </svg>
            ) : (
              <Icon className={`h-6 w-6 ${config.iconColor}`} />
            )}
          </div>

          {/* Content */}
          <div className="ml-3 flex-1">
            <p className={`text-sm font-semibold ${config.titleColor}`}>
              {notification.title || type.charAt(0).toUpperCase() + type.slice(1)}
            </p>
            <p className={`text-sm mt-1 ${config.textColor}`}>
              {notification.message}
            </p>

            {/* Category and timestamp */}
            {(notification.category || notification.timestamp) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                {notification.category && (
                  <span className="font-medium">{notification.category}</span>
                )}
                {notification.timestamp && (
                  <span>{new Date(notification.timestamp).toLocaleTimeString()}</span>
                )}
              </div>
            )}

            {/* Action URL */}
            {notification.actionUrl && (
              <a
                href={notification.actionUrl}
                className="text-sm font-medium text-blue-600 hover:text-blue-500 mt-2 inline-block"
              >
                View Details →
              </a>
            )}
          </div>

          {/* Close button for non-critical */}
          {!isCritical && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Actions for critical/error notifications */}
        {(type === 'error' || type === 'critical') && (
          <div className="mt-4 flex justify-end space-x-4">
            {onRemind && (
              <button
                onClick={handleRemind}
                className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
              >
                REMIND ME LATER
              </button>
            )}
            <button
              onClick={handleAcknowledge}
              className="px-3 py-1 border border-gray-400 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              ACKNOWLEDGE
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToastNotification;
