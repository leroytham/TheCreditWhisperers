#!/usr/bin/env python3
import os
import sys
import warnings
import io
from contextlib import redirect_stdout, redirect_stderr

# Suppress ALL possible outputs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error' 
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['PYTHONUNBUFFERED'] = '1'
warnings.filterwarnings('ignore')

# Disable all logging
import logging
logging.disable(logging.CRITICAL)

import json

def safe_import():
    """Import with all output suppressed"""
    with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
        from data_processing import get_data, filter_data, get_ticker_news, analyze_sentiment, detect_large_moves, fetch_news_around_date
        return get_data, filter_data, get_ticker_news, analyze_sentiment, detect_large_moves, fetch_news_around_date

def output_json(data):
    """Output JSON with no extra formatting"""
    sys.stdout.write(json.dumps(data))
    sys.stdout.flush()

def main():
    try:
        # Import with suppressed output
        get_data, filter_data, get_ticker_news, analyze_sentiment, detect_large_moves, fetch_news_around_date = safe_import()
        
        if len(sys.argv) < 2:
            output_json({"error": "Missing command"})
            return

        command = sys.argv[1]
        ticker = sys.argv[2] if len(sys.argv) > 2 else "AAPL"

        # Suppress any function outputs during execution
        with redirect_stderr(io.StringIO()):
            if command == "price":
                timeframe = sys.argv[3] if len(sys.argv) > 3 else "1M"
                df = get_data(ticker)
                if df is None:
                    output_json({"error": "Failed to get data"})
                    return
                df_filtered = filter_data(df, timeframe)
                prices = [
                    {"date": str(idx.date()), "close": float(row["Close"])}
                    for idx, row in df_filtered.iterrows()
                ]
                output_json({"prices": prices})

            elif command == "news":
                news_articles = get_ticker_news(ticker, count=50)
                if news_articles is None:
                    output_json({"error": "Failed to get news"})
                    return
                results, avg_score, _, _ = analyze_sentiment(news_articles)
                for article in results:
                    article["sentiment_label"] = article.get("sentiment_label", "")
                    article["sentiment_score"] = float(article.get("sentiment_score", 0))
                output_json({"news": results, "avg_score": float(avg_score)})

            elif command == "large_moves":
                timeframe = sys.argv[3] if len(sys.argv) > 3 else "1M"
                df = get_data(ticker)
                if df is None:
                    output_json({"error": "Failed to get data"})
                    return
                df_filtered = filter_data(df, timeframe)
                moves = detect_large_moves(df_filtered, top_n=3)
                # Ensure all numbers are JSON serializable
                for move in moves:
                    move["pct_change"] = float(move["pct_change"])
                output_json({"moves": moves})

            elif command == "daily_sentiment":
                news_articles = get_ticker_news(ticker, count=50)
                if news_articles is None:
                    output_json({"error": "Failed to get news"})
                    return
                _, _, _, daily_avg_sentiment = analyze_sentiment(news_articles)
                # Convert all values to float
                daily_clean = {k: float(v) for k, v in daily_avg_sentiment.items()}
                output_json({"daily": daily_clean})

            elif command == "news_around_date":
                date = sys.argv[3] if len(sys.argv) > 3 else ""
                if not date:
                    output_json({"error": "Date required"})
                    return
                news = fetch_news_around_date(ticker, date, window=2, count=20)
                if news is None:
                    output_json({"error": "Failed to get news"})
                    return
                output_json({"news": news})

            else:
                output_json({"error": "Unknown command"})

    except Exception as e:
        output_json({"error": str(e)})

if __name__ == "__main__":
    main()