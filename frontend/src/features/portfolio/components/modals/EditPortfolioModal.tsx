import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useSelectedAccount } from '../../../../hooks/useSelectedAccount';
import apiService from '../../../../services/api';
import useAppStore from '../../../../store/useAppStore';
import LoadingSpinner from '../../../../components/LoadingSpinner';

// Type definitions
interface EditPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AccountDetails {
  accountName: string;
  accountNumber: string;
  openDate: string;
}

interface HoldingInput {
  symbol: string;
  quantity: string;
  purchasePrice: string;
  purchaseDate: string;
}

interface HoldingResponse {
  symbol?: string;
  quantity?: number;
  purchase_price?: number;
  purchase_date?: string;
}

interface PortfolioResponse {
  account?: {
    client_account_name?: string;
    account_no?: string;
    open_date?: string;
  };
  holdings?: HoldingResponse[];
}

/**
 * EditPortfolioModal Component
 *
 * Dynamically loads and edits an existing portfolio (account + holdings)
 */
const EditPortfolioModal: React.FC<EditPortfolioModalProps> = ({ isOpen, onClose }) => {
  const { selectedAccount } = useSelectedAccount();
  const { notifyError, notifyWarning } = useAppStore();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [accountDetails, setAccountDetails] = useState<AccountDetails>({
    accountName: '',
    accountNumber: '',
    openDate: '',
  });
  const [holdings, setHoldings] = useState<HoldingInput[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const updateAccountDetails = (field: keyof AccountDetails, value: string): void => {
    setAccountDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!accountDetails.accountName.trim()) {
      notifyWarning('Please enter an account name.', { category: 'Portfolio' });
      return false;
    }
    if (!accountDetails.accountNumber.trim()) {
      notifyWarning('Please enter an account number.', { category: 'Portfolio' });
      return false;
    }
    if (!accountDetails.openDate) {
      notifyWarning('Please select an open date.', { category: 'Portfolio' });
      return false;
    }

    // Validate each holding
    for (let i = 0; i < holdings.length; i++) {
      const holding = holdings[i];
      if (!holding.symbol.trim()) {
        notifyWarning(`Please enter a symbol for holding ${i + 1}.`, { category: 'Portfolio' });
        return false;
      }
      const quantity = parseFloat(holding.quantity);
      if (!holding.quantity || isNaN(quantity) || quantity <= 0) {
        notifyWarning(`Please enter a valid quantity for holding ${i + 1}.`, { category: 'Portfolio' });
        return false;
      }
      const purchasePrice = parseFloat(holding.purchasePrice);
      if (!holding.purchasePrice || isNaN(purchasePrice) || purchasePrice <= 0) {
        notifyWarning(`Please enter a valid purchase price for holding ${i + 1}.`, { category: 'Portfolio' });
        return false;
      }
    }
    return true;
  };

  // Fetch existing portfolio data when modal opens
  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);

        if (!selectedAccount?.username || !selectedAccount?.accountName) {
          notifyWarning('Please select an account first.', { category: 'Portfolio' });
          return;
        }

        // Fetch portfolio data using the GET portfolio endpoint
        // Note: This endpoint returns both account and holdings data
        const response = await apiService.get(
          `/portfolio/${selectedAccount.username}/${encodeURIComponent(selectedAccount.accountName)}`
        );

        const data = response.data as PortfolioResponse;

        if (!data.account) {
          notifyError('No portfolio data found for the selected account.', { category: 'Portfolio' });
          handleClose();
          return;
        }

        // Pre-fill account details
        setAccountDetails({
          accountName: data.account.client_account_name || '',
          accountNumber: data.account.account_no || '',
          openDate: data.account.open_date || '',
        });

        // Pre-fill holdings
        setHoldings(
          (data.holdings || []).map((h: HoldingResponse) => ({
            symbol: h.symbol || '',
            quantity: h.quantity ? h.quantity.toString() : '',
            purchasePrice: h.purchase_price ? h.purchase_price.toString() : '',
            purchaseDate: h.purchase_date ? h.purchase_date : ''
          }))
        );
      } catch (error) {
        // Error notification is already handled by apiService interceptor
        handleClose();
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchPortfolio();
    } else {
      // reset when modal closes
      setCurrentStep(1);
      setAccountDetails({ accountName: '', accountNumber: '', openDate: '' });
      setHoldings([]);
    }
  }, [isOpen, selectedAccount, notifyWarning, notifyError]);

  const handleClose = () => {
    setCurrentStep(1);
    onClose();
  };

  const addHolding = () => {
    setHoldings([
      ...holdings,
      { symbol: '', quantity: '', purchasePrice: '', purchaseDate: '' },
    ]);
  };

  const removeHolding = (index: number): void => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const updateHolding = (index: number, field: keyof HoldingInput, value: string): void => {
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

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);

      if (!selectedAccount?.username || !selectedAccount?.accountName) {
        notifyWarning('Please select an account before saving.', { category: 'Portfolio' });
        return;
      }

      const payload = {
        username: selectedAccount.username,
        accountDetails,
        holdings: holdings.map(holding => ({
          ...holding,
          quantity: parseFloat(holding.quantity),
          purchasePrice: parseFloat(holding.purchasePrice)
        })),
      };

      await apiService.updatePortfolio(payload);

      // Success notification is already handled by apiService interceptor
      handleClose();
    } catch (error) {
      // Error notification is already handled by apiService interceptor
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
      aria-labelledby="edit-portfolio-title"
    >
      <div
        className="relative mx-auto p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <h3 id="edit-portfolio-title" className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            Edit Portfolio
            {loading && <LoadingSpinner size="sm" />}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close edit portfolio modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Account Details Step */}
        {currentStep === 1 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
              Step 1: Account Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <div>
                <label htmlFor="edit-account-name" className="text-gray-500">Account Name *</label>
                <input
                  id="edit-account-name"
                  type="text"
                  value={accountDetails.accountName}
                  onChange={(e) => updateAccountDetails('accountName', e.target.value)}
                  required
                  aria-required="true"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-account-number" className="text-gray-500">Account # *</label>
                <input
                  id="edit-account-number"
                  type="text"
                  value={accountDetails.accountNumber}
                  onChange={(e) => updateAccountDetails('accountNumber', e.target.value)}
                  required
                  aria-required="true"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-open-date" className="text-gray-500">Open Date *</label>
                <input
                  id="edit-open-date"
                  type="date"
                  value={accountDetails.openDate}
                  onChange={(e) => updateAccountDetails('openDate', e.target.value)}
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
                  if (!accountDetails.accountName.trim() || !accountDetails.accountNumber.trim() || !accountDetails.openDate) {
                    notifyWarning('Please fill in all account details before proceeding.', { category: 'Portfolio' });
                    return;
                  }
                  setCurrentStep(2);
                }}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-800 hover:bg-gray-900"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Holdings Step */}
        {currentStep === 2 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
              Step 2: Edit Holdings
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
                          value={holding.symbol}
                          onChange={(e) =>
                            updateHolding(index, 'symbol', e.target.value)
                          }
                          placeholder="e.g., AAPL"
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={holding.quantity}
                          onChange={(e) =>
                            updateHolding(index, 'quantity', e.target.value)
                          }
                          placeholder="e.g., 100"
                          min="0"
                          step="1"
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={holding.purchasePrice}
                          onChange={(e) =>
                            updateHolding(index, 'purchasePrice', e.target.value)
                          }
                          placeholder="e.g., 150.25"
                          min="0"
                          step="0.01"
                          className="w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="date"
                          value={holding.purchaseDate}
                          onChange={(e) =>
                            updateHolding(index, 'purchaseDate', e.target.value)
                          }
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
                disabled={isSaving}
                className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white ${
                  isSaving 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditPortfolioModal;
