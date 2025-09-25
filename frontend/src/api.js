// src/api.js
const BASE = process.env.REACT_APP_API_BASE || "";

export async function fetchNews({ q, days = 7 }) {
  const url = BASE ? `${BASE}/news?q=${encodeURIComponent(q)}&days=${days}`
                   : `/news?q=${encodeURIComponent(q)}&days=${days}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`News error: ${r.status}`);
  return r.json();
}

export async function fetchDaily({ q, days = 7 }) {
  const url = BASE ? `${BASE}/news/daily?q=${encodeURIComponent(q)}&days=${days}`
                   : `/news/daily?q=${encodeURIComponent(q)}&days=${days}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Daily error: ${r.status}`);
  return r.json();
}