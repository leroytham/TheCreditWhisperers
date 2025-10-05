import React from "react";
import "./RelatedNewsList.css";

const toSentiment = (s) => {
  if (s >= 0.25) return { label: `Positive (+${s.toFixed(2)})`, tone: "pos" };
  if (s <= -0.25) return { label: `Negative (${s.toFixed(2)})`, tone: "neg" };
  return { label: `Neutral (${s.toFixed(2)})`, tone: "neu" };
};

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
};

const TickerTag = ({ symbol }) => (
  <span className="ticker-tag">{symbol}</span>
);

const RelatedNewsCard = ({ item }) => {
  const { label, tone } = toSentiment(item.sentimentScore);
  return (
    <article className="news-card">
      <h3 className="news-title">
  {item.link ? (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="news-title-link"
    >
      {item.title}
    </a>
  ) : (
    item.title
  )}
</h3>
      <p className="news-meta">
        {timeAgo(item.publishedAt)} · {item.source}
      </p>
      {item.summary && <p className="news-summary">{item.summary}</p>}

      {item.tickers?.length > 0 && (
        <div className="news-tickers">
          <span className="tickers-label">Related tickers:</span>
          {item.tickers.map((t) => (
            <TickerTag key={t} symbol={t} />
          ))}
        </div>
      )}

      <div className={`sentiment-pill sentiment-${tone}`}>
        Sentiment score: {label}
      </div>
    </article>
  );
};

export default function RelatedNewsList({ items = [] }) {
  if (!items.length) return <p className="no-news">No related news.</p>;
  return (
    <div className="news-list">
      {items.map((it) => (
        <RelatedNewsCard key={it.id ?? it.title} item={it} />
      ))}
    </div>
  );
}