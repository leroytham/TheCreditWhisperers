import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { X, Plus, Trash2 } from 'lucide-react';
import apiService from '../../../../services/api';
import { useUser } from '../../../../hooks/useUser';
import useAppStore from '../../../../store/useAppStore';
import {
  accountDetailsSchema,
  portfolioCreateSchema,
  validateForm as zodValidate,
  getFirstError,
} from '../../../../schemas/portfolio';

/**
 * AddPortfolioModal Component
 *
 * Multi-step modal for creating a new portfolio (1 account + multiple holdings)
 */
const AddPortfolioModal = ({ isOpen, onClose }) => {
  const { username } = useUser();
  const notifyWarning = useAppStore((state) => state.notifyWarning);
  const notifySuccess = useAppStore((state) => state.notifySuccess);
  const notifyError = useAppStore((state) => state.notifyError);
  const [currentStep, setCurrentStep] = useState(1);
  const [accountDetails, setAccountDetails] = useState({
    accountName: '',
    accountNumber: '',
    openDate: '',
  });
  const [holdings, setHoldings] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    setCurrentStep(1);
    setAccountDetails({ accountName: '', accountNumber: '', openDate: '' });
    setHoldings([]);
    onClose();
  };

  const updateAccount = (field, value) => {
    setAccountDetails({ ...accountDetails, [field]: value });
  };

  const addHolding = () => {
    setHoldings([...holdings, { symbol: '', quantity: '', purchasePrice: '', purchaseDate: '' }]);
  };

  const removeHolding = (index) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const updateHolding = (index, field, value) => {
    const updated = [...holdings];
    
    // Handle numeric fields
    if (field === 'quantity' || field === 'purchasePrice') {
      // Allow empty string for editing, but store as string for input control
      updated[index][field] = value;
    } else {
      // For symbol field, convert to uppercase
      updated[index][field] = field === 'symbol' ? value.toUpperCase() : value;
    }
    
    setHoldings(updated);
  };

  /**
   * Validate step 1 (account details) using Zod schema.
   */
  const validateAccountDetails = () => {
    const result = zodValidate(accountDetailsSchema, accountDetails);
    if (!result.success) {
      notifyWarning(getFirstError(result.errors));
      return false;
    }
    return true;
  };

  /**
   * Validate the full form (account + holdings) using Zod schema.
   */
  const validateForm = () => {
    const result = zodValidate(portfolioCreateSchema, { accountDetails, holdings });
    if (!result.success) {
      notifyWarning(getFirstError(result.errors));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (!username) {
      notifyWarning('User not logged in. Please log in again.');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        username,
        accountDetails,
        holdings: holdings.map((holding) => ({
          ...holding,
          quantity: parseFloat(holding.quantity),
          purchasePrice: parseFloat(holding.purchasePrice),
        })),
      };

      await apiService.addPortfolio(payload);
      notifySuccess('Portfolio saved successfully!');
      handleClose();
    } catch (error) {
      // Error handled by apiService interceptor
      if (error.name !== 'AbortError' && !apiService.api?.isCancel?.(error)) {
        notifyError('Error saving portfolio: ' + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-portfolio-title"
    >
      <div
        className="relative mx-auto p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <h3 id="add-portfolio-title" className="text-2xl font-semibold text-gray-900">Add New Portfolio</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close add portfolio modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Step 1: Account Details */}
        {currentStep === 1 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
              Step 1: Account Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <label htmlFor="add-account-name" className="text-gray-500">Account Name *</label>
                <input
                  id="add-account-name"
                  type="text"
                  value={accountDetails.accountName}
                  onChange={(e) => updateAccount('accountName', e.target.value)}
                  placeholder="e.g., ABC Portfolio"
                  required
                  aria-required="true"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="add-account-number" className="text-gray-500">Account # *</label>
                <input
                  id="add-account-number"
                  type="text"
                  value={accountDetails.accountNumber}
                  onChange={(e) => updateAccount('accountNumber', e.target.value)}
                  placeholder="e.g., 123456"
                  required
                  aria-required="true"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="add-open-date" className="text-gray-500">Open Date *</label>
                <input
                  id="add-open-date"
                  type="date"
                  value={accountDetails.openDate}
                  onChange={(e) => updateAccount('openDate', e.target.value)}
                  required
                  aria-required="true"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t text-right space-x-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!validateAccountDetails()) {
                    return;
                  }
                  setCurrentStep(2);
                  if (holdings.length === 0) addHolding();
                }}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-800 hover:bg-gray-900"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Holdings */}
        {currentStep === 2 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
              Step 2: Add Holdings
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 font-semibold">
                    <th className="py-2 font-medium">Symbol</th>
                    <th className="py-2 font-medium">Quantity</th>
                    <th className="py-2 font-medium">Purchase Price ($)</th>
                    <th className="py-2 font-medium">Purchase Date</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          placeholder="e.g., AAPL"
                          value={holding.symbol}
                          onChange={(e) => updateHolding(index, 'symbol', e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          placeholder="e.g., 100"
                          value={holding.quantity}
                          onChange={(e) => updateHolding(index, 'quantity', e.target.value)}
                          min="0"
                          step="1"
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          placeholder="e.g., 150.25"
                          value={holding.purchasePrice}
                          onChange={(e) => updateHolding(index, 'purchasePrice', e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="date"
                          value={holding.purchaseDate}
                          onChange={(e) => updateHolding(index, 'purchaseDate', e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <button
                          onClick={() => removeHolding(index)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`Remove holding ${holding.symbol || index + 1}`}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={addHolding}
              className="mt-4 px-3 py-1.5 border border-dashed border-gray-400 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Stock</span>
            </button>

            <div className="mt-6 pt-4 border-t text-right space-x-2">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white ${
                  isSaving 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save Portfolio'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

AddPortfolioModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AddPortfolioModal;
