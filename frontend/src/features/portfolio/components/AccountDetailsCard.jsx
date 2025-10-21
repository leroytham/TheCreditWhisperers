import React from 'react';

/**
 * AccountDetailsCard Component
 *
 * Displays account summary including market value and owner information
 */
const AccountDetailsCard = ({ onViewDetails }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Account Details</h2>
      <p className="text-sm text-gray-500 mt-2">Total Market Value</p>
      <p className="text-5xl text-gray-900 mt-2">
        <span className="text-2xl align-super">$</span>
        <span className="font-bold">632,496</span>
        <span className="text-2xl align-super">.53</span>
      </p>
      <div className="flex justify-between text-sm mt-6">
        <div>
          <p className="text-gray-500">Primary Owner</p>
          <p className="font-medium">Jane Johnson</p>
        </div>
        <div>
          <p className="text-gray-500">Account #</p>
          <p className="font-medium">MX555911</p>
        </div>
      </div>
      <div className="mt-4 text-right">
        <button
          onClick={onViewDetails}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          VIEW DETAILS
        </button>
      </div>
    </div>
  );
};

export default AccountDetailsCard;
