import React, { useState } from 'react';
import { X, Bell, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { usePriceAlerts } from '../hooks/useNotifications';

/**
 * PriceAlertModal - Modal for creating price alerts
 *
 * Allows users to set custom price alerts with conditions like:
 * - Price above/below a threshold
 * - Percentage increase/decrease
 */
const PriceAlertModal = ({ ticker = '', onClose, onSuccess }) => {
  const { createAlert, isCreating } = usePriceAlerts();

  const [formData, setFormData] = useState({
    ticker: ticker.toUpperCase(),
    condition: 'above',
    target_price: '',
    base_price: '',
    percent_change: '',
    priority: 'medium',
    notification_title: '',
    notification_message: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.ticker || formData.ticker.length === 0) {
      newErrors.ticker = 'Ticker is required';
    }

    if (formData.condition === 'above' || formData.condition === 'below') {
      if (!formData.target_price || parseFloat(formData.target_price) <= 0) {
        newErrors.target_price = 'Valid target price is required';
      }
    }

    if (formData.condition === 'percent_increase' || formData.condition === 'percent_decrease') {
      if (!formData.base_price || parseFloat(formData.base_price) <= 0) {
        newErrors.base_price = 'Valid base price is required';
      }
      if (!formData.percent_change || parseFloat(formData.percent_change) <= 0) {
        newErrors.percent_change = 'Valid percentage is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const alertData = {
        ticker: formData.ticker.toUpperCase(),
        condition: formData.condition,
        priority: formData.priority,
        notes: formData.notes,
      };

      // Add condition-specific fields
      if (formData.condition === 'above' || formData.condition === 'below') {
        alertData.target_price = parseFloat(formData.target_price);
      }

      if (formData.condition === 'percent_increase' || formData.condition === 'percent_decrease') {
        alertData.base_price = parseFloat(formData.base_price);
        alertData.percent_change = parseFloat(formData.percent_change);
      }

      // Add custom messages if provided
      if (formData.notification_title) {
        alertData.notification_title = formData.notification_title;
      }
      if (formData.notification_message) {
        alertData.notification_message = formData.notification_message;
      }

      await createAlert(alertData);

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error('Failed to create price alert:', error);
      setErrors({ submit: 'Failed to create alert. Please try again.' });
    }
  };

  // Get icon for condition
  const getConditionIcon = (condition) => {
    switch (condition) {
      case 'above':
        return <TrendingUp className="h-4 w-4" />;
      case 'below':
        return <TrendingDown className="h-4 w-4" />;
      case 'percent_increase':
        return <Percent className="h-4 w-4 text-green-600" />;
      case 'percent_decrease':
        return <Percent className="h-4 w-4 text-red-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Price Alert</h2>
              <p className="text-sm text-gray-500">Get notified when price conditions are met</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          </div>

          {/* Form */}
          <form id="price-alert-form" onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Ticker Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock Ticker <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="ticker"
              value={formData.ticker}
              onChange={handleChange}
              placeholder="e.g., AAPL"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.ticker ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.ticker && (
              <p className="mt-1 text-sm text-red-600">{errors.ticker}</p>
            )}
          </div>

          {/* Condition Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alert Condition <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'above', label: 'Price Above', icon: 'trending-up' },
                { value: 'below', label: 'Price Below', icon: 'trending-down' },
                { value: 'percent_increase', label: '% Increase', icon: 'percent-up' },
                { value: 'percent_decrease', label: '% Decrease', icon: 'percent-down' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange({ target: { name: 'condition', value: option.value } })}
                  className={`p-4 border-2 rounded-lg flex items-center space-x-3 transition-all ${
                    formData.condition === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {getConditionIcon(option.value)}
                  <span className="font-medium text-gray-900">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Inputs (conditional based on condition type) */}
          {(formData.condition === 'above' || formData.condition === 'below') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  name="target_price"
                  value={formData.target_price}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.target_price ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.target_price && (
                <p className="mt-1 text-sm text-red-600">{errors.target_price}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Alert when {formData.ticker || 'stock'} goes {formData.condition} ${formData.target_price || '0.00'}
              </p>
            </div>
          )}

          {(formData.condition === 'percent_increase' || formData.condition === 'percent_decrease') && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    name="base_price"
                    value={formData.base_price}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.base_price ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.base_price && (
                  <p className="mt-1 text-sm text-red-600">{errors.base_price}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Percentage Change <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    name="percent_change"
                    value={formData.percent_change}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.percent_change ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.percent_change && (
                  <p className="mt-1 text-sm text-red-600">{errors.percent_change}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Alert when {formData.ticker || 'stock'} {formData.condition === 'percent_increase' ? 'increases' : 'decreases'} by {formData.percent_change || '0'}% from ${formData.base_price || '0.00'}
                </p>
              </div>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Optional: Custom Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Title (Optional)
            </label>
            <input
              type="text"
              name="notification_title"
              value={formData.notification_title}
              onChange={handleChange}
              placeholder="e.g., AAPL Breakout Alert"
              maxLength={200}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Optional: Custom Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              name="notification_message"
              value={formData.notification_message}
              onChange={handleChange}
              placeholder="e.g., Time to review my position"
              maxLength={1000}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Optional: Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Personal notes about this alert"
              maxLength={500}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create Alert'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PriceAlertModal;
