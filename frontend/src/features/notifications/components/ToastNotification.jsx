import React, { useEffect, useState } from 'react';

/**
 * ToastNotification Component
 *
 * Floating toast notification that appears in the top-right corner
 */
const ToastNotification = ({ notification, onRemind, onAcknowledge }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      // Slide in after a brief delay
      setTimeout(() => setIsVisible(true), 100);
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

  return (
    <div
      className={`fixed top-20 right-8 w-full max-w-sm bg-white shadow-lg rounded-lg pointer-events-auto border border-gray-200 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="p-4">
        <div className="flex flex-col">
          <div className="flex items-center mb-2">
            {/* UBS Logo SVG */}
            <svg
              className="h-6 w-6 text-red-600 mr-2"
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
            <p className="text-sm font-semibold text-gray-900">Critical Notification</p>
          </div>
          <p className="text-sm text-gray-700 ml-8">{notification.message}</p>
          <div className="mt-4 flex justify-end space-x-4">
            <button
              onClick={handleRemind}
              className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
            >
              REMIND ME LATER
            </button>
            <button
              onClick={handleAcknowledge}
              className="px-3 py-1 border border-gray-400 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToastNotification;
