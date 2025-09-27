# data_processing.py
import sys
import os
import warnings

# Suppress ML library outputs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # For TensorFlow
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'  # For Transformers
os.environ['TOKENIZERS_PARALLELISM'] = 'false'  # Suppress tokenizers warnings
warnings.filterwarnings('ignore')

# Set logging levels before importing transformers
import logging
logging.getLogger("transformers").setLevel(logging.ERROR)
logging.getLogger("transformers.tokenization_utils_base").setLevel(logging.ERROR)

# Redirect stdout temporarily if needed
import io
from contextlib import redirect_stdout

# Your other imports here...
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from collections import defaultdict

# Capture any output from transformers import
old_stdout = sys.stdout
sys.stdout = io.StringIO()

from transformers import pipeline

# Restore stdout after import
sys.stdout = old_stdout

# Load FinBERT pipeline once (so it's not reloaded every call)
# Wrap this in a function to control when it loads
def get_finbert_pipeline():
    """Initialize FinBERT pipeline with suppressed output"""
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    
    try:
        pipeline_obj = pipeline("text-classification", model="ProsusAI/finbert")
        return pipeline_obj
    finally:
        sys.stdout = old_stdout

# Initialize the pipeline
finbert = get_finbert_pipeline()


# Load FinBERT pipeline once (so it’s not reloaded every call)
# finbert = pipeline("text-classification", model="ProsusAI/finbert")

# -------------------------------
# 1. Download 1-year daily ticker data
# -------------------------------
def get_data(ticker, period="1y", interval="1d"):
    """
    Download historical stock data for a ticker.
    Returns a DataFrame with OHLCV and timezone-naive datetime index.
    """
    try:
        data = yf.Ticker(ticker).history(period=period, interval=interval)
        if data.empty:
            print(f"Warning: No data returned for ticker {ticker}", file=sys.stderr)
            return None
        data.index = data.index.tz_localize(None)
        return data
    except Exception as e:
        print(f"Error downloading data for {ticker}: {e}", file=sys.stderr)
        return None


# -------------------------------
# 2. Filter 1-year data by timeframe
# -------------------------------
def filter_data(df, timeframe):
    """
    Filter dataframe based on timeframe string: '1M', '3M', '6M', '1Y'
    """
    time_map = {"1M": 30, "3M": 90, "6M": 180, "1Y": 365}
    if timeframe not in time_map:
        raise ValueError(f"Invalid timeframe: {timeframe}")
    
    end_date = datetime.today()
    start_date = end_date - timedelta(days=time_map[timeframe])
    filtered = df[(df.index >= start_date) & (df.index <= end_date)]
    return filtered


# -------------------------------
# 3. Get news using yf.Ticker().get_news()
# -------------------------------
def get_ticker_news(ticker, count=5, tab="news"):
    """
    Get recent news for a ticker using yfinance's get_news method.
    Only returns news from the past 7 days.
    count: max number of articles to request
    tab: "all", "news" or "press releases"
    Returns a list of dicts: [{title, summary, publish_date, provider, link, image}, ...]
    """
    try:
        ticker_obj = yf.Ticker(ticker)
        raw_news = ticker_obj.get_news(count=count, tab=tab)

        if not raw_news:
            return []

        news_list = []
        today = datetime.utcnow()
        seven_days_ago = today - timedelta(days=7)

        for article in raw_news:
            content = article.get("content", {})
            pub_date_str = content.get("pubDate", "")
            if not pub_date_str:
                continue

            # Convert pubDate to datetime object
            pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d").date()

            # Stop loop if we reach news older than 7 days
            if pub_date < seven_days_ago.date():
                break

            # Get thumbnail if it exists
            thumbnail = content.get("thumbnail") or {}
            image_url = thumbnail.get("originalUrl")  # just grab original URL

            news_list.append({
                "title": content.get("title"),
                "summary": content.get("summary"),
                "publish_date": pub_date_str[:10],
                "provider": content.get("provider", {}).get("displayName"),
                "link": content.get("canonicalUrl", {}).get("url"),
                "image": image_url
            })

        return news_list

    except Exception as e:
        print(f"Error fetching news for {ticker}: {e}", file=sys.stderr)
        return None


