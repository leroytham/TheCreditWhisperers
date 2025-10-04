# # test_news.py
# import json
# import warnings
# import os

# warnings.filterwarnings("ignore")
# os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# from data_processing import get_ticker_news, analyze_sentiment

# TICKER = "TSLA" 

# def fetch_and_analyze_news(ticker: str, count: int = 20):
#     try:
#         news_articles = get_ticker_news(ticker, count=count)
#         if not news_articles:
#             return {"success": False, "error": "No news found", "ticker": ticker}

#         results, avg_score, _, _ = analyze_sentiment(news_articles)

#         for a in results:
#             a["sentiment_label"] = a.get("sentiment_label", "")
#             a["sentiment_score"] = float(a.get("sentiment_score", 0))

#         return {
#             "success": True,
#             "ticker": ticker,
#             "news": results,
#             "avg_score": float(avg_score)
#         }

#     except Exception as e:
#         return {"success": False, "error": str(e), "ticker": ticker}


# if __name__ == "__main__":
#     result = fetch_and_analyze_news(TICKER, count=10)
#     print(json.dumps(result, indent=2))








# import json
# import warnings
# import os
# from flask import Flask, request, jsonify
# from flask_cors import CORS

# app = Flask(__name__)
# CORS(app)  

# warnings.filterwarnings("ignore")
# os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# from data_processing import get_ticker_news, analyze_sentiment

# app = Flask(__name__)

# def fetch_and_analyze_news(ticker: str, count: int = 20):
#     try:
#         news_articles = get_ticker_news(ticker, count=count)
#         if not news_articles:
#             return {"success": False, "error": "No news found", "ticker": ticker}

#         results, avg_score, _, _ = analyze_sentiment(news_articles)

#         for a in results:
#             a["sentiment_label"] = a.get("sentiment_label", "")
#             a["sentiment_score"] = float(a.get("sentiment_score", 0))

#         return {
#             "success": True,
#             "ticker": ticker,
#             "news": results,
#             "avg_score": float(avg_score)
#         }

#     except Exception as e:
#         return {"success": False, "error": str(e), "ticker": ticker}


# @app.route("/news", methods=["GET"])
# def get_news():
#     ticker = request.args.get("ticker", "")  
#     count = int(request.args.get("count", 198))   
#     result = fetch_and_analyze_news(ticker, count)
#     return jsonify(result)


# if __name__ == "__main__":
#     app.run(host="0.0.0.0", port=5001, debug=True)



import json
import warnings
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
from yahooquery import Ticker



warnings.filterwarnings("ignore")
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from data_processing import get_ticker_news, analyze_sentiment

app = Flask(__name__)
# Enable CORS properly
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

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

@app.route("/news", methods=["GET"])
def get_news():
    ticker = request.args.get("ticker", "")  
    count = int(request.args.get("count", 198))   
    result = fetch_and_analyze_news(ticker, count)
    return jsonify(result)

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





if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
