// PriceChart.jsx
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const BASE = process.env.REACT_APP_API_BASE || ""; // use CRA proxy if empty

export default function PriceChart({ ticker = "AAPL", range = "1Y", height = 280 }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        const url = BASE ? `${BASE}/api/price?ticker=${encodeURIComponent(ticker)}&period=1y`
                         : `/api/price?ticker=${encodeURIComponent(ticker)}&period=1y`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json(); // {dates, close, pct_change}
        const data = (j.dates || []).map((d, i) => ({ date: d, close: Number(j.close?.[i] ?? 0) }));
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [ticker]);

  // client-side filter for 1M/3M/6M/1Y
  const sliced = useMemo(() => {
    const n = rows.length;
    const pick = range === "1M" ? 22 : range === "3M" ? 66 : range === "6M" ? 132 : n;
    return rows.slice(Math.max(0, n - pick));
  }, [rows, range]);

  if (err) return <div style={{ color: "crimson" }}>Price load error: {err}</div>;
  if (!rows.length) return <div>Loading price…</div>;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={sliced}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="close" name={`${ticker} Close`} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}