import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

/**
 * AddPortfolioModal Component
 *
 * Multi-step modal for creating a new portfolio (1 account + multiple holdings)
 */
const AddPortfolioModal = ({ isOpen, onClose }) => {
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
    setHoldings([...holdings, { symbol: '', quantity: '', purchasePrice: '' }]);
  };

  const removeHolding = (index) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const updateHolding = (index, field, value) => {
    const updated = [...holdings];
    updated[index][field] = value;
    setHoldings(updated);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Get username from session
      const username = sessionStorage.getItem('user');
      if (!username) {
        alert('User not logged in. Please log in again.');
        setIsSaving(false);
        return;
      }

      const payload = {
        username,
        accountDetails,
        holdings,
      };

      console.log('🔹 Sending payload:', payload);

      const response = await fetch('http://localhost:8000/api/portfolio/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save portfolio');
      }

      const result = await response.json();
      console.log('Portfolio saved:', result);
      alert('Portfolio saved successfully!');
      handleClose();
    } catch (error) {
      console.error(' Error saving portfolio:', error);
      alert('Error saving portfolio: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="relative mx-auto p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">Add New Portfolio</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
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
                <label className="text-gray-500">Account Name</label>
                <input
                  type="text"
                  value={accountDetails.accountName}
                  onChange={(e) => updateAccount('accountName', e.target.value)}
                  placeholder="e.g., ABC Portfolio"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-gray-500">Account #</label>
                <input
                  type="text"
                  value={accountDetails.accountNumber}
                  onChange={(e) => updateAccount('accountNumber', e.target.value)}
                  placeholder="e.g., 123456"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-gray-500">Open Date</label>
                <input
                  type="date"
                  value={accountDetails.openDate}
                  onChange={(e) => updateAccount('openDate', e.target.value)}
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
                    <th className="py-2 font-medium"></th>
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
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          placeholder="e.g., 150.25"
                          value={holding.purchasePrice}
                          onChange={(e) => updateHolding(index, 'purchasePrice', e.target.value)}
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <button
                          onClick={() => removeHolding(index)}
                          className="text-gray-400 hover:text-red-500"
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
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Save Portfolio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddPortfolioModal;
