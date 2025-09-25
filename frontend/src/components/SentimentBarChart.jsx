// src/components/SentimentBarChart.jsx
import { useEffect, useState } from "react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// If you added "proxy": "http://127.0.0.1:8000" in package.json,
// this can call /api/... directly. Otherwise set REACT_APP_API_BASE.
const BASE = process.env.REACT_APP_API_BASE || "";

export default function SentimentBarChart({
  ticker = "AAPL",
  count = 100,           // backend accepts 1..200
  height = 320,
}) {
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setErr("");
        const url = BASE
          ? `${BASE}/api/sentiment_daily?ticker=${encodeURIComponent(ticker)}&count=${count}`
          : `/api/sentiment_daily?ticker=${encodeURIComponent(ticker)}&count=${count}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json(); // { dates: [...], values: [...] }

        const rows = (json?.dates || []).map((d, i) => ({
          date: d,
          avg_sentiment: Number(json.values?.[i] ?? 0),
        }));

        if (!cancelled) setData(rows);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [ticker, count]);

  if (err) return <div style={{ color: "crimson" }}>Sentiment load error: {err}</div>;
  if (!data.length) return <div>Loading sentiment…</div>;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[-1, 1]} tickFormatter={(v) => v.toFixed(1)} />
          <Tooltip formatter={(v) => Number(v).toFixed(2)} />
          <Legend />
          <Bar
            dataKey="avg_sentiment"
            name="Avg Sentiment"
            // no explicit color per your charting rules; let Recharts default
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}