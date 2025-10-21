import React, { useState } from 'react';

/**
 * NewsFeedCard Component
 *
 * Displays news feed with tabs and timeline
 */
const NewsFeedCard = () => {
  const [activeTab, setActiveTab] = useState('all-news');

  const tabs = [
    { id: 'all-news', label: 'All News' },
    { id: 'my-holdings', label: 'My Holdings' },
    { id: 'market-moving', label: 'Market Moving' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'alerts', label: 'Alerts' },
  ];

  const newsData = {
    today: [
      {
        time: 'Oct 12 | 2:15pm',
        title: 'AMZN: Amazon Expands Cloud Services with New AI Partnership',
        source: 'Reuters',
        sentiment: 'Positive',
      },
      {
        time: 'Oct 12 | 9:30am',
        title: 'AAPL: Suppliers Ramp Up Production for Upcoming iPhone Launch',
        source: 'Bloomberg',
        sentiment: 'Positive',
      },
    ],
    yesterday: [
      {
        time: 'Oct 11 | 4:45pm',
        title: 'GOOGL: Google Faces Regulatory Scrutiny Over Ad Practices',
        source: 'Wall Street Journal',
        sentiment: 'Negative',
        link: null,
      },
      {
        time: 'Oct 11 | 1:20pm',
        title: 'UBS: Releases Positive Outlook on Global Tech Sector for Q4',
        source: 'UBS Research',
        sentiment: 'Positive',
        link: 'View Report',
      },
      {
        time: 'Oct 11 | 11:00am',
        title: 'MDSO: Reports Successful Trial Results for New Clinical Platform',
        source: 'PR Newswire',
        sentiment: 'Positive',
        link: 'View Summary',
      },
    ],
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm h-full">
      <h3 className="text-2xl font-semibold text-gray-900">News Feed</h3>

      {/* News Feed Tabs */}
      <div className="flex space-x-6 border-b text-sm mt-4 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-black font-semibold border-b-2 border-black'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* News Timeline */}
      <div className="mt-6">
        {/* Timeline Group: Today */}
        <div className="flex">
          <div className="w-20 text-sm font-semibold text-gray-800 py-1">Today</div>
          <div className="relative w-px bg-gray-200">
            <div
              className="absolute w-full h-full bg-repeat-y"
              style={{
                backgroundImage:
                  "url('data:image/svg+xml,%3Csvg width=\"2\" height=\"10\" viewBox=\"0 0 2 10\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M1 0V10\" stroke=\"%23D1D5DB\" stroke-width=\"1\" stroke-dasharray=\"3 3\"/%3E%3C/svg%3E')",
              }}
            ></div>
          </div>
          <div className="flex-1 pl-8 space-y-6">
            {newsData.today.map((news, idx) => (
              <div key={idx} className="flex items-start">
                <p className="text-xs text-gray-500 w-28 flex-shrink-0">{news.time}</p>
                <div>
                  <p className="font-semibold text-sm">{news.title}</p>
                  <p className="text-xs text-gray-500">
                    Source: {news.source} | Sentiment:{' '}
                    <span
                      className={
                        news.sentiment === 'Positive' ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {news.sentiment}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Group: Yesterday */}
        <div className="flex mt-6 border-t pt-6">
          <div className="w-20 text-sm font-semibold text-gray-800 py-1">Yesterday</div>
          <div className="w-px"></div>
          <div className="flex-1 pl-8 space-y-6">
            {newsData.yesterday.map((news, idx) => (
              <div key={idx} className="flex items-start justify-between">
                <div className="flex items-start">
                  <p className="text-xs text-gray-500 w-28 flex-shrink-0">{news.time}</p>
                  <div>
                    <p className="font-semibold text-sm">{news.title}</p>
                    <p className="text-xs text-gray-500">
                      Source: {news.source} | Sentiment:{' '}
                      <span
                        className={
                          news.sentiment === 'Positive' ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {news.sentiment}
                      </span>
                    </p>
                  </div>
                </div>
                {news.link && (
                  <a
                    href="#"
                    className="text-xs font-semibold text-blue-600 whitespace-nowrap hover:underline"
                  >
                    {news.link}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsFeedCard;
