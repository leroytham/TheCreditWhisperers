import React from 'react';

/**
 * OpportunitiesCard Component
 *
 * Displays investment opportunities with filtering tabs
 * TODO: Backend implementation needed for opportunity analysis
 */
const OpportunitiesCard = () => {
  return (
    <div className="bg-white p-6 md:p-8 rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Opportunities</h2>
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Opportunity Analysis Coming Soon</p>
          <p className="text-sm text-gray-400 mt-1">
            AI-powered opportunity detection is currently being developed
          </p>
        </div>
      </div>
    </div>
  );
};

export default OpportunitiesCard;
