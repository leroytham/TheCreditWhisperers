import React, { useState, useEffect } from 'react';
import { Bell, User, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useUnreadCount } from '../features/notifications/hooks/useNotifications';

export default function Header() {
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [userData, setUserData] = useState({
    name: "Loading...",
    email: "",
    accountType: "Microsoft Account",
    avatar: "?"
  });

  // Fetch real notifications from backend
  const { notifications: realNotifications, isLoading: notificationsLoading, error: notificationsError } = useNotifications({
    is_archived: false,
    limit: 5, // Show only latest 5 in header dropdown
  });

  // Fetch unread count
  const { unreadCount, error: unreadError } = useUnreadCount();

  // Debug logging
  useEffect(() => {
    console.log('Header - Notifications loaded:', {
      notifications: realNotifications,
      count: realNotifications?.length,
      unreadCount,
      isLoading: notificationsLoading,
      error: notificationsError,
      unreadError
    });
  }, [realNotifications, unreadCount, notificationsLoading, notificationsError, unreadError]);

  useEffect(() => {
    const userEmail = sessionStorage.getItem("user");
    if (userEmail) {
      const name = userEmail.split('@')[0].split('.').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();

      setUserData({
        name: name,
        email: userEmail,
        accountType: "Microsoft Account",
        avatar: initials
      });
    }
  }, []);

  const handleSettings = () => {
    alert('Settings functionality coming soon!');
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      sessionStorage.removeItem("user");
      navigate("/login");
    }
  };

  // Format timestamp to relative time
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const notifications = realNotifications || [];

  return (
    <div className="bg-white transition-colors border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-bold text-blue-600">Financial System</h1>
        
        <div className="flex items-center space-x-4">
          {/* Bell Icon */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setProfileOpen(false);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => navigate('/notifications')}
                        className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${!notif.isRead && !notif.is_read ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{notif.title}</div>
                            <div className="text-sm text-gray-600 mt-1">{notif.message}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatTimestamp(notif.createdAt || notif.created_at || notif.timestamp)}
                            </div>
                          </div>
                          {(!notif.isRead && !notif.is_read) && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-2"></div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-3 border-t bg-gray-50">
                    <button
                      onClick={() => navigate('/notifications')}
                      className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View all notifications →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Profile Icon */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationsOpen(false);
              }}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <User size={20} />
            </button>
            
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border z-50">
                <div className="p-4 border-b">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {userData.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{userData.name}</div>
                      <div className="text-sm text-gray-600">{userData.email}</div>
                      <div className="text-xs text-gray-500 mt-1">🔐 {userData.accountType}</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-2">
                  <button 
                    onClick={handleSettings}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 mt-1"
                  >
                    <Settings size={18} />
                    <span className="text-sm">Settings</span>
                  </button>
                  
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-red-600 mt-1"
                  >
                    <LogOut size={18} />
                    <span className="text-sm">Sign Out</span>
                  </button> 
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}