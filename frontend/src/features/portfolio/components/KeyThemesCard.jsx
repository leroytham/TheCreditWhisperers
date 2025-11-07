import React from 'react';

/**
 * KeyThemesCard Component
 *
 * Displays key news themes impacting the portfolio
 * TODO: Backend implementation needed for theme analysis
 */
const KeyThemesCard = () => {
  return (
    <div className="bg-white p-6 md:p-8 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold text-gray-900">Key Themes</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Identifying the dominant news stories and recurring themes impacting your portfolio
        holdings.
      </p>
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Theme Analysis Coming Soon</p>
          <p className="text-sm text-gray-400 mt-1">
            AI-powered theme detection is currently being developed
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyThemesCard;
