import React, { useState, useEffect } from 'react';
import { ChevronDown, Search, User } from 'lucide-react';
import axios from 'axios';

const ClientInfoBar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch accounts for current logged-in user
  useEffect(() => {
    const username = sessionStorage.getItem('user');
    if (!username) return;

    const fetchAccounts = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/accounts/${username}`);
        setAccounts(response.data.accounts || []);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  // Filter accounts by search
  const filteredAccounts = accounts.filter(
    (a) =>
      a.client_account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.account_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAccountSelect = (account) => {
    setSelectedAccount(account);
    setIsDropdownOpen(false);
    setSearchTerm('');

    // Store selected account name for later use
    sessionStorage.setItem('selectedAccountName', account.client_account_name);
    sessionStorage.setItem('selectedAccountNo', account.account_no);
  };

  return (
    <section className="bg-white px-4 py-3 border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Client / Account Selector */}
        <div className="relative flex-1 max-w-lg">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full bg-gray-900 text-white flex items-center justify-between px-4 py-3 rounded-lg shadow hover:bg-gray-800 transition-all duration-150"
          >
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-300" />
              <div className="flex flex-col text-left">
                <span className="text-xs text-gray-400 uppercase tracking-wide">
                  Client / Account
                </span>
                {selectedAccount ? (
                  <span className="text-sm font-semibold text-gray-100">
                    {selectedAccount.account_no} — {selectedAccount.client_account_name}
                  </span>
                ) : (
                  <span className="text-sm italic text-gray-400">
                    {loading ? 'Loading accounts...' : 'Select an account'}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-gray-300" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden animate-fadeIn">
              <div className="p-3 border-b border-gray-100 flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search accounts..."
                  className="w-full border-none focus:ring-0 text-sm text-gray-700 placeholder-gray-400"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <button
                      key={account.account_no}
                      onClick={() => handleAccountSelect(account)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        selectedAccount?.account_no === account.account_no
                          ? 'bg-blue-50 font-semibold text-blue-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {account.client_account_name} - {account.account_no}
                    </button>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm px-4 py-3 italic">No accounts found</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ClientInfoBar;