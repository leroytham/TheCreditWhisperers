import React from 'react';

/**
 * KeyThemesCard Component
 *
 * Displays key news themes impacting the portfolio
 */
const KeyThemesCard = () => {
  const themes = [
    {
      title: 'AI Integration & Expansion',
      description:
        'A dominant theme of new partnerships and product launches related to Artificial Intelligence, driving positive sentiment in the tech sector.',
      tickers: ['AMZN', 'GOOGL'],
    },
    {
      title: 'New Product Cycle Momentum',
      description:
        'News flow indicates strong pre-order numbers and supply chain readiness for upcoming product launches, suggesting potential revenue growth.',
      tickers: ['AAPL'],
    },
    {
      title: 'Regulatory Headwinds',
      description:
        'Increased scrutiny from regulators in both the US and Europe regarding advertising practices is creating uncertainty and negative sentiment.',
      tickers: ['GOOGL'],
    },
  ];

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold text-gray-900">Key Themes</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Identifying the dominant news stories and recurring themes impacting your portfolio
        holdings.
      </p>
      <div className="space-y-5">
        {themes.map((theme, idx) => (
          <div key={idx} className={idx < themes.length - 1 ? 'border-b pb-4' : ''}>
            <p className="font-semibold text-gray-800">{theme.title}</p>
            <p className="text-xs text-gray-500 mt-1">{theme.description}</p>
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs">
                <span className="font-semibold">Related Tickers:</span>
                {theme.tickers.map((ticker) => (
                  <span
                    key={ticker}
                    className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full ml-1"
                  >
                    {ticker}
                  </span>
                ))}
              </div>
              <a href="#" className="text-xs font-semibold text-blue-600">
                Explore Theme &raquo;
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyThemesCard;
