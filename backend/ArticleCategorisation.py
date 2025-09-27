# import yfinance as yf
# from datetime import datetime
# from sentence_transformers import SentenceTransformer, util

# model = SentenceTransformer("all-MiniLM-L6-v2")

# categories = {
#     "Earnings": "quarterly earnings report, revenue, profit, EPS",
#     "M&A": "merger acquisition deal buyout takeover",
#     "Guidance": "future outlook guidance forecast expectations",
#     "Dividends": "dividend payout cash distribution shareholder returns",
#     "Product Launch": "new product release innovation launch update",
#     "Other": "general corporate news"
# }

# cat_names = list(categories.keys())
# cat_embeddings = model.encode(list(categories.values()), convert_to_tensor=True)

# def get_press_releases_by_date(ticker, start_date, end_date, count=200):
#     ticker_obj = yf.Ticker(ticker)
#     raw_news = ticker_obj.get_news(count=count, tab="press releases")
#     if not raw_news:
#         return []

#     news_list = []
#     start = datetime.strptime(start_date, "%Y-%m-%d").date()
#     end = datetime.strptime(end_date, "%Y-%m-%d").date()

#     for article in raw_news:
#         content = article.get("content", {})
#         pub_date_str = content.get("pubDate", "")
#         if not pub_date_str:
#             continue

#         pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d").date()
#         if start <= pub_date <= end:
#             title = content.get("title") or ""
#             summary = content.get("summary") or ""
#             text = f"{title}. {summary}"

#             text_emb = model.encode(text, convert_to_tensor=True)
#             scores = util.cos_sim(text_emb, cat_embeddings)[0]
#             best_idx = scores.argmax().item()
#             category = cat_names[best_idx]

#             news_list.append({
#                 "title": title,
#                 "summary": summary,
#                 "publish_date": pub_date.strftime("%Y-%m-%d"),
#                 "provider": content.get("provider", {}).get("displayName"),
#                 "link": content.get("canonicalUrl", {}).get("url"),
#                 "category": category  
#             })

#     return news_list


# from pprint import pprint

# press_releases = get_press_releases_by_date("AAPL", "2025-09-01", "2025-09-15")
# print(len(press_releases), "press releases found\n")

# for pr in press_releases:
#     print(f"[{pr['category']}] {pr['publish_date']} | {pr['title']}")

# print("\n--- Full categorisation details ---")
# for pr in press_releases:
#     pprint(pr)
#     print("-" * 80)


#v2
# import os
# import multiprocessing
# multiprocessing.set_start_method("spawn", force=True)

# os.environ["TOKENIZERS_PARALLELISM"] = "false"

# import torch
# import yfinance as yf
# from datetime import datetime
# from sentence_transformers import SentenceTransformer, util
# from sklearn.cluster import KMeans
# import numpy as np
# import json
# import sys

# # ===============================
# device = "cuda" if torch.cuda.is_available() else "cpu"
# print(f"Using device: {device}")

# model = SentenceTransformer("all-MiniLM-L6-v2", device=device)

# categories = {
#     "Earnings": "quarterly earnings report, revenue, profit, EPS",
#     "M&A": "merger acquisition deal buyout takeover",
#     "Guidance": "future outlook guidance forecast expectations",
#     "Dividends": "dividend payout cash distribution shareholder returns",
#     "Product Launch": "new product release innovation launch update",
#     "Other": "general corporate news"
# }

# cat_names = list(categories.keys())
# cat_embeddings = model.encode(
#     list(categories.values()), 
#     convert_to_tensor=True, 
#     device=device
# )


# def get_press_releases_by_date(ticker, start_date, end_date, count=200):
#     ticker_obj = yf.Ticker(ticker)
#     raw_news = ticker_obj.get_news(count=count, tab="press releases")
#     if not raw_news:
#         return [], np.array([])

#     news_list = []
#     start = datetime.strptime(start_date, "%Y-%m-%d").date()
#     end = datetime.strptime(end_date, "%Y-%m-%d").date()

#     embeddings = [] 

#     for article in raw_news:
#         content = article.get("content", {})
#         pub_date_str = content.get("pubDate", "")
#         if not pub_date_str:
#             continue

#         pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d").date()
#         if start <= pub_date <= end:
#             title = content.get("title") or ""
#             summary = content.get("summary") or ""
#             text = f"{title}. {summary}"


#             text_emb = model.encode(text, convert_to_tensor=True, device=device)
#             embeddings.append(text_emb.cpu().numpy())

   
#             cat_scores = util.cos_sim(text_emb, cat_embeddings)[0].detach().cpu().numpy()
#             best_idx = int(np.argmax(cat_scores))
#             best_score = float(cat_scores[best_idx])

#             category = cat_names[best_idx]

#             news_list.append({
#                 "title": title,
#                 "summary": summary,
#                 "publish_date": pub_date.strftime("%Y-%m-%d"),
#                 "provider": content.get("provider", {}).get("displayName"),
#                 "link": content.get("canonicalUrl", {}).get("url"),
#                 "category": category,
#                 "confidence": round(best_score, 3)
#             })

#     return news_list, np.array(embeddings)



# press_releases, embeddings = get_press_releases_by_date("AAPL", "2025-09-01", "2025-09-15")
# print(len(press_releases), "press releases found\n")

# for pr in press_releases:
#     print(f"[{pr['category']} | {pr['confidence']}] {pr['publish_date']} | {pr['title']}")

# print("\n--- Full categorisation details (first 3) ---")
# for pr in press_releases[:3]:
#     pprint(pr)
#     print("-" * 80)



# if len(embeddings) > 2:
#     n_clusters = min(5, len(embeddings))  
#     kmeans = KMeans(n_clusters=n_clusters, random_state=42)
#     clusters = kmeans.fit_predict(embeddings)

#     print("\n--- Discovered Clusters (unsupervised) ---")
#     for cluster_id in range(n_clusters):
#         print(f"\nCluster {cluster_id}:")
#         for i, pr in enumerate(press_releases):
#             if clusters[i] == cluster_id:
#                 print(f"  - {pr['title']}")



# import sys
# import json

# if __name__ == "__main__":
#     ticker = sys.argv[1]
#     start_date = sys.argv[2]
#     end_date = sys.argv[3]

#     press_releases, _ = get_press_releases_by_date(ticker, start_date, end_date)

#     # print JSON back to Node
#     print(json.dumps(press_releases))


#v3

import os
import multiprocessing
multiprocessing.set_start_method("spawn", force=True)

# Disable parallelism warning
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
import yfinance as yf
from datetime import datetime
from sentence_transformers import SentenceTransformer, util
from sklearn.cluster import KMeans
import numpy as np
import json
import sys

# ===============================
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}", file=sys.stderr)  # debug to stderr, not stdout

model = SentenceTransformer("all-MiniLM-L6-v2", device=device)

categories = {
    "Earnings": "quarterly earnings report, revenue, profit, EPS",
    "M&A": "merger acquisition deal buyout takeover",
    "Guidance": "future outlook guidance forecast expectations",
    "Dividends": "dividend payout cash distribution shareholder returns",
    "Product Launch": "new product release innovation launch update",
    "Other": "general corporate news"
}

cat_names = list(categories.keys())
cat_embeddings = model.encode(
    list(categories.values()),
    convert_to_tensor=True,
    device=device
)


def get_press_releases_by_date(ticker, start_date, end_date, count=200):
    ticker_obj = yf.Ticker(ticker)
    raw_news = ticker_obj.get_news(count=count, tab="press releases")
    if not raw_news:
        return [], np.array([])

    news_list = []
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()

    embeddings = []

    for article in raw_news:
        content = article.get("content", {})
        pub_date_str = content.get("pubDate", "")
        if not pub_date_str:
            continue

        pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d").date()
        if start <= pub_date <= end:
            title = content.get("title") or ""
            summary = content.get("summary") or ""
            text = f"{title}. {summary}"

            text_emb = model.encode(text, convert_to_tensor=True, device=device)
            embeddings.append(text_emb.cpu().numpy())

            cat_scores = util.cos_sim(text_emb, cat_embeddings)[0].detach().cpu().numpy()
            best_idx = int(np.argmax(cat_scores))
            best_score = float(cat_scores[best_idx])

            category = cat_names[best_idx]

            news_list.append({
                "title": title,
                "summary": summary,
                "publish_date": pub_date.strftime("%Y-%m-%d"),
                "provider": content.get("provider", {}).get("displayName"),
                "link": content.get("canonicalUrl", {}).get("url"),
                "category": category,
                "confidence": round(best_score, 3)
            })

    return news_list, np.array(embeddings)


def cluster_articles(embeddings, press_releases, max_clusters=5):
    """Optional clustering function (not used in production)."""
    if len(embeddings) > 2:
        n_clusters = min(max_clusters, len(embeddings))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        clusters = kmeans.fit_predict(embeddings)

        clustered = {f"Cluster {i}": [] for i in range(n_clusters)}
        for i, pr in enumerate(press_releases):
            clustered[f"Cluster {clusters[i]}"].append(pr["title"])
        return clustered
    return {}


# ===============================
# MAIN ENTRY
# ===============================
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "ticker, start_date, end_date required"}))
        sys.exit(1)

    ticker = sys.argv[1]
    start_date = sys.argv[2]
    end_date = sys.argv[3]

    press_releases, embeddings = get_press_releases_by_date(ticker, start_date, end_date)

    # Only return press_releases JSON (no debug prints)
    print(json.dumps(press_releases))
