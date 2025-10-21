import React, { useState } from 'react';
import { Copy, Info } from 'lucide-react';

/**
 * ClientInfoBar Component
 *
 * Displays client/account information with dropdown selector
 */
const ClientInfoBar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState({
    id: 'MX555909',
    name: 'Johnson J',
  });
  const [searchTerm, setSearchTerm] = useState('');

  const accounts = [
    { id: 'MX555909', name: 'Johnson J' },
    { id: 'MX555910', name: 'Johnson Family Trust' },
    { id: 'MX555911', name: 'Johnson IRA' },
  ];

  const filteredAccounts = accounts.filter(
    (account) =>
      account.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAccountSelect = (account) => {
    setSelectedAccount(account);
    setIsDropdownOpen(false);
    setSearchTerm('');
  };

  return (
    <section className="bg-white p-4 border-b border-gray-200 shadow-sm">
      <div className="flex items-stretch justify-between w-full gap-4">
        {/* Card 1: Client / Account Selector */}
        <div className="bg-gray-800 text-white p-3 rounded-md flex justify-between flex-1 relative">
          <div className="flex flex-col justify-between">
            <p className="text-xs text-gray-300 uppercase tracking-wider">Client / Account</p>
            <p className="font-semibold text-sm">
              {selectedAccount.id} - {selectedAccount.name}
            </p>
          </div>
          <div className="flex flex-col justify-end">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-gray-300 hover:text-white ml-4"
            >
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-20 text-gray-800">
                <div className="p-3 border-b flex justify-between items-center">
                  <h4 className="font-semibold text-sm">Select Account</h4>
                  <button
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                  >
                    &times;
                  </button>
                </div>
                <div className="p-2 border-b">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search accounts..."
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="py-1 max-h-48 overflow-y-auto">
                  {filteredAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleAccountSelect(account)}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        selectedAccount.id === account.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      {account.id} - {account.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Consultworks Relationship */}
        <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 flex justify-between flex-1">
          <div className="flex flex-col justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Consultworks Relationship
            </p>
            <p className="font-semibold text-sm">Johnson Family</p>
          </div>
          <div className="flex flex-col justify-end">
            <button className="text-gray-400 hover:text-gray-600">
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Card 3: Owner Information */}
        <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 flex justify-between flex-1">
          <div className="flex flex-col justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Owner (Tax Reporter for the Account)
            </p>
            <p className="font-semibold text-sm">Jane Johnson - 60 yrs</p>
          </div>
          <div className="flex flex-col justify-end">
            <button className="text-gray-400 hover:text-gray-600">
              <Info className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Card 4: Total Account Value */}
        <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200 flex flex-1">
          <div className="flex flex-col justify-between w-full">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Total Account Value
            </p>
            <p className="font-semibold text-sm text-left">USD 632,496.53</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientInfoBar;
