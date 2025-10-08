import json
import warnings
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import yfinance as yf
from yahooquery import Ticker
from data_processing import get_ticker_news, analyze_sentiment


warnings.filterwarnings("ignore")
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

load_dotenv()
api_token = os.getenv("FINNHUB_API_KEY")


app = Flask(__name__)
# Enable CORS properly
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})


########################################################################
# 1. fetching and analyzing sentiments from news
########################################################################
def fetch_and_analyze_news(ticker: str, count: int = 20):
    try:
        news_articles = get_ticker_news(ticker, count=count)
        if not news_articles:
            return {"success": False, "error": "No news found", "ticker": ticker}

        results, avg_score, _, _ = analyze_sentiment(news_articles)
        for a in results:
            a["sentiment_label"] = a.get("sentiment_label", "")
            a["sentiment_score"] = float(a.get("sentiment_score", 0))

        return {"success": True, "ticker": ticker, "news": results, "avg_score": float(avg_score)}

    except Exception as e:
        return {"success": False, "error": str(e), "ticker": ticker}


########################################################################
# 2. fetching news based on ticker
########################################################################
@app.route("/news", methods=["GET"])
def get_news():
    ticker = request.args.get("ticker", "")  
    count = int(request.args.get("count", 198))   
    result = fetch_and_analyze_news(ticker, count)
    return jsonify(result)


