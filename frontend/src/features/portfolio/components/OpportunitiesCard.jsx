import React, { useState } from 'react';

/**
 * OpportunitiesCard Component
 *
 * Displays investment opportunities with filtering tabs
 */
const OpportunitiesCard = () => {
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'trending', label: 'Trending' },
    { id: 'upgrades', label: 'Upgrades' },
    { id: 'sentiment', label: 'Sentiment' },
  ];

  const opportunities = [
    {
      title: 'Trending Sector: Technology',
      description:
        'Recent news on easing semiconductor shortages and strong cloud adoption rates suggest continued momentum.',
      link: 'Explore Tech News',
    },
    {
      title: 'Analyst Upgrade: AAPL',
      description:
        "Goldman Sachs and Morgan Stanley upgraded AAPL to 'Strong Buy' citing robust demand for new products.",
      link: 'View Analyst Reports',
    },
    {
      title: 'High Positive Sentiment: MDSO',
      description:
        'MDSO has seen a 25% increase in positive news mentions over the past week following successful trial results.',
      link: 'Analyze Sentiment Trend',
    },
  ];

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Opportunities</h2>
      <div className="flex space-x-6 border-b text-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 ${
              activeTab === tab.id
                ? 'text-black font-semibold border-b-2 border-black'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-6 text-sm space-y-4">
        {opportunities.map((opportunity, idx) => (
          <div key={idx} className={idx < opportunities.length - 1 ? 'border-b pb-4' : ''}>
            <p className="font-bold">{opportunity.title}</p>
            <p className="text-xs text-gray-500 mt-1">{opportunity.description}</p>
            <a href="#" className="text-xs font-semibold text-blue-600 mt-1 inline-block">
              {opportunity.link}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OpportunitiesCard;