# -------------------------------
# 4. Get news using yf.Ticker().get_news()
# -------------------------------
def get_ticker_press_releases_news(ticker, count=100, tab="press releases"):
    """
    Get recent news for a ticker using yfinance's get_news method.
    Only returns news from the past 14 days.
    count: max number of articles to request
    tab: "all", "news" or "press releases"
    Returns a list of dicts: [{title, summary, publish_date, provider, link, image}, ...]
    """
    try:
        ticker_obj = yf.Ticker(ticker)
        raw_news = ticker_obj.get_news(count=count, tab=tab)

        if not raw_news:
            return []

        news_list = []
        today = datetime.utcnow()
        seven_days_ago = today - timedelta(days=14)

        for article in raw_news:
            content = article.get("content", {})
            pub_date_str = content.get("pubDate", "")
            if not pub_date_str:
                continue

            # Convert pubDate to datetime object
            pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d").date()

            # Stop loop if we reach news older than 7 days
            if pub_date < seven_days_ago.date():
                break

            # Get thumbnail if it exists
            thumbnail = content.get("thumbnail") or {}
            image_url = thumbnail.get("originalUrl")  # just grab original URL

            news_list.append({
                "title": content.get("title"),
                "summary": content.get("summary"),
                "publish_date": pub_date_str[:10],
                "provider": content.get("provider", {}).get("displayName"),
                "link": content.get("canonicalUrl", {}).get("url"),
                "image": image_url
            })

        return news_list

    except Exception as e:
        print(f"Error fetching news for {ticker}: {e}", file=sys.stderr)
        return None
    

# # -------------------------------
# # 5. Analyze sentiments with finBERT
# # -------------------------------
# def analyze_sentiment(news_articles):
#     """
#     Passes in a list of articles for FinBERT to read Title + Summary.
#     Appends the sentiment label, confidence score, and raw numeric score.
#     Computes:
#       - overall average of the raw scores
#       - average sentiment per day over the past 7 days
#     Returns a tuple: (results, avg_score, sentiment_counts, daily_avg_sentiment)
#     """
#     results = []
#     total_score = 0
#     sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}

#     # Collect sentiment scores per day
#     daily_scores = defaultdict(list)
#     today = datetime.utcnow().date()
#     seven_days_ago = today - timedelta(days=6)  # past 7 days including today

#     for article in news_articles:
#         title = article.get("title", "")
#         summary = article.get("summary", "")
#         pub_date_str = article.get("publish_date")  # expects 'YYYY-MM-DD'
#         combined_text = f"{title}. {summary}"

#         # Get all class scores from FinBERT
#         sentiment_scores = finbert(combined_text, truncation=True, return_all_scores=True)[0]
#         scores_dict = {r['label'].lower(): r['score'] for r in sentiment_scores}

#         # Determine top label
#         label = max(scores_dict, key=scores_dict.get)
#         confidence = scores_dict[label]

#         # Compute raw numeric score
#         if label == "positive":
#             raw_score = scores_dict["positive"]
#         elif label == "negative":
#             raw_score = -scores_dict["negative"]
#         else:  # neutral
#             raw_score = scores_dict["positive"] - scores_dict["negative"]

#         # Update totals
#         total_score += raw_score
#         sentiment_counts[label] += 1

#         # Attach sentiment info to the article
#         article["sentiment_label"] = label
#         article["sentiment_confidence"] = confidence
#         article["sentiment_score"] = raw_score
#         results.append(article)

#         # Add to daily scores if within the past 7 days
#         if pub_date_str:
#             pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
#             if seven_days_ago <= pub_date <= today:
#                 daily_scores[pub_date].append(raw_score)

#     # Compute daily average sentiment
#     daily_avg_sentiment = {}
#     for i in range(7):
#         date = seven_days_ago + timedelta(days=i)
#         scores = daily_scores.get(date, [])
#         daily_avg_sentiment[date.strftime("%Y-%m-%d")] = sum(scores) / len(scores) if scores else 0

#     # Compute overall numeric sentiment score
#     avg_score = total_score / len(results) if results else 0

#     return results, avg_score, sentiment_counts, daily_avg_sentiment



