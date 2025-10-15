import os, re, time, json, hashlib
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

import requests
import feedparser
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
TICKERS = [t.strip() for t in os.getenv("TICKERS", "AAPL,MSFT,TSLA").split(",") if t.strip()]
RSS_URLS = [u.strip() for u in os.getenv("RSS_URLS", "https://feeds.reuters.com/reuters/businessNews").split(",") if u.strip()]
DAYS_BACK = int(os.getenv("DAYS_BACK", "2"))

def ymd(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")

def date_window(days_back: int):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days_back)).replace(hour=0, minute=0, second=0, microsecond=0)
    return ymd(start), ymd(now)

def normalize_title(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^\w\s]", "", s)
    return s

def domain_of(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""

def canonical_url(url: str) -> str:
    try:
        u = urlparse(url)
        if not u.scheme:
            return url
        params = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True)
                  if not (k.startswith("utm_") or k in {"gclid", "fbclid", "yclid", "mc_cid", "mc_eid", "ref", "ref_src"})]
        query = urlencode(params)
        path = re.sub(r"/+$", "", u.path) if u.path and u.path != "/" else u.path
        return urlunparse((u.scheme, u.netloc, path, u.params, query, u.fragment))
    except Exception:
        return url

def text_hash(title: str, url: str) -> str:
    base = f"{normalize_title(title)}|{domain_of(url)}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()

def ensure_indexes(col):
    col.create_index([("url", ASCENDING)], unique=True, name="uniq_url")
    col.create_index([("text_hash", ASCENDING)], unique=True, name="uniq_text_hash")
    col.create_index([("published_at", DESCENDING)], name="by_time")
    col.create_index([("source", ASCENDING)], name="by_source")

def insert_safely(col, doc):
    try:
        col.insert_one(doc)
        return {"inserted": 1, "deduped": 0, "error": 0}
    except DuplicateKeyError:
        return {"inserted": 0, "deduped": 1, "error": 0}
    except Exception as e:
        print("Insert error:", e)
        return {"inserted": 0, "deduped": 0, "error": 1}

def fetch_finnhub_company_news(col):
    if not FINNHUB_API_KEY:
        print("FINNHUB_API_KEY not set. Skipping Finnhub.")
        return {"inserted": 0, "deduped": 0, "error": 0}

    base = "https://finnhub.io/api/v1/company-news"
    start, end = date_window(DAYS_BACK)
    totals = {"inserted": 0, "deduped": 0, "error": 0}

    for sym in TICKERS:
        try:
            r = requests.get(base, params={"symbol": sym, "from": start, "to": end, "token": FINNHUB_API_KEY},
                             timeout=20)
            r.raise_for_status()
            data = r.json()
            if not isinstance(data, list):
                data = []

            for it in data:
                url_c = canonical_url(it.get("url") or "")
                title = it.get("headline") or ""
                doc = {
                    "source": "finnhub_company_news",
                    "symbol": sym,
                    "external_id": str(it.get("id") or ""),
                    "url": url_c,
                    "title": title,
                    "summary": it.get("summary"),
                    "publisher": it.get("source"),
                    "image": it.get("image"),
                    "related": it.get("related"),
                    "published_at": datetime.fromtimestamp(it["datetime"], tz=timezone.utc) if it.get("datetime") else None,
                    "raw": it,
                    "text_hash": text_hash(title, url_c),
                    "created_at": datetime.now(timezone.utc)
                }
                res = insert_safely(col, doc)
                totals["inserted"] += res["inserted"]
                totals["deduped"] += res["deduped"]
                totals["error"] += res["error"]

            time.sleep(0.4)
        except requests.HTTPError as e:
            print(f"Finnhub HTTP error for {sym}:", e.response.status_code, e.response.text[:200])
            totals["error"] += 1
        except Exception as e:
            print(f"Finnhub fetch error for {sym}:", str(e))
            totals["error"] += 1

    return totals

def fetch_rss(col):
    totals = {"inserted": 0, "deduped": 0, "error": 0}

    for feed_url in RSS_URLS:
        try:
            feed = feedparser.parse(feed_url)
            for e in feed.entries:
                link = e.get("link") or e.get("id") or e.get("guid") or ""
                url_c = canonical_url(link)
                title = e.get("title") or ""
                # parse date
                published_at = None
                if e.get("published_parsed"):
                    published_at = datetime(*e.published_parsed[:6], tzinfo=timezone.utc)
                elif e.get("updated_parsed"):
                    published_at = datetime(*e.updated_parsed[:6], tzinfo=timezone.utc)

                doc = {
                    "source": f"rss:{feed.feed.get('title', domain_of(feed_url))}",
                    "external_id": e.get("id") or e.get("guid"),
                    "url": url_c,
                    "title": title,
                    "summary": e.get("summary") or e.get("content", [{}])[0].get("value") if e.get("content") else None,
                    "publisher": domain_of(feed_url),
                    "image": (e.get("media_content", [{}])[0].get("url")) if e.get("media_content") else None,
                    "published_at": published_at,
                    "raw": {k: v for k, v in e.items()},
                    "text_hash": text_hash(title, url_c),
                    "created_at": datetime.now(timezone.utc)
                }
                res = insert_safely(col, doc)
                totals["inserted"] += res["inserted"]
                totals["deduped"] += res["deduped"]
                totals["error"] += res["error"]
        except Exception as e:
            print(f"RSS fetch error for {feed_url}:", str(e))
            totals["error"] += 1

    return totals

def main():
    client = MongoClient(MONGO_URI)
    db_name = (urlparse(MONGO_URI).path or "/portfolio").lstrip("/") or "portfolio"
    db = client[db_name]
    col = db["news_items"]
    ensure_indexes(col)

    started = time.time()
    r1 = fetch_finnhub_company_news(col)
    r2 = fetch_rss(col)
    elapsed = round(time.time() - started, 2)

    summary = {
        "elapsed_s": elapsed,
        "finnhub": r1,
        "rss": r2,
        "total_inserted": r1["inserted"] + r2["inserted"],
        "total_deduped": r1["deduped"] + r2["deduped"],
        "total_errors": r1["error"] + r2["error"],
    }
    print("Ingestion complete:\n", json.dumps(summary, default=str, indent=2))
    client.close()

if __name__ == "__main__":
    main()
