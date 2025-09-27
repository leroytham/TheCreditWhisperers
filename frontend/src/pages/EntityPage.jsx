// src/pages/EntityPage.jsx
import { useState } from "react";
import SentimentChart from "../components/SentimentChart";
import NewsList from "../components/NewsList";

export default function EntityPage() {
  const [q, setQ] = useState("AAPL");
  const [days, setDays] = useState(7);

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ marginBottom: 8 }}>Entity: {q}</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ticker or entity (e.g., AAPL, TSLA)" />
        <select value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>Past 7 days</option>
          <option value={14}>Past 14 days</option>
          <option value={30}>Past 30 days</option>
        </select>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2>Daily Sentiment (Avg) & Article Count</h2>
        <SentimentChart q={q} days={days} />
      </section>

      <section>
        <h2>Related News</h2>
        <NewsList q={q} days={days} />
      </section>
    </div>
  );
}