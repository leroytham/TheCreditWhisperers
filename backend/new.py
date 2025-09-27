from collections import defaultdict
from datetime import datetime, timedelta

def analyze_sentiment_with_weights(news_articles):
    """
    Passes in a list of articles for FinBERT to read Title + Summary.
    Appends the sentiment label, confidence score, raw numeric score, and weighted score.
    Computes:
      - overall weighted average of the raw scores (recency-adjusted)
      - average sentiment per day over the past 7 days (recency-adjusted)
    Returns a tuple: (results, avg_score, sentiment_counts, daily_avg_sentiment)
    """
    results = []
    weighted_total = 0
    weight_sum = 0
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}

    # Collect weighted sentiment scores per day
    daily_scores = defaultdict(list)
    today = datetime.utcnow().date()
    seven_days_ago = today - timedelta(days=6)  # past 7 days including today

    # Weight matrix (0 days old = today = strongest)
    raw_weights = {0: 1.0, 1: 0.8, 2: 0.6, 3: 0.5, 4: 0.4, 5: 0.35, 6: 0.3}
    total_raw = sum(raw_weights.values())
    weights = {k: v / total_raw for k, v in raw_weights.items()}  # normalize to sum = 1

    for article in news_articles:
        title = article.get("title", "")
        summary = article.get("summary", "")
        pub_date_str = article.get("publish_date")  # expects 'YYYY-MM-DD'
        combined_text = f"{title}. {summary}"

        # Get all class scores from FinBERT
        sentiment_scores = finbert(combined_text, truncation=True, return_all_scores=True)[0]
        scores_dict = {r['label'].lower(): r['score'] for r in sentiment_scores}

        # Determine top label
        label = max(scores_dict, key=scores_dict.get)
        confidence = scores_dict[label]

        # Compute raw numeric score
        if label == "positive":
            raw_score = scores_dict["positive"]
        elif label == "negative":
            raw_score = -scores_dict["negative"]
        else:  # neutral
            raw_score = scores_dict["positive"] - scores_dict["negative"]

        # Default weight = 0 (ignore articles outside 7-day window)
        recency_weight = 0

        if pub_date_str:
            pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
            if seven_days_ago <= pub_date <= today:
                days_old = (today - pub_date).days
                recency_weight = weights.get(days_old, 0)

                # Accumulate weighted totals
                weighted_total += raw_score * recency_weight
                weight_sum += recency_weight

                # Track per-day scores (weighted)
                daily_scores[pub_date].append(raw_score * recency_weight)

        # Attach sentiment info to the article
        article["sentiment_label"] = label
        article["sentiment_confidence"] = confidence
        article["sentiment_score_raw"] = raw_score
        article["sentiment_weight"] = recency_weight
        article["sentiment_score_weighted"] = raw_score * recency_weight
        results.append(article)

        sentiment_counts[label] += 1

    # Compute daily average sentiment (recency weighted)
    daily_avg_sentiment = {}
    for i in range(7):
        date = seven_days_ago + timedelta(days=i)
        scores = daily_scores.get(date, [])
        daily_avg_sentiment[date.strftime("%Y-%m-%d")] = (
            sum(scores) / len(scores) if scores else 0
        )

    # Compute overall weighted average score
    avg_score = weighted_total / weight_sum if weight_sum else 0

    return results, avg_score, sentiment_counts, daily_avg_sentiment
