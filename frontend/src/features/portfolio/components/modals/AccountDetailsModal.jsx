import React from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

/**
 * AccountDetailsModal Component
 *
 * Displays detailed account information in a modal
 */
const AccountDetailsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const accountDetails = {
    totalMarketValue: '632,496.53',
    primaryOwner: 'Jane Johnson',
    accountNumber: 'MX555911',
    accountName: 'Jane Johnson - RMA',
    shortName: 'Jane RMA',
    accountStatus: 'Active',
    ownershipType: 'Sole Owner',
    openDate: '06/27/2005',
    lastStatementDate: '01/08/2019',
    famCode: 'MF01',
    primaryBene1: 'Lisa Houlihan 50%',
    bene2: 'Mark Harmon 50%',
  };

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-details-title"
    >
      <div
        className="relative mx-auto p-8 border w-full max-w-7xl shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start mb-8">
          <h3 id="account-details-title" className="text-2xl font-semibold text-gray-900">Account Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close account details modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-8 grid-rows-2 gap-x-6 gap-y-4 text-sm items-start">
          {/* Total Market Value - Large */}
          <div className="col-span-2 row-span-2">
            <p className="text-gray-500">Total Market Value</p>
            <p className="text-5xl text-gray-900 mt-1">
              <span className="text-2xl align-super">$</span>
              <span className="font-bold">632,496</span>
              <span className="text-2xl align-super">.53</span>
            </p>
          </div>

          {/* Row 1 */}
          <div>
            <p className="text-gray-500">Primary Account Owner</p>
            <p className="font-semibold text-gray-800">{accountDetails.primaryOwner}</p>
          </div>
          <div>
            <p className="text-gray-500">Account #</p>
            <p className="font-semibold text-gray-800">{accountDetails.accountNumber}</p>
          </div>
          <div>
            <p className="text-gray-500">Account Name</p>
            <p className="font-semibold text-gray-800">{accountDetails.accountName}</p>
          </div>
          <div>
            <p className="text-gray-500">Short Name</p>
            <p className="font-semibold text-gray-800">{accountDetails.shortName}</p>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-x-6">
            <div>
              <p className="text-gray-500">Account Status</p>
              <p className="font-semibold text-gray-800">{accountDetails.accountStatus}</p>
            </div>
            <div>
              <p className="text-gray-500">Ownership Type</p>
              <p className="font-semibold text-gray-800">{accountDetails.ownershipType}</p>
            </div>
          </div>

          {/* Row 2 */}
          <div>
            <p className="text-gray-500">Open Date</p>
            <p className="font-semibold text-gray-800">{accountDetails.openDate}</p>
          </div>
          <div>
            <p className="text-gray-500">Last Statement Date</p>
            <p className="font-semibold text-gray-800">{accountDetails.lastStatementDate}</p>
          </div>
          <div>
            <p className="text-gray-500">FAM Code</p>
            <p className="font-semibold text-gray-800">{accountDetails.famCode}</p>
          </div>
          <div>
            <p className="text-gray-500">Primary Bene 1</p>
            <p className="font-semibold text-gray-800">{accountDetails.primaryBene1}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">Bene 2</p>
            <p className="font-semibold text-gray-800">{accountDetails.bene2}</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-8 text-right">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

AccountDetailsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AccountDetailsModal;
