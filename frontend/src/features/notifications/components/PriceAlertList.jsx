import React, { useState } from 'react';
import { Bell, TrendingUp, TrendingDown, Percent, Trash2, Edit, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { usePriceAlerts } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

/**
 * PriceAlertList - Display and manage price alerts
 *
 * Shows all price alerts with options to:
 * - View alert details
 * - Edit alerts
 * - Delete alerts
 * - Toggle active status
 * - View triggered alerts
 */
const PriceAlertList = ({ onCreateNew }) => {
  const { alerts, totalCount, isLoading, deleteAlert, updateAlert, isDeleting, isUpdating } = usePriceAlerts();
  const [filter, setFilter] = useState('active'); // 'active' | 'triggered' | 'all'

  // Filter alerts based on selected filter
  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'active') {
      return alert.is_active && !alert.triggered;
    } else if (filter === 'triggered') {
      return alert.triggered;
    }
    return true; // 'all'
  });

  // Get icon for condition type
  const getConditionIcon = (condition) => {
    switch (condition) {
      case 'above':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'below':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'percent_increase':
        return <Percent className="h-4 w-4 text-green-600" />;
      case 'percent_decrease':
        return <Percent className="h-4 w-4 text-red-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  // Get readable condition label
  const getConditionLabel = (alert) => {
    switch (alert.condition) {
      case 'above':
        return `Above $${alert.target_price}`;
      case 'below':
        return `Below $${alert.target_price}`;
      case 'percent_increase':
        return `+${alert.percent_change}% from $${alert.base_price}`;
      case 'percent_decrease':
        return `-${alert.percent_change}% from $${alert.base_price}`;
      default:
        return 'Unknown condition';
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle delete alert
  const handleDelete = async (alertId) => {
    if (window.confirm('Are you sure you want to delete this price alert?')) {
      await deleteAlert(alertId);
    }
  };

  // Handle toggle active status
  const handleToggleActive = async (alert) => {
    await updateAlert({
      alertId: alert.id,
      updates: { is_active: !alert.is_active },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading price alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { value: 'active', label: 'Active', count: alerts.filter(a => a.is_active && !a.triggered).length },
            { value: 'triggered', label: 'Triggered', count: alerts.filter(a => a.triggered).length },
            { value: 'all', label: 'All', count: alerts.length },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs">({tab.count})</span>
            </button>
          ))}
        </div>

        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Alert
          </button>
        )}
      </div>

      {/* Alert list */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'active' && 'No active alerts'}
            {filter === 'triggered' && 'No triggered alerts'}
            {filter === 'all' && 'No price alerts yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {filter === 'active' && 'Create a price alert to get notified when conditions are met'}
            {filter === 'triggered' && 'Triggered alerts will appear here'}
            {filter === 'all' && 'Get started by creating your first price alert'}
          </p>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Price Alert
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-lg border-2 p-4 transition-all ${
                alert.triggered
                  ? 'border-green-200 bg-green-50'
                  : alert.is_active
                  ? 'border-gray-200 hover:border-gray-300'
                  : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Left: Alert details */}
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {/* Status indicator */}
                    {alert.triggered ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : alert.is_active ? (
                      <Bell className="h-5 w-5 text-blue-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}

                    {/* Ticker */}
                    <span className="text-lg font-bold text-gray-900">{alert.ticker}</span>

                    {/* Priority badge */}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(alert.priority)}`}>
                      {alert.priority}
                    </span>

                    {/* Status badge */}
                    {alert.triggered && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Triggered
                      </span>
                    )}
                    {!alert.is_active && !alert.triggered && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Condition */}
                  <div className="flex items-center space-x-2 mb-2">
                    {getConditionIcon(alert.condition)}
                    <span className="text-sm font-medium text-gray-700">
                      {getConditionLabel(alert)}
                    </span>
                  </div>

                  {/* Notes */}
                  {alert.notes && (
                    <p className="text-sm text-gray-600 mb-2">{alert.notes}</p>
                  )}

                  {/* Portfolio info */}
                  {alert.portfolio_name && (
                    <p className="text-xs text-gray-500">
                      Portfolio: {alert.portfolio_name}
                    </p>
                  )}

                  {/* Triggered info */}
                  {alert.triggered && alert.triggered_at && (
                    <div className="mt-2 p-2 bg-green-100 rounded border border-green-200">
                      <p className="text-xs text-green-800">
                        <strong>Triggered:</strong> {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })} at ${alert.triggered_price?.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {/* Created date */}
                  <p className="text-xs text-gray-400 mt-2">
                    Created {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </p>
                </div>

                {/* Right: Action buttons */}
                <div className="flex flex-col space-y-2 ml-4">
                  {/* Toggle active */}
                  {!alert.triggered && (
                    <button
                      onClick={() => handleToggleActive(alert)}
                      disabled={isUpdating}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        alert.is_active
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                      title={alert.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {alert.is_active ? 'Pause' : 'Resume'}
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(alert.id)}
                    disabled={isDeleting}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete alert"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary footer */}
      {filteredAlerts.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Showing {filteredAlerts.length} of {totalCount} price alert{totalCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default PriceAlertList;
