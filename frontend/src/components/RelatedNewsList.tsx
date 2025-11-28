import React from "react";
import "./RelatedNewsList.css";

interface NewsItem {
  id?: string;
  title: string;
  link?: string;
  publishedAt: string;
  source: string;
  summary?: string;
  tickers?: string[];
  sentimentScore: number;
}

interface TickerTagProps {
  symbol: string;
}

interface RelatedNewsCardProps {
  item: NewsItem;
}

interface RelatedNewsListProps {
  items?: NewsItem[];
}

const toSentiment = (s: number): { label: string; tone: string } => {
  if (s >= 0.25) return { label: `Positive (+${s.toFixed(2)})`, tone: "pos" };
  if (s <= -0.25) return { label: `Negative (${s.toFixed(2)})`, tone: "neg" };
  return { label: `Neutral (${s.toFixed(2)})`, tone: "neu" };
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
};

const TickerTag: React.FC<TickerTagProps> = ({ symbol }) => (
  <span className="ticker-tag">{symbol}</span>
);

const RelatedNewsCard: React.FC<RelatedNewsCardProps> = ({ item }) => {
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

      {item.tickers && item.tickers.length > 0 && (
        <div className="news-tickers">
          <span className="tickers-label">Related tickers:</span>
          {item.tickers.map((t: string) => (
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

const RelatedNewsList: React.FC<RelatedNewsListProps> = ({ items = [] }) => {
  if (!items.length) return <p className="no-news">No related news.</p>;
  return (
    <div className="news-list">
      {items.map((it: NewsItem) => (
        <RelatedNewsCard key={it.id ?? it.title} item={it} />
      ))}
    </div>
  );
};

export default RelatedNewsList;