def analyze_sentiment(news_articles, max_weight=1.0, min_weight=0.5):
    """
    Sentiment analysis with recency weighting.
    Recent articles have higher weight but older ones (up to 7 days) still contribute.
    Returns: (results, weighted_avg_score, sentiment_counts, daily_avg_sentiment)
    """
    results = []
    total_score = 0
    total_weight = 0
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}

    # Collect sentiment scores per day
    daily_scores = defaultdict(list)
    today = datetime.utcnow().date()
    seven_days_ago = today - timedelta(days=6)

    for article in news_articles:
        title = article.get("title", "")
        summary = article.get("summary", "")
        pub_date_str = article.get("publish_date")
        combined_text = f"{title}. {summary}"

        # Get sentiment from FinBERT
        sentiment_scores = finbert(combined_text, truncation=True, return_all_scores=True)[0]
        scores_dict = {r['label'].lower(): r['score'] for r in sentiment_scores}

        label = max(scores_dict, key=scores_dict.get)
        confidence = scores_dict[label]

        if label == "positive":
            raw_score = scores_dict["positive"]
        elif label == "negative":
            raw_score = -scores_dict["negative"]
        else:  # neutral
            raw_score = scores_dict["positive"] - scores_dict["negative"]

        sentiment_counts[label] += 1

        # Default weight = 1
        weight = 1.0

        if pub_date_str:
            pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
            if seven_days_ago <= pub_date <= today:
                day_diff = (today - pub_date).days
                # Linear decay weight
                weight = min_weight + (max_weight - min_weight) * (1 - day_diff / 6)
                # Safety cap
                weight = max(min(weight, 1.0), 0.0)

                daily_scores[pub_date].append((raw_score, weight))

        # Weighted totals
        weighted_score = raw_score * weight
        total_score += weighted_score
        total_weight += weight

        # Attach sentiment info to the article
        article["sentiment_label"] = label
        article["sentiment_confidence"] = confidence
        article["sentiment_score"] = raw_score
        article["sentiment_weight"] = weight
        article["sentiment_weighted_score"] = weighted_score  # NEW
        results.append(article)

    # Compute weighted daily averages
    daily_avg_sentiment = {}
    for i in range(7):
        date = seven_days_ago + timedelta(days=i)
        scores_weights = daily_scores.get(date, [])
        if scores_weights:
            weighted_sum = sum(s * w for s, w in scores_weights)
            weight_sum = sum(w for _, w in scores_weights)
            daily_avg_sentiment[date.strftime("%Y-%m-%d")] = weighted_sum / weight_sum
        else:
            daily_avg_sentiment[date.strftime("%Y-%m-%d")] = 0

    # Compute overall weighted average sentiment
    weighted_avg_score = total_score / total_weight if total_weight else 0

    return results, weighted_avg_score, sentiment_counts, daily_avg_sentiment





# -------------------------------
# 7. Detect large daily moves and fetch related news
# -------------------------------
def detect_large_moves(df, top_n=3, threshold=None):
    """
    Detects large up/down daily moves.
    Returns a list of dicts with date, pct_change.
    If threshold is given, only include moves above abs(threshold)%.
    Otherwise, returns top_n largest moves.
    """
    if df is None or df.empty:
        return []

    df = df.copy()
    df["daily_pct_change"] = df["Close"].pct_change() * 100
    df = df.dropna()

    if threshold is not None:
        moves = df[abs(df["daily_pct_change"]) >= threshold]
    else:
        # Take top N absolute moves
        moves = df.reindex(df["daily_pct_change"].abs().sort_values(ascending=False).index).head(top_n)

    results = []
    for idx, row in moves.iterrows():
        results.append({
            "date": idx.date().strftime("%Y-%m-%d"),
            "pct_change": row["daily_pct_change"]
        })
    return results


def fetch_news_around_date(ticker, target_date, window=3, count=200):
    """
    Fetches news for ticker within +/- `window` days of `target_date`.
    Returns a list of news dicts.
    """
    try:
        ticker_obj = yf.Ticker(ticker)
        raw_news = ticker_obj.get_news(count=count)

        if not raw_news:
            return []

        news_list = []
        target_date = datetime.strptime(target_date, "%Y-%m-%d").date()

        for article in raw_news:
            content = article.get("content", {})
            pub_date_str = content.get("pubDate", "")
            if not pub_date_str:
                continue

            pub_date = datetime.strptime(pub_date_str[:10], "%Y-%m-%d").date()

            if abs((pub_date - target_date).days) <= window:
                news_list.append({
                    "title": content.get("title"),
                    "summary": content.get("summary"),
                    "publish_date": pub_date.strftime("%Y-%m-%d"),
                    "provider": content.get("provider", {}).get("displayName"),
                    "link": content.get("canonicalUrl", {}).get("url"),
                    "image": (content.get("thumbnail") or {}).get("originalUrl")
                })

        return news_list

    except Exception as e:
        print(f"Error fetching news around {target_date} for {ticker}: {e}", file=sys.stderr)
        return None




# 5.2 Analyze sentiments with finBERT
# -------------------------------
# from collections import defaultdict
# from datetime import datetime, timedelta

# def analyze_sentiment(news_articles, max_weight=1.0, min_weight=0.5):
#     """
#     Sentiment analysis with recency weighting.
#     Recent articles have higher weight but older ones (up to 7 days) still contribute.
#     Returns: (results, weighted_avg_score, sentiment_counts, daily_avg_sentiment)
#     """
#     results = []
#     total_score = 0
#     total_weight = 0
#     sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}

#     # Collect sentiment scores per day
#     daily_scores = defaultdict(list)
#     today = datetime.utcnow().date()
#     seven_days_ago = today - timedelta(days=6)

#     for article in news_articles:
#         title = article.get("title", "")
#         summary = article.get("summary", "")
#         pub_date_str = article.get("publish_date")
#         combined_text = f"{title}. {summary}"

#         # Get sentiment from FinBERT
#         sentiment_scores = finbert(combined_text, truncation=True, return_all_scores=True)[0]
#         scores_dict = {r['label'].lower(): r['score'] for r in sentiment_scores}

#         label = max(scores_dict, key=scores_dict.get)
#         confidence = scores_dict[label]

#         if label == "positive":
#             raw_score = scores_dict["positive"]
#         elif label == "negative":
#             raw_score = -scores_dict["negative"]
#         else:  # neutral
#             raw_score = scores_dict["positive"] - scores_dict["negative"]

#         sentiment_counts[label] += 1

#         # Default weight = 1
#         weight = 1.0

#         if pub_date_str:
#             pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
#             if seven_days_ago <= pub_date <= today:
#                 day_diff = (today - pub_date).days
#                 # Linear decay weight
#                 weight = min_weight + (max_weight - min_weight) * (1 - day_diff / 6)

#                 daily_scores[pub_date].append((raw_score, weight))

#         # Weighted totals
#         total_score += raw_score * weight
#         total_weight += weight

#         # Attach sentiment info to the article
#         article["sentiment_label"] = label
#         article["sentiment_confidence"] = confidence
#         article["sentiment_score"] = raw_score
#         article["sentiment_weight"] = weight
#         results.append(article)

#     # Compute weighted daily averages
#     daily_avg_sentiment = {}
#     for i in range(7):
#         date = seven_days_ago + timedelta(days=i)
#         scores_weights = daily_scores.get(date, [])
#         if scores_weights:
#             weighted_sum = sum(s * w for s, w in scores_weights)
#             weight_sum = sum(w for _, w in scores_weights)
#             daily_avg_sentiment[date.strftime("%Y-%m-%d")] = weighted_sum / weight_sum
#         else:
#             daily_avg_sentiment[date.strftime("%Y-%m-%d")] = 0

#     # Compute overall weighted average sentiment
#     weighted_avg_score = total_score / total_weight if total_weight else 0

#     return results, weighted_avg_score, sentiment_counts, daily_avg_sentiment




#Finbert - misinterpreted the scoring - pass summary and news headline, return 3 scores, + - or neutral 
#how it determines is through probability - overall sentiment based on aggregation of probability 
# if the news is neutral the logic is take positive minus negative to see whether its a positive number
#198 most recent news - most likely 7 days but can be more or less 
# this is the max number of news the API can retrieve - yahoo finance 
#if there is more than 7 days there is a breakpoint, else all the news is within 7 days 

#news can be released at any time of the day . .. ... daily price is only the closing price so how does price movement works 


# get sentiment based on timeframe 
# nearer time frame gets larger weightage?




# news_articles = get_ticker_news('AAPL')
# results, avg_score = analyze_sentiment(news_articles)
# print("results of articicles: ", results)
# print('\n')
# print("avg sentiment score: ", avg_score)