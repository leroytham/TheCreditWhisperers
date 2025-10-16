import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

/**
 * EditPortfolioModal Component
 *
 * Multi-step modal for editing an existing portfolio
 */
const EditPortfolioModal = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [accountDetails, setAccountDetails] = useState({
    accountName: '',
    accountNumber: '',
    primaryOwner: '',
    shortName: '',
    accountStatus: 'Active',
    ownershipType: '',
    openDate: '',
  });
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [holdings, setHoldings] = useState([]);

  // Pre-fill with existing data when modal opens
  useEffect(() => {
    if (isOpen) {
      setAccountDetails({
        accountName: 'Jane Johnson - RMA',
        accountNumber: 'MX555911',
        primaryOwner: 'Jane Johnson',
        shortName: 'Jane RMA',
        accountStatus: 'Active',
        ownershipType: 'Sole Owner',
        openDate: '2005-06-27',
      });
      setBeneficiaries([
        { name: 'Lisa Houlihan', percentage: '50' },
        { name: 'Mark Harmon', percentage: '50' },
      ]);
      setHoldings([
        { symbol: 'AMZN', quantity: '35.445', purchaseDate: '2022-01-15', purchasePrice: '150.75' },
        { symbol: 'AAPL', quantity: '24.676', purchaseDate: '2021-11-20', purchasePrice: '130.40' },
      ]);
    }
  }, [isOpen]);

  const handleClose = () => {
    setCurrentStep(1);
    onClose();
  };

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, { name: '', percentage: '' }]);
  };

  const removeBeneficiary = (index) => {
    setBeneficiaries(beneficiaries.filter((_, i) => i !== index));
  };

  const updateBeneficiary = (index, field, value) => {
    const updated = [...beneficiaries];
    updated[index][field] = value;
    setBeneficiaries(updated);
  };

  const addHolding = () => {
    setHoldings([...holdings, { symbol: '', quantity: '', purchaseDate: '', purchasePrice: '' }]);
  };

  const removeHolding = (index) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const updateHolding = (index, field, value) => {
    const updated = [...holdings];
    updated[index][field] = value;
    setHoldings(updated);
  };

  const handleSave = () => {
    console.log('Portfolio changes saved!', { accountDetails, beneficiaries, holdings });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="relative mx-auto p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">Edit Portfolio</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div>
          {/* Step 1: Account Details */}
          {currentStep === 1 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                Step 1: Account Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div>
                  <label className="text-gray-500">Account Name</label>
                  <input
                    type="text"
                    value={accountDetails.accountName}
                    onChange={(e) =>
                      setAccountDetails({ ...accountDetails, accountName: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-500">Account #</label>
                  <input
                    type="text"
                    value={accountDetails.accountNumber}
                    onChange={(e) =>
                      setAccountDetails({ ...accountDetails, accountNumber: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-500">Primary Account Owner</label>
                  <input
                    type="text"
                    value={accountDetails.primaryOwner}
                    onChange={(e) =>
                      setAccountDetails({ ...accountDetails, primaryOwner: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-500">Short Name</label>
                  <input
                    type="text"
                    value={accountDetails.shortName}
                    onChange={(e) =>
                      setAccountDetails({ ...accountDetails, shortName: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-500">Account Status</label>
                  <select
                    value={accountDetails.accountStatus}
                    onChange={(e) =>
                      setAccountDetails({ ...accountDetails, accountStatus: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-500">Ownership Type</label>
                  <input
                    type="text"
                    value={accountDetails.ownershipType}
                    onChange={(e) =>
                      setAccountDetails({ ...accountDetails, ownershipType: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-500">Open Date</label>
                  <input
                    type="date"
                    value={accountDetails.openDate}
                    onChange={(e) =>
                      setAccountDetails({ ...accountDetails, openDate: e.target.value })
                    }
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
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-800 hover:bg-gray-900"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Beneficiaries */}
          {currentStep === 2 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                Step 2: Edit Beneficiaries
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 font-semibold">
                      <th className="py-2 font-medium w-3/5">Beneficiary Name</th>
                      <th className="py-2 font-medium w-2/5">Percentage (%)</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiaries.map((ben, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            placeholder="e.g., John Doe"
                            value={ben.name}
                            onChange={(e) => updateBeneficiary(index, 'name', e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            placeholder="e.g., 50"
                            value={ben.percentage}
                            onChange={(e) =>
                              updateBeneficiary(index, 'percentage', e.target.value)
                            }
                            className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 pl-2 text-right">
                          <button
                            onClick={() => removeBeneficiary(index)}
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
                onClick={addBeneficiary}
                className="mt-4 px-3 py-1.5 border border-dashed border-gray-400 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Beneficiary</span>
              </button>

              <div className="mt-6 pt-4 border-t text-right space-x-2">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-800 hover:bg-gray-900"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Holdings */}
          {currentStep === 3 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                Step 3: Edit Holdings
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 font-semibold">
                      <th className="py-2 font-medium">Symbol</th>
                      <th className="py-2 font-medium">Quantity</th>
                      <th className="py-2 font-medium">Purchase Date</th>
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
                            type="date"
                            value={holding.purchaseDate}
                            onChange={(e) => updateHolding(index, 'purchaseDate', e.target.value)}
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
                <span>Add Lot</span>
              </button>

              <div className="mt-6 pt-4 border-t text-right space-x-2">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditPortfolioModal;
