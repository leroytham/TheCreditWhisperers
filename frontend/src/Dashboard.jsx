import React from "react";
import "./Dashboard.css";
import PriceChart from "./components/PriceChart";
import NewsList from "./components/NewsList";
import SentimentBarChart from "./components/SentimentBarChart";

export default function Dashboard() {
  // Dummy data (can be removed once backend wired)
  const indexData = {
    name: "S&P 500 INDEX",
    ticker: "SPX:IND",
    value: "6,502.08",
    change: "+53.82",
    percent: "+0.83%",
    date: "As of 17:00 AEST 09 September 2025",
  };

  const sentiment = {
    score: 0.21,
    countryAvg: 0.2,
    sectorAvg: 0.19,
    categoryAvg: 0.19,
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <img src="/ubs-logo.png" alt="UBS Logo" className="ubs-logo" />
        <input
          type="text"
          placeholder="Search stocks, country, entity, and more"
          className="search-bar"
        />
        <div className="icons"></div>
      </header>

      <main className="dashboard-content">
        <aside className="sidebar">
          <input
            type="text"
            placeholder="Search for any entity"
            className="sidebar-search"
          />
        </aside>

        <section className="main-section">
          {/* Left side */}
          <div className="card">
            <h2>{indexData.name}</h2>
            <h3>{indexData.ticker}</h3>
            <p className="index-value">
              {indexData.value}
              <span className="change">
                {indexData.change} {indexData.percent}
              </span>
            </p>
            <p className="date">{indexData.date}</p>

            <div className="chart">
              <PriceChart ticker="XLK" range="1y" />
            </div>
          </div>

          {/* Right side */}
          <div>
            <div className="card sentiment">
              <h3>Overall Sentiment</h3>
              <p className="sentiment-score">{sentiment.score}</p>
              <ul>
                <li>Country Avg: {sentiment.countryAvg}</li>
                <li>Sector Avg: {sentiment.sectorAvg}</li>
                <li>Category Avg: {sentiment.categoryAvg}</li>
              </ul>
              <div style={{ marginTop: 12 }}>
                <SentimentBarChart ticker="XLK" />
              </div>
            </div>

            <div className="card related-news">
              <h3>Related News</h3>
              <NewsList ticker="XLK" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}