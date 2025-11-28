import React, { useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';

// Type definitions
interface NotificationItem {
  id: string;
  title?: string;
  message?: string;
  preview?: string;
  subcategory?: string;
  isRead?: boolean;
  is_global?: boolean;
  portfolio_name?: string;
  affected_tickers?: string[];
}

interface NotificationListProps {
  notifications: NotificationItem[];
  onNotificationClick?: (notification: NotificationItem) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  showArchive?: boolean;
}

/**
 * NotificationList Component
 *
 * Displays categorized list of notifications
 */
const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onNotificationClick,
  onArchive,
  onDelete,
  showArchive = true,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Use all notifications
  const filteredNotifications = notifications;

  // Group notifications by subcategory
  const groupedNotifications = filteredNotifications.reduce<Record<string, NotificationItem[]>>((acc, notif) => {
    const key = notif.subcategory || 'Other';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(notif);
    return acc;
  }, {});

  const subcategoryTitles: Record<string, string> = {
    'Critical Threats': 'Critical Threats & Account Issues',
    'Emerging Opportunities': 'Emerging Opportunities',
    'Market Intelligence': 'Market Intelligence',
    'Account Servicing': 'Account Servicing',
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="space-y-6">
        {Object.entries(groupedNotifications).map(([subcategory, notifs]) => (
          <section key={subcategory}>
            <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b border-gray-200">
              {subcategoryTitles[subcategory] || subcategory} ({notifs.length})
            </h3>
            <ul className="mt-4 space-y-2">
              {notifs.map((notif) => (
                <li
                  key={notif.id}
                  onMouseEnter={() => setHoveredId(notif.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`flex items-start p-3 rounded-lg hover:bg-gray-100 cursor-pointer relative group ${
                    !notif.isRead ? 'bg-blue-100 border border-blue-300' : ''
                  }`}
                >
                  <div onClick={() => onNotificationClick?.(notif)} className="flex items-start flex-1">
                    <input
                      type="checkbox"
                      checked={!notif.isRead}
                      readOnly
                      className="h-4 w-4 mt-1 text-gray-600 border-gray-300 rounded focus:ring-gray-500 pointer-events-none"
                    />
                    <div className="ml-3 text-sm flex-1">
                      {/* Title and Badges Row */}
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 flex-1 min-w-0">{notif.title}</p>

                        {/* Portfolio Badge */}
                        {notif.is_global ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                            Global
                          </span>
                        ) : notif.portfolio_name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                            {notif.portfolio_name}
                          </span>
                        ) : null}
                      </div>

                      {/* Message */}
                      <p className="text-gray-600 mt-1">{notif.preview || notif.message}</p>

                      {/* Affected Tickers */}
                      {notif.affected_tickers && notif.affected_tickers.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {notif.affected_tickers.slice(0, 5).map((ticker: string) => (
                            <span
                              key={ticker}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 text-gray-700 border border-gray-300"
                            >
                              {ticker}
                            </span>
                          ))}
                          {notif.affected_tickers.length > 5 && (
                            <span className="text-xs text-gray-500">
                              +{notif.affected_tickers.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {(onArchive || onDelete) && hoveredId === notif.id && (
                    <div className="flex items-center gap-2 ml-2">
                      {/* Archive Button - Show for active notifications */}
                      {onArchive && showArchive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onArchive(notif.id);
                          }}
                          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                          title="Archive notification"
                          aria-label="Archive notification"
                        >
                          <Archive className="w-4 h-4 text-gray-600 hover:text-blue-600" />
                        </button>
                      )}
                      {/* Delete Button - Show for archived notifications */}
                      {onDelete && !showArchive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this notification?')) {
                              onDelete(notif.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                          title="Delete notification"
                          aria-label="Delete notification"
                        >
                          <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-600" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {Object.keys(groupedNotifications).length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No notifications found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationList;
