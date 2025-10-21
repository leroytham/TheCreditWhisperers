import React from 'react';

/**
 * NotificationList Component
 *
 * Displays categorized list of notifications
 */
const NotificationList = ({ notifications, onNotificationClick }) => {
  // Group notifications by subcategory
  const groupedNotifications = notifications.reduce((acc, notif) => {
    if (!acc[notif.subcategory]) {
      acc[notif.subcategory] = [];
    }
    acc[notif.subcategory].push(notif);
    return acc;
  }, {});

  const subcategoryTitles = {
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
                  onClick={() => onNotificationClick(notif)}
                  className={`flex items-start p-3 rounded-lg hover:bg-gray-100 cursor-pointer ${
                    notif.isNew ? 'bg-blue-100 border border-blue-300' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={notif.isNew}
                    readOnly
                    className="h-4 w-4 mt-1 text-gray-600 border-gray-300 rounded focus:ring-gray-500 pointer-events-none"
                  />
                  <div className="ml-3 text-sm">
                    <p className="font-medium text-gray-900">{notif.title}</p>
                    <p className="text-gray-600">{notif.preview}</p>
                  </div>
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
