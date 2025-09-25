// NewsList.jsx
import { useEffect, useState } from "react";
const BASE = process.env.REACT_APP_API_BASE || "";

function badge(label) {
  const base = { padding: "2px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600 };
  if (label === "positive") return { ...base, background: "#e6ffed", color: "#087443" };
  if (label === "negative") return { ...base, background: "#ffecec", color: "#b00020" };
  return { ...base, background: "#eef2f7", color: "#334155" };
}

export default function NewsList({ ticker = "AAPL", count = 100 }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        const url = BASE ? `${BASE}/api/news?ticker=${encodeURIComponent(ticker)}&count=${count}`
                         : `/api/news?ticker=${encodeURIComponent(ticker)}&count=${count}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!cancelled) setItems(j);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [ticker, count]);

  if (err) return <div style={{ color: "crimson" }}>News load error: {err}</div>;
  if (!items.length) return <div>No articles found.</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((a, i) => (
        <article key={i} style={{ padding: 16, borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,.06)", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              <a href={a.url} target="_blank" rel="noreferrer" style={{ color: "#0f172a", textDecoration: "none" }}>
                {a.title}
              </a>
            </h3>
            <span style={badge(a.sentiment_label)}>
              {a.sentiment_label?.toUpperCase()} {Number(a.sentiment_score ?? 0).toFixed(2)}
            </span>
          </div>
          {a.description ? <p style={{ margin: "8px 0 0 0", color: "#475569" }}>{a.description}</p> : null}
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            {(a.source ? a.source + " • " : "") + new Date(a.published_at).toLocaleString()}
          </div>
        </article>
      ))}
    </div>
  );
}