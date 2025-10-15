# app/api/routes.py
from fastapi import APIRouter, HTTPException
import yfinance as yf

# Import the modular services
from app.services.news_service import news_service_instance
from app.services.stock_data_service import stock_data_service
from app.services.sentiment_service import sentiment_service
from app.services.market_analysis_service import market_analysis_service

# Create an instance of the API Router. All endpoints will be attached to this.
router = APIRouter()

# --- Example of a GET endpoint for categorized news ---
@router.get("/news/{ticker}/categorized")
def get_categorized_news_for_ticker(ticker: str, start_date: str, end_date: str):
    """
    API endpoint to fetch and categorize news for a given ticker and date range.
    Example: /news/AAPL/categorized?start_date=2023-10-01&end_date=2023-10-15
    """
    try:
        # The API layer calls the service to do the heavy lifting.
        categorized_news = news_service_instance.get_categorized_news(ticker, start_date, end_date)
        
        # Convert the list of News objects into a JSON-friendly format for the response
        response_data = [
            {
                "headline": news.headline,
                "source": news.source,
                "sentiment": {
                    "value": news.sentiment_score.value,
                    "label": news.sentiment_score.label, # Using our model's property!
                    "source": news.sentiment_score.source,
                    "timestamp": news.sentiment_score.timestamp,
                }
            }
            for news in categorized_news
        ]
        return response_data
    except Exception as e:
        # Catch potential errors from yfinance or the model
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
@router.get("/stocks/{ticker}/historical-data")
def get_historical_stock_data(ticker: str, timeframe: str = "1M"):
    """
    API endpoint to get historical stock data for a given ticker and timeframe.
    Example: /stocks/AAPL/historical-data?timeframe=3M
    """
    try:
        # 1. Fetch 1 year of data from the service
        full_data = stock_data_service.get_stock_data(ticker)
        if full_data is None:
            raise HTTPException(status_code=404, detail=f"Data not found for ticker {ticker}")

        # 2. Filter data based on the requested timeframe
        filtered_data = stock_data_service.filter_data_by_timeframe(full_data, timeframe)

        # 3. Convert DataFrame to JSON for the response
        # We reset the index to make the 'Date' a regular column
        json_data = filtered_data.reset_index().to_dict(orient="records")
        return {"ticker": ticker, "timeframe": timeframe, "data": json_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/sentiment")
def get_stock_news_and_sentiment(ticker: str):
    """
    API endpoint to get recent news and its advanced, weighted FinBERT sentiment analysis.
    Example: /stocks/TSLA/sentiment
    """
    try:
        # 1. Fetch recent news using the service
        news_articles = news_service_instance.get_ticker_news(ticker)
        if not news_articles:
            return {"ticker": ticker, "message": "No recent news found."}

        # 2. Call the advanced sentiment analysis method
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)

        # 3. Return the rich data structure from the new method
        return {"ticker": ticker, **sentiment_results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/sectors/{sector_ticker}/top-constituents")
def get_top_constituents_for_sector(sector_ticker: str):
    """
    API endpoint to get the top 10 constituents for a given sector.
    The sector_ticker must be URL-encoded if it contains special characters.
    Example: /sectors/%5EGSP500-45/top-constituents (for ^SP500-45)
    """
    try:
        # The API layer calls the service to perform the logic
        constituents = stock_data_service.get_sector_top_constituents(sector_ticker)

        if not constituents:
             return {"sector_ticker": sector_ticker, "constituents": []}

        return {"sector_ticker": sector_ticker, "constituents": constituents}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")
    
@router.get("/stocks/{ticker}/significant-events")
def get_significant_events_for_ticker(ticker: str):
    """
    API endpoint to analyze historical data for a stock, identify the top 5
    most significant price moves, and find correlated news for those events.
    Example: /stocks/NVDA/significant-events
    """
    try:
        # The API layer makes a single call to the service
        events_with_news = market_analysis_service.analyze_significant_events(ticker)

        if not events_with_news:
            return {"ticker": ticker, "message": "No significant events found matching the criteria."}

        return {"ticker": ticker, "events": events_with_news}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/price")
def get_price_data(ticker: str, timeframe: str = "1Y"):
    """
    API endpoint to get historical price data for a ticker.
    Example: /api/price?ticker=AAPL&timeframe=1Y
    """
    try:
        # Fetch stock data using the stock data service
        stock_data = stock_data_service.get_stock_data(ticker)

        if stock_data is None or stock_data.empty:
            raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}")

        # Filter by timeframe if needed
        filtered_data = stock_data_service.filter_data_by_timeframe(stock_data, timeframe)

        # Convert to the format expected by frontend
        prices = []
        for idx, row in filtered_data.iterrows():
            prices.append({
                "date": idx.strftime("%Y-%m-%d"),
                "price": float(row['Close'])
            })

        return {
            "ticker": ticker,
            "company_name": ticker,  # Could be enhanced with actual company name
            "currency": "USD",
            "prices": prices
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news")
def get_news_data(ticker: str):
    """
    API endpoint to get recent news and sentiment for a ticker.
    Example: /api/news?ticker=AAPL
    """
    try:
        # Fetch news articles using the news service
        news_articles = news_service_instance.get_ticker_news(ticker)

        if not news_articles:
            return {"ticker": ticker, "news": [], "avg_score": 0}

        # Analyze sentiment - this adds sentiment fields to the articles
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Format news for frontend - use field names that match frontend expectations
        formatted_news = []
        for article in articles_with_sentiment:
            formatted_news.append({
                "title": article.get("title", ""),  # Frontend expects "title"
                "provider": article.get("provider", "Unknown"),
                "sentiment_score": article.get("sentiment_score_raw", 0),  # Frontend expects "sentiment_score"
                "sentiment_label": article.get("sentiment_label", "neutral"),
                "link": article.get("link", ""),
                "publish_date": article.get("publish_date", ""),
                "image": article.get("image", "")
            })

        return {
            "ticker": ticker,
            "news": formatted_news,
            "avg_score": sentiment_results.get("overall_weighted_score", 0)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/daily-sentiment")
def get_daily_sentiment(ticker: str):
    """
    API endpoint to get daily sentiment data for a ticker.
    Example: /api/daily-sentiment?ticker=AAPL
    """
    try:
        from datetime import datetime, timedelta, timezone

        # Fetch news articles
        news_articles = news_service_instance.get_ticker_news(ticker)

        # Initialize all 7 days with empty data
        today = datetime.now(timezone.utc).date()
        daily_data = {}
        for i in range(7):
            date = today - timedelta(days=6-i)
            date_str = date.strftime("%Y-%m-%d")
            daily_data[date_str] = {"score": 0, "count": 0, "headlines": []}

        if not news_articles:
            return {"ticker": ticker, "daily": daily_data}

        # Analyze sentiment to get scores
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Group articles by date with full details for the frontend
        for article in articles_with_sentiment:
            date = article.get("publish_date")
            if not date:
                continue

            # Only add to daily_data if it's within our 7-day window
            if date not in daily_data:
                continue

            sentiment_score = article.get("sentiment_score_raw", 0)
            daily_data[date]["score"] += sentiment_score
            daily_data[date]["count"] += 1
            daily_data[date]["headlines"].append({
                "title": article.get("title", ""),
                "provider": article.get("provider", "Unknown"),
                "sentiment_score": sentiment_score,
                "link": article.get("link", "")
            })

        # Calculate average scores and sort headlines by sentiment magnitude
        for date, data in daily_data.items():
            if data["count"] > 0:
                data["score"] = data["score"] / data["count"]
            # Sort headlines by absolute sentiment score (most polar first)
            data["headlines"].sort(key=lambda x: abs(x["sentiment_score"]), reverse=True)

        return {
            "ticker": ticker,
            "daily": daily_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news-models")
def get_news_models(ticker: str):
    """
    API endpoint that returns News objects using the proper model structure.
    This demonstrates that we're using the News and SentimentScore models.
    Example: /api/news-models?ticker=AAPL
    """
    try:
        # Fetch news articles
        news_articles = news_service_instance.get_ticker_news(ticker)

        if not news_articles:
            return {"ticker": ticker, "news": [], "message": "No news found"}

        # Analyze sentiment - this creates News model objects
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        news_objects = sentiment_results.get("news_objects", [])

        # Convert News objects to dict format for JSON response
        formatted_news = []
        for news_obj in news_objects:
            formatted_news.append({
                "headline": news_obj.headline,
                "source": news_obj.source,
                "sentiment_score": {
                    "value": news_obj.sentiment_score.value,
                    "label": news_obj.sentiment_score.label,
                    "source": news_obj.sentiment_score.source,
                    "confidence": news_obj.sentiment_score.confidence,
                    "timestamp": news_obj.sentiment_score.timestamp.isoformat()
                },
                "link": getattr(news_obj, 'link', None),
                "publish_date": getattr(news_obj, 'publish_date', None),
                "image": getattr(news_obj, 'image', None)
            })

        return {
            "ticker": ticker,
            "news": formatted_news,
            "overall_score": sentiment_results.get("overall_weighted_score", 0),
            "sentiment_counts": sentiment_results.get("sentiment_counts", {}),
            "message": "Using News and SentimentScore models from app.models"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/search-ticker")
def search_ticker(q: str):
    """
    API endpoint to search for ticker symbols with fuzzy matching.
    Example: /api/search-ticker?q=appl

    This uses Yahoo Finance's search endpoint to find matching tickers.
    Returns quotes with symbol, name, and quoteType fields.
    """
    try:
        if not q or len(q) < 1:
            return {"quotes": []}

        # Use yahooquery's search functionality for fuzzy matching
        from yahooquery import search

        try:
            # Search using yahooquery
            results = search(q)

            if not results or 'quotes' not in results:
                return {"quotes": []}

            # Format results to match expected structure
            formatted_quotes = []
            for quote in results.get('quotes', []):
                # Only include valid quotes with symbols
                if quote.get('symbol'):
                    formatted_quotes.append({
                        "symbol": quote.get('symbol', ''),
                        "shortname": quote.get('shortname', quote.get('longname', '')),
                        "longname": quote.get('longname', quote.get('shortname', '')),
                        "quoteType": quote.get('quoteType', quote.get('typeDisp', 'EQUITY')),
                        "exchange": quote.get('exchDisp', quote.get('exchange', '')),
                        "sector": quote.get('sector', ''),
                        "industry": quote.get('industry', '')
                    })

            return {"quotes": formatted_quotes}

        except Exception as search_error:
            # Fallback to exact match with yfinance if yahooquery fails
            try:
                ticker_obj = yf.Ticker(q.upper())
                info = ticker_obj.info

                if info and "symbol" in info:
                    return {
                        "quotes": [{
                            "symbol": info.get("symbol", q.upper()),
                            "shortname": info.get("shortName", q.upper()),
                            "longname": info.get("longName", ""),
                            "quoteType": info.get("quoteType", "EQUITY"),
                            "exchange": info.get("exchange", ""),
                            "sector": info.get("sector", ""),
                            "industry": info.get("industry", "")
                        }]
                    }
            except:
                pass

            return {"quotes": []}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")
