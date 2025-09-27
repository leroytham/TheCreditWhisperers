import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, ResponsiveContainer } from 'recharts';
// import chart library, e.g. recharts or react-chartjs-2

const TIMEFRAMES = ['1M', '3M', '6M', '1Y'];

const FinancialDashboard = () => {
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1M');
  const [priceData, setPriceData] = useState([]);
  const [news, setNews] = useState([]);
  const [sentiment, setSentiment] = useState({});
  const [largeMoves, setLargeMoves] = useState([]);
  const [dailySentiment, setDailySentiment] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);

  useEffect(() => {
    fetch(`/api/price?ticker=${ticker}&timeframe=${timeframe}`)
      .then(res => res.json())
      .then(data => setPriceData(data.prices || []));
    fetch(`/api/news?ticker=${ticker}`)
      .then(res => res.json())
      .then(data => {
        setNews(data.news || []);
        setSentiment({ avg_score: data.avg_score });
      });
    fetch(`/api/large_moves?ticker=${ticker}&timeframe=${timeframe}`)
      .then(res => res.json())
      .then(data => setLargeMoves(data.moves || []));
    fetch(`/api/daily_sentiment?ticker=${ticker}`)
      .then(res => res.json())
      .then(data => setDailySentiment(data.daily || {}));
  }, [ticker, timeframe]);

  useEffect(() => {
    if (selectedDate) {
      fetch(`/api/news_around_date?ticker=${ticker}&date=${selectedDate}`)
        .then(res => res.json())
        .then(data => setRelatedNews(data.news || []));
    }
  }, [selectedDate, ticker]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-4">Stock Price & News Dashboard</h1>
      <div className="flex space-x-4 mb-6">
        <input
          type="text"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          className="border px-3 py-2 rounded w-40"
          placeholder="Enter Ticker Symbol"
        />
        <select
          value={timeframe}
          onChange={e => setTimeframe(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          {TIMEFRAMES.map(tf => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
      </div>

      {/* Price Chart with Significant Moves */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">{ticker} Price Chart ({timeframe})</h2>
        <div className="h-80 flex items-center justify-center text-gray-400">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={priceData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="close" stroke="#8884d8" />
              {largeMoves.map((move, idx) => (
                <Line
                  key={idx}
                  dataKey={() => {
                    // Custom marker logic: highlight large move dates
                    return priceData.map(d => d.date === move.date ? d.close : null);
                  }}
                  stroke={move.pct_change > 0 ? "#22c55e" : "#ef4444"}
                  dot={{ r: 6 }}
                  activeDot={{ onClick: () => setSelectedDate(move.date) }}
                  legendType="none"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* News and Sentiment Analysis */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-white rounded shadow p-4">
          <h3 className="text-lg font-semibold mb-2">Related News (Past 7 Days)</h3>
          <div className="overflow-y-auto max-h-96">
            {/* TODO: Map news articles with sentiment labels */}
            {news.length === 0 ? (
              <div className="text-gray-400">No news found.</div>
            ) : (
              news.map((article, idx) => (
                <div key={idx} className="mb-4 pb-2 border-b">
                  <a href={article.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600">{article.title}</a>
                  <div className={`text-sm mt-1 font-bold ${article.sentiment_label === 'positive' ? 'text-green-600' : article.sentiment_label === 'negative' ? 'text-red-600' : 'text-gray-600'}`}>{article.sentiment_label} [{article.sentiment_score}]</div>
                  <div className="text-xs text-gray-500">{article.publish_date} | {article.provider}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-lg font-semibold mb-2">Overall Average Sentiment Score</h3>
          <div className="text-3xl font-bold text-green-600">{sentiment.avg_score ?? '--'}</div>
          {/* TODO: Render daily sentiment bar chart with dailySentiment */}
          <div className="mt-6 h-40 flex items-center justify-center text-gray-400">
            <ResponsiveContainer width="100%" height={160}>
                <BarChart data={Object.entries(dailySentiment).map(([date, score]) => ({ date, score }))}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="score" fill="#82ca9d" />
                </BarChart>
                </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Significant Price Moves & Related News */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <h3 className="text-lg font-semibold mb-2">Significant Price Moves & Related News ({timeframe})</h3>
        {largeMoves.length === 0 ? (
          <div className="text-gray-400">No significant moves detected.</div>
        ) : (
          largeMoves.map((move, idx) => (
            <div key={idx} className="mb-4">
              <div className="font-semibold">{move.date} → {move.pct_change}%</div>
              {/* Related news for this move */}
              {relatedNews.length > 0 ? (
                relatedNews.map((article, i) => (
                  <div key={i} className="ml-4 text-sm">
                    <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-blue-600">{article.title}</a> ({article.publish_date}, {article.provider})
                  </div>
                ))
              ) : (
                <div className="ml-4 text-gray-400">No news found near this date.</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FinancialDashboard;