########################################################################
# 3. find top-10 companies based on sector ETF
########################################################################
@app.route("/top-constituents", methods=["GET"])
def top_constituents():
    # Accept either ETF ticker (e.g. XLE) or sector ticker (e.g. ^SP500-45)
    ticker = request.args.get("ticker", "").strip()

    if not ticker:
        return jsonify({"success": False, "error": "Missing ticker parameter"}), 400

    print(f"Fetching top constituents for ETF: {ticker}...")

    try:
        etf = Ticker(ticker)
        holdings_data = etf.fund_holding_info

        if not holdings_data or "holdings" not in holdings_data.get(ticker, {}):
            return jsonify({"success": False, "error": f"No holdings found for {ticker}"}), 404

        holdings = holdings_data[ticker]["holdings"]
        top_symbols = [h.get("symbol") for h in holdings[:10] if h.get("symbol")]

        # Batch fetch live price data
        price_data = Ticker(top_symbols).price

        top_constituents = []
        for h in holdings[:10]:
            symbol = h.get("symbol")
            if not symbol:
                continue

            p = price_data.get(symbol, {})
            reg_price = p.get("regularMarketPrice")
            change_pct = p.get("regularMarketChangePercent")
            name = p.get("shortName") or h.get("holdingName")
            market_cap = p.get("marketCap")

            top_constituents.append({
                "symbol": symbol,
                "name": name,
                "price": reg_price,
                "percentChange": change_pct,
                "percentOfAssets": h.get("holdingPercent"),
                "marketCap": market_cap
            })

        return jsonify({
            "success": True,
            "etfTicker": ticker,
            "count": len(top_constituents),
            "top_constituents": top_constituents
        })

    except Exception as e:
        print(f" Error fetching top constituents for {ticker}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


########################################################################
# 4. major price movements + associated news (finnhub)
########################################################################
class SignificantEventAnalyzer:
    """Analyze stock price movements and fetch related news."""

    def __init__(self, ticker, api_token, history_period, std_threshold=2.0, event_count=5, news_window=3, news_count=5):
        self.ticker = ticker.upper()
        self.api_token = api_token
        self.history_period = history_period
        self.std_threshold = std_threshold
        self.final_event_count = event_count
        self.news_window_days = news_window
        self.news_article_count = news_count
        self.df = None
        self.top_events = None

    def _fetch_stock_data(self):
        """Fetch historical stock data from yfinance."""
        self.df = yf.Ticker(self.ticker).history(period=self.history_period, interval="1d")
        if self.df.empty:
            return False
        self.df = self.df.reset_index()
        self.df['Date'] = pd.to_datetime(self.df['Date']).dt.tz_localize(None)
        return True

    def _calculate_metrics(self):
        """Compute daily pct change, std dev, and flag big moves."""
        self.df['pct_change'] = self.df['Close'].pct_change()
        daily_return_std = self.df['pct_change'].std()
        self.df['is_big_move'] = self.df['pct_change'].abs() > (self.std_threshold * daily_return_std)
        self.df['direction'] = np.sign(self.df['pct_change'])

    def _find_significant_events(self):
        """Group consecutive big moves into streaks."""
        streaks_broken = (self.df['is_big_move'] != self.df['is_big_move'].shift()) | \
                         (self.df['direction'] != self.df['direction'].shift())
        self.df['streak_id'] = streaks_broken.cumsum()

        big_move_streaks = self.df[self.df['is_big_move'] == True]
        grouped_streaks = big_move_streaks.groupby('streak_id').agg(
            start_date=('Date', 'min'),
            end_date=('Date', 'max'),
            streak_days=('Date', 'count'),
            direction=('direction', 'first'),
            total_move_pct=('pct_change', 'sum')
        )
        return grouped_streaks

    def _fetch_news_for_event(self, target_date_str):
        """Fetch news from Finnhub around a target date."""
        if not self.api_token or self.api_token == "YOUR_API_TOKEN_HERE":
            return []
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
            start_date = target_date - timedelta(days=self.news_window_days)
            end_date = target_date + timedelta(days=self.news_window_days)

            url = "https://finnhub.io/api/v1/company-news"
            params = {
                "token": self.api_token,
                "symbol": self.ticker,
                "from": start_date.strftime('%Y-%m-%d'),
                "to": end_date.strftime('%Y-%m-%d')
            }
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            news_list = []
            for article in data:
                ts = article.get("datetime")
                if not ts:
                    continue
                news_list.append({
                    "date": datetime.fromtimestamp(ts).strftime("%Y-%m-%d"),
                    "title": article.get("headline", "No Title"),
                    "publisher": article.get("source", "N/A"),
                    "link": article.get("url", "#")
                })
            news_list.sort(key=lambda x: x["date"])
            return news_list
        except Exception:
            return []

    def run_analysis(self):
        """Run full workflow and return JSON-serializable dict."""
        if not self._fetch_stock_data():
            return {"success": False, "error": f"No data for {self.ticker}"}

        self._calculate_metrics()
        all_events = self._find_significant_events()

        # Dynamically lower threshold if too few events
        min_threshold = 0.5
        while len(all_events) < self.final_event_count and self.std_threshold > min_threshold:
            self.std_threshold -= 0.1
            self._calculate_metrics()
            all_events = self._find_significant_events()

        if all_events.empty:
            return {"success": True, "ticker": self.ticker, "events": []}

        all_events["importance_rank"] = all_events["total_move_pct"].abs()
        ranked = all_events.sort_values("importance_rank", ascending=False)
        self.top_events = ranked.head(self.final_event_count).copy()

        # Build JSON structure
        direction_map = {1.0: "UP", -1.0: "DOWN"}
        results = []
        for event in self.top_events.itertuples():
            start_str = event.start_date.strftime("%Y-%m-%d")
            news_items = self._fetch_news_for_event(start_str)[:self.news_article_count]
            results.append({
                "start_date": start_str,
                "end_date": event.end_date.strftime("%Y-%m-%d"),
                "days": int(event.streak_days),
                "trend": direction_map.get(event.direction, "NEUTRAL"),
                "total_move_pct": round(event.total_move_pct * 100, 2),
                "news": news_items
            })

        return {
            "success": True,
            "ticker": self.ticker,
            "event_count": len(results),
            "events": results
        }


@app.route("/analyze", methods=["GET"])
def analyze_stock():
    ticker = request.args.get("ticker", "").upper()
    history_period = request.args.get("history_period", "")

    period_map = {
        "5D": "5d",
        "1M": "1mo",
        "3M": "3mo",
        "6M": "6mo",
        "YTD": "ytd",
        "1Y": "1y"
    }
    yf_period = period_map.get(history_period.upper(), "1y")

    analyzer = SignificantEventAnalyzer(
        ticker=ticker,
        api_token=api_token,
        history_period=yf_period
    )

    result = analyzer.run_analysis()
    return jsonify(result)



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
