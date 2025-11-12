import React, { useState } from 'react';
import { Bell, TrendingUp, TrendingDown, Percent, Trash2, CheckCircle, XCircle, DollarSign, Brain, Sparkles, TrendingUpDown } from 'lucide-react';
import { usePriceAlerts, useSentimentAlerts } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

/**
 * UnifiedAlertList - Display and manage both price and sentiment alerts
 *
 * Shows all alerts with options to:
 * - Filter by alert type (price/sentiment) and status
 * - View alert details
 * - Delete alerts
 * - Toggle active status
 * - View triggered alerts
 */
const UnifiedAlertList = ({ onCreateNew }) => {
  const { alerts: priceAlerts, isLoading: isLoadingPrice, deleteAlert: deletePriceAlert, updateAlert: updatePriceAlert, isDeleting: isDeletingPrice, isUpdating: isUpdatingPrice } = usePriceAlerts();
  const { alerts: sentimentAlerts, isLoading: isLoadingSentiment, deleteAlert: deleteSentimentAlert, updateAlert: updateSentimentAlert, isDeleting: isDeletingSentiment, isUpdating: isUpdatingSentiment } = useSentimentAlerts();

  const [alertTypeFilter, setAlertTypeFilter] = useState('all'); // 'all' | 'price' | 'sentiment'
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'triggered' | 'all'

  const isLoading = isLoadingPrice || isLoadingSentiment;
  const isDeleting = isDeletingPrice || isDeletingSentiment;
  const isUpdating = isUpdatingPrice || isUpdatingSentiment;

  // Combine alerts with type identifier
  const allAlerts = [
    ...priceAlerts.map(alert => ({ ...alert, alertType: 'price' })),
    ...sentimentAlerts.map(alert => ({ ...alert, alertType: 'sentiment' }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Filter alerts based on selected filters
  const filteredAlerts = allAlerts.filter((alert) => {
    // Filter by alert type
    if (alertTypeFilter !== 'all' && alert.alertType !== alertTypeFilter) {
      return false;
    }

    // Filter by status
    if (statusFilter === 'active') {
      return alert.is_active && !alert.triggered;
    } else if (statusFilter === 'triggered') {
      return alert.triggered;
    }
    return true; // 'all'
  });

  // Get icon for price condition
  const getPriceConditionIcon = (condition) => {
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
        return <DollarSign className="h-4 w-4" />;
    }
  };

  // Get icon for sentiment condition
  const getSentimentConditionIcon = (condition) => {
    switch (condition) {
      case 'becomes_bullish':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'becomes_bearish':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'becomes_neutral':
        return <TrendingUpDown className="h-4 w-4 text-gray-600" />;
      case 'crosses_above':
      case 'crosses_below':
        return <Sparkles className="h-4 w-4 text-blue-600" />;
      case 'momentum_positive':
      case 'momentum_negative':
        return <TrendingUpDown className="h-4 w-4 text-purple-600" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  // Get readable condition label for price alert
  const getPriceConditionLabel = (alert) => {
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

  // Get readable condition label for sentiment alert
  const getSentimentConditionLabel = (alert) => {
    switch (alert.condition) {
      case 'becomes_bullish':
        return 'Becomes Bullish (≥ 0.35)';
      case 'becomes_bearish':
        return 'Becomes Bearish (≤ -0.35)';
      case 'becomes_neutral':
        return 'Becomes Neutral (-0.15 to 0.15)';
      case 'crosses_above':
        return `Crosses Above ${alert.threshold}`;
      case 'crosses_below':
        return `Crosses Below ${alert.threshold}`;
      case 'momentum_positive':
        return `Positive Momentum (> ${alert.momentum_threshold || 0})`;
      case 'momentum_negative':
        return `Negative Momentum (< ${alert.momentum_threshold || 0})`;
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

  // Get alert type badge
  const getAlertTypeBadge = (alertType) => {
    if (alertType === 'price') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          <DollarSign className="h-3 w-3 mr-1" />
          Price
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
          <Brain className="h-3 w-3 mr-1" />
          Sentiment
        </span>
      );
    }
  };

  // Handle delete alert
  const handleDelete = async (alert) => {
    const alertTypeName = alert.alertType === 'price' ? 'price' : 'sentiment';
    if (window.confirm(`Are you sure you want to delete this ${alertTypeName} alert?`)) {
      if (alert.alertType === 'price') {
        await deletePriceAlert(alert.id);
      } else {
        await deleteSentimentAlert(alert.id);
      }
    }
  };

  // Handle toggle active status
  const handleToggleActive = async (alert) => {
    if (alert.alertType === 'price') {
      await updatePriceAlert({
        alertId: alert.id,
        updates: { is_active: !alert.is_active },
      });
    } else {
      await updateSentimentAlert({
        alertId: alert.id,
        updates: { is_active: !alert.is_active },
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="space-y-3">
        {/* Alert Type Filter */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { value: 'all', label: 'All Alerts', count: allAlerts.length },
              { value: 'price', label: 'Price', count: priceAlerts.length },
              { value: 'sentiment', label: 'Sentiment', count: sentimentAlerts.length },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setAlertTypeFilter(tab.value)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  alertTypeFilter === tab.value
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

        {/* Status Filter */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[
            { value: 'active', label: 'Active', count: allAlerts.filter(a => a.is_active && !a.triggered).length },
            { value: 'triggered', label: 'Triggered', count: allAlerts.filter(a => a.triggered).length },
            { value: 'all', label: 'All Status', count: allAlerts.length },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {statusFilter === 'active' && 'No active alerts'}
            {statusFilter === 'triggered' && 'No triggered alerts'}
            {statusFilter === 'all' && 'No alerts yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {statusFilter === 'active' && 'Create an alert to get notified when conditions are met'}
            {statusFilter === 'triggered' && 'Triggered alerts will appear here'}
            {statusFilter === 'all' && 'Get started by creating your first alert'}
          </p>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Alert
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={`${alert.alertType}-${alert.id}`}
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
                  <div className="flex items-center space-x-3 mb-2 flex-wrap gap-y-2">
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

                    {/* Alert Type Badge */}
                    {getAlertTypeBadge(alert.alertType)}

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
                    {alert.alertType === 'price'
                      ? getPriceConditionIcon(alert.condition)
                      : getSentimentConditionIcon(alert.condition)
                    }
                    <span className="text-sm font-medium text-gray-700">
                      {alert.alertType === 'price'
                        ? getPriceConditionLabel(alert)
                        : getSentimentConditionLabel(alert)
                      }
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
                        <strong>Triggered:</strong> {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                        {alert.alertType === 'price' && alert.triggered_price && ` at $${alert.triggered_price.toFixed(2)}`}
                        {alert.alertType === 'sentiment' && alert.triggered_sentiment !== undefined && ` at sentiment ${alert.triggered_sentiment.toFixed(2)}`}
                      </p>
                    </div>
                  )}

                  {/* Last checked (sentiment only) */}
                  {alert.alertType === 'sentiment' && alert.last_checked_at && alert.last_sentiment_score !== null && (
                    <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-800">
                        <strong>Last Check:</strong> Sentiment {alert.last_sentiment_score.toFixed(2)}
                        {alert.last_momentum !== null && `, Momentum ${alert.last_momentum.toFixed(2)}`}
                        {' '}({formatDistanceToNow(new Date(alert.last_checked_at), { addSuffix: true })})
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
                    onClick={() => handleDelete(alert)}
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
          Showing {filteredAlerts.length} of {allAlerts.length} alert{allAlerts.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default UnifiedAlertList;
