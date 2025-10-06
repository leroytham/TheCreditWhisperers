import React, { useState, useEffect } from 'react';
import { Bell, User, LogOut, Settings } from 'lucide-react';

export default function Header() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  
  const [userData, setUserData] = useState({
    name: "Loading...",
    email: "",
    accountType: "Microsoft Account",
    avatar: "?"
  });

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
  
  const notifications = [
    { id: 1, title: "Monthly Report Ready", message: "Your September financial report is ready", time: "2 hours ago", unread: true },
    { id: 2, title: "Budget Alert", message: "Marketing budget at 85%", time: "5 hours ago", unread: true },
    { id: 3, title: "New Transaction", message: "Payment received: $5,420", time: "1 day ago", unread: false }
  ];
  
  const unreadCount = notifications.filter(n => n.unread).length;

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
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${notif.unread ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{notif.title}</div>
                          <div className="text-sm text-gray-600 mt-1">{notif.message}</div>
                          <div className="text-xs text-gray-500 mt-1">{notif.time}</div>
                        </div>
                        {notif.unread && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-2"></div>}
                      </div>
                    </div>
                  ))}
                </div>
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
                  
                  <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-red-600 mt-1">
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