// new_dashboard.jsx
import { useMemo, useState } from "react";
import PriceChart from "./components/PriceChart";
import SentimentBarChart from "./components/SentimentBarChart";
import NewsList from "./components/NewsList";

// simple sprint-3 watchlist (edit to your 5–10 tracked entities)
const DEFAULT_WATCHLIST = ["AAPL", "NVDA", "MSFT", "AMZN", "META"];

export default function Dashboard() {
  const [watchlist] = useState(DEFAULT_WATCHLIST);
  const [selected, setSelected] = useState(watchlist[0]);
  const [range, setRange] = useState("1Y"); // 1M / 3M / 6M / 1Y

  const title = useMemo(() => `Dashboard — ${selected}`, [selected]);

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={selected} onChange={e => setSelected(e.target.value)}>
            {watchlist.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={range} onChange={e => setRange(e.target.value)}>
            <option>1M</option><option>3M</option><option>6M</option><option>1Y</option>
          </select>
        </div>
      </header>

      {/* Price (1Y, client-filtered to 1M/3M/6M) */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px" }}>Price Chart</h2>
        <PriceChart ticker={selected} range={range} />
      </section>

      {/* Sentiment (7 days) */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px" }}>Daily Sentiment (7d)</h2>
        <SentimentBarChart ticker={selected} count={100} />
      </section>

      {/* Related News (7 days processed by backend) */}
      <section>
        <h2 style={{ margin: "0 0 8px" }}>Related News (7d)</h2>
        <NewsList ticker={selected} count={100} />
      </section>
    </div>
  );
}