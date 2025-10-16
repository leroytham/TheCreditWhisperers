import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, LogOut } from 'lucide-react';

/**
 * SectorHeader component - top navigation bar with tabs and user controls
 */
const SectorHeader = ({ onLogout }) => {
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Navigation tabs */}
        <div className="flex items-center space-x-4">
          <nav className="flex space-x-8">
            <button className="text-gray-900 font-semibold border-b-2 border-blue-500 pb-2">
              SECTOR
            </button>
            <button
              className="text-gray-600 hover:text-gray-900"
              onClick={() => navigate("/financial_dashboard")}
            >
              ENTITY
            </button>
          </nav>
        </div>

        {/* Right: Icons */}
        <div className="flex items-center space-x-4">
          <Bell className="w-6 h-6 text-gray-600" />
          <User className="w-6 h-6 text-gray-600" />
          <button onClick={onLogout}>
            <LogOut className="w-6 h-6 text-gray-600 hover:text-gray-600 transition" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default SectorHeader;
