import React, { useState, useEffect } from 'react';

/**
 * AccountDetailsCard Component
 *
 * Displays account summary including total market value and owner information
 */
const AccountDetailsCard = () => {
  const [accountName, setAccountName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [totalValue, setTotalValue] = useState(0);
  const [owner, setOwner] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch holdings from backend and calculate total value
  const fetchHoldings = async () => {
    const username = sessionStorage.getItem('user');
    const name = sessionStorage.getItem('selectedAccountName');
    const no = sessionStorage.getItem('selectedAccountNo');

    if (!username || !name || !no) {
      setError('Please select an account first.');
      setLoading(false);
      return;
    }

    setOwner(username);
    setAccountName(name);
    setAccountNo(no);
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `http://localhost:8000/api/portfolio/holdings/${username}/${encodeURIComponent(name)}`
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch holdings');
      }

      const data = await response.json();
      const holdings = data.holdings || [];

      console.log('📊 Holdings fetched:', holdings.length);

      // Compute total market value with detailed logging
      let total = 0;

      holdings.forEach((h, index) => {
        // Attempt to parse the position (remove commas if any)
        const raw = h.position;
        const numericValue = typeof raw === 'string'
          ? parseFloat(raw.replace(/,/g, ''))
          : parseFloat(raw);

        console.log(
          `#${index + 1} Symbol: ${h.symbol || 'N/A'}, Position: ${raw}, Parsed: ${numericValue}`
        );

        if (!isNaN(numericValue)) {
          total += numericValue;
        }
      });

      console.log('Total Market Value Calculated:', total.toLocaleString());
      setTotalValue(total);
    } catch (err) {
      console.error('Error fetching holdings:', err);
      setError('Failed to load holdings data.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchHoldings();
  }, []);

  // Refresh when dropdown account changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleAccountChange = () => fetchHoldings();
      window.addEventListener('accountChanged', handleAccountChange);
      return () => window.removeEventListener('accountChanged', handleAccountChange);
    }
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Account Details</h2>

      {/* Total Market Value */}
      <p className="text-sm text-gray-500 mt-2">Total Market Value</p>

      {loading ? (
        <p className="text-gray-400 mt-3">Loading...</p>
      ) : error ? (
        <p className="text-red-500 mt-3">{error}</p>
      ) : (
        <p className="text-5xl text-gray-900 mt-2">
          <span className="text-2xl align-super">$</span>
          <span className="font-bold">
            {totalValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
      )}

      {/* Account Owner and Number */}
      <div className="flex justify-between text-sm mt-6">
        <div>
          <p className="text-gray-500">Primary Owner</p>
          <p className="font-medium">{accountName || 'N/A'}</p>
        </div>
        <div>
          <p className="text-gray-500">Account #</p>
          <p className="font-medium">{accountNo || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
};

export default AccountDetailsCard;