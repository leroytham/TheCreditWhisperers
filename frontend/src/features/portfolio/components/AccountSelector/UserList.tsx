import React, { useState, useEffect } from 'react';
import apiService from '../../../../services/api';

// Type definitions
interface User {
  username: string;
  displayName?: string;
  accountCount?: number;
  type?: string;
}

interface UserListProps {
  selectedUser: User | null;
  onUserSelect: (user: User) => void;
}

type GroupedUsers = Record<string, User[]>;

/**
 * UserList Component
 *
 * Displays a collapsible list of users grouped by type (Individual/Institutional).
 * Fetches users from API with fallback to mock data for development.
 */
const UserList: React.FC<UserListProps> = ({ selectedUser, onUserSelect }) => {
  const [users, setUsers] = useState<GroupedUsers>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getUsers();
      const data = response.data as { users?: User[] };

      // Group users by type (individual vs institutional)
      const grouped = groupUsersByType(data.users || []);
      setUsers(grouped);

      // Expand all groups by default
      const defaultExpanded: Record<string, boolean> = {};
      Object.keys(grouped).forEach(key => {
        defaultExpanded[key] = true;
      });
      setExpandedGroups(defaultExpanded);
    } catch (err) {
      // Error already handled by apiService interceptor
      setError('Failed to load users');
      // Fallback to mock data for development
      const mockUsers = getMockUsers();
      setUsers(mockUsers);
      setExpandedGroups({ 'Individual Clients': true, 'Institutional Clients': true });
    } finally {
      setLoading(false);
    }
  };

  const groupUsersByType = (usersList: User[]): GroupedUsers => {
    const grouped: GroupedUsers = {
      'Individual Clients': [],
      'Institutional Clients': []
    };

    usersList.forEach((user: User) => {
      if (user.type === 'institutional' || user.username?.includes('fund')) {
        grouped['Institutional Clients'].push(user);
      } else {
        grouped['Individual Clients'].push(user);
      }
    });

    // Remove empty groups
    Object.keys(grouped).forEach(key => {
      if (grouped[key].length === 0) {
        delete grouped[key];
      }
    });

    return grouped;
  };

  const getMockUsers = (): GroupedUsers => {
    return {
      'Individual Clients': [
        { username: 'john_doe', displayName: 'John Doe', accountCount: 2 },
        { username: 'jane_smith', displayName: 'Jane Smith', accountCount: 3 },
        { username: 'robert_jones', displayName: 'Robert Jones', accountCount: 1 },
        { username: 'mary_johnson', displayName: 'Mary Johnson', accountCount: 2 },
      ],
      'Institutional Clients': [
        { username: 'pension_fund_a', displayName: 'Pension Fund A', accountCount: 5 },
        { username: 'hedge_fund_x', displayName: 'Hedge Fund X', accountCount: 4 },
        { username: 'mutual_fund_b', displayName: 'Mutual Fund B', accountCount: 3 },
      ]
    };
  };

  const toggleGroup = (groupName: string): void => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error && Object.keys(users).length === 0) {
    return (
      <div className="text-center py-4 px-2">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchUsers}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="py-2">
        {Object.entries(users).map(([groupName, groupUsers]) => (
          <div key={groupName} className="mb-2">
            <button
              onClick={() => toggleGroup(groupName)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <span>{groupName}</span>
              <div className="flex items-center">
                <span className="mr-2 text-xs text-gray-500">
                  ({groupUsers.length})
                </span>
                <span className="text-sm">{expandedGroups[groupName] ? '▼' : '▶'}</span>
              </div>
            </button>

            {expandedGroups[groupName] && (
              <div className="mt-1">
                {groupUsers.map((user) => (
                  <button
                    key={user.username}
                    onClick={() => onUserSelect(user)}
                    className={`w-full text-left px-6 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      selectedUser?.username === user.username
                        ? 'bg-gray-100 font-medium text-gray-900'
                        : 'text-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{user.displayName || user.username}</span>
                      {user.accountCount && (
                        <span className="text-xs text-gray-500">
                          {user.accountCount} {user.accountCount === 1 ? 'account' : 'accounts'}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;