# app/api/routes.py
from fastapi import APIRouter, HTTPException, Request
import yfinance as yf
from datetime import datetime
from pymongo import MongoClient
import certifi

import msal
import os
from fastapi.responses import RedirectResponse

# Import the modular services
from app.services.news_service import news_service_instance
from app.services.stock_data_service import stock_data_service
from app.services.sentiment_service import sentiment_service
from app.services.market_analysis_service import market_analysis_service

# Import scoring configuration
from app.config.scoring import get_score_definitions


CLIENT_ID = os.getenv("APPLICATION_ID", "<your-client-id>")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

# Validate Azure credentials at startup
if not CLIENT_ID or CLIENT_ID == "<your-client-id>":
    print("WARNING: Azure CLIENT_ID (APPLICATION_ID) is not configured. Azure authentication will not work.")
if not CLIENT_SECRET:
    print("WARNING: Azure CLIENT_SECRET is not configured. Azure authentication will not work.")


mongo_uri = os.getenv("MONGO_URI")
client = MongoClient(mongo_uri, tls=True, tlsCAFile=certifi.where())
db = client["FYP"]  
accounts_col = db["Account_Details"]
holdings_col = db["Stock_Holding"]


router = APIRouter()

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
async def get_stock_news_and_sentiment(ticker: str):
    """
    API endpoint to get recent news and its advanced, weighted FinBERT sentiment analysis.
    Example: /stocks/TSLA/sentiment
    """
    try:
        # 1. Fetch recent news using the service
        news_articles = await news_service_instance.get_ticker_news(ticker)
        if not news_articles:
            return {"ticker": ticker, "message": "No recent news found."}

        # 2. Call the advanced sentiment analysis method
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)

        # 3. Add score definitions to response
        score_defs = get_score_definitions()

        # 4. Return the rich data structure from the new method with score definitions
        return {
            "ticker": ticker,
            **sentiment_results,
            **score_defs
        }

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
             return {"success": True, "sector_ticker": sector_ticker, "top_constituents": []}

        return {"success": True, "sector_ticker": sector_ticker, "top_constituents": constituents}

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

        # Fetch company info for metadata
        company_info = stock_data_service.get_company_info(ticker)
        
        # Fetch additional ticker info from yfinance
        ticker_obj = yf.Ticker(ticker)
        ticker_info = ticker_obj.info
        
        # Convert to the format expected by frontend
        prices = []
        for idx, row in filtered_data.iterrows():
            prices.append({
                "date": idx.strftime("%Y-%m-%d"),
                "price": float(row['Close'])
            })

        return {
            "ticker": ticker,
            "company_name": company_info.get("name", ticker) if company_info else ticker,
            "longname": ticker_info.get("longName", ""),
            "shortname": ticker_info.get("shortName", ""),
            "currency": company_info.get("currency", "USD") if company_info else "USD",
            "exchange": ticker_info.get("exchange", ""),
            "market": ticker_info.get("market", ""),
            "market_state": ticker_info.get("marketState", ""),
            "prices": prices,
            "last_fetched": datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news")
async def get_news_data(ticker: str):
    """
    API endpoint to get recent news and sentiment for a ticker.
    Example: /api/news?ticker=AAPL
    """
    try:
        # Fetch news articles using the news service
        news_articles = await news_service_instance.get_ticker_news(ticker)

        if not news_articles:
            score_defs = get_score_definitions()
            return {"ticker": ticker, "news": [], "avg_score": 0, **score_defs}

        # Analyze sentiment - this adds sentiment fields to the articles
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Format news for frontend - use field names that match frontend expectations
        formatted_news = []
        for article in articles_with_sentiment:
            news_item = {
                "title": article.get("title", ""),  # Frontend expects "title"
                "provider": article.get("provider", "Unknown"),
                "sentiment_score": article.get("sentiment_score_raw", 0),  # Frontend expects "sentiment_score"
                "sentiment_label": article.get("sentiment_label", "Neutral"),  # Bullish/Bearish format
                "link": article.get("link", ""),
                "publish_date": article.get("publish_date", ""),
                "image": article.get("image", "")
            }

            # Add relevance score if available
            relevance_score = article.get("ticker_relevance_score")
            if relevance_score is not None and relevance_score > 0:
                news_item["relevance_score"] = relevance_score

            formatted_news.append(news_item)

        # Add score definitions to response
        score_defs = get_score_definitions()

        return {
            "ticker": ticker,
            "news": formatted_news,
            "avg_score": sentiment_results.get("overall_weighted_score", 0),
            **score_defs
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/daily-sentiment")
async def get_daily_sentiment(ticker: str, days: int = 7):
    """
    API endpoint to get daily sentiment data for a ticker.
    Supports configurable number of days (default: 7, max: 365)
    Example: /api/daily-sentiment?ticker=AAPL&days=30
    """
    try:
        from datetime import datetime, timedelta, timezone

        # Validate and cap days parameter
        days = min(max(days, 1), 365)

        # Fetch news articles
        news_articles = await news_service_instance.get_ticker_news(ticker)

        # Initialize all requested days with empty data
        today = datetime.now(timezone.utc).date()
        daily_data = {}
        for i in range(days):
            date = today - timedelta(days=days-1-i)
            date_str = date.strftime("%Y-%m-%d")
            daily_data[date_str] = {"score": 0, "count": 0, "headlines": []}

        # Add score definitions to response
        score_defs = get_score_definitions()

        if not news_articles:
            return {"ticker": ticker, "daily": daily_data, **score_defs}

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

            headline_item = {
                "title": article.get("title", ""),
                "provider": article.get("provider", "Unknown"),
                "sentiment_score": sentiment_score,
                "sentiment_label": article.get("sentiment_label", "Neutral"),  # Bullish/Bearish format
                "link": article.get("link", "")
            }

            # Add relevance score if available
            relevance_score = article.get("ticker_relevance_score")
            if relevance_score is not None and relevance_score > 0:
                headline_item["relevance_score"] = relevance_score

            daily_data[date]["headlines"].append(headline_item)

        # Calculate average scores and sort headlines by sentiment magnitude
        for date, data in daily_data.items():
            if data["count"] > 0:
                data["score"] = data["score"] / data["count"]
            # Sort headlines by absolute sentiment score (most polar first)
            data["headlines"].sort(key=lambda x: abs(x["sentiment_score"]), reverse=True)

        return {
            "ticker": ticker,
            "daily": daily_data,
            **score_defs
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/rolling-sentiment")
async def get_rolling_sentiment(ticker: str, timeframe: str = "1W"):
    """
    API endpoint to get rolling-window sentiment data for different timeframes.
    Supports: 1W (hourly, 168 points), 1M (6-hourly, 120 points)
    Example: /api/rolling-sentiment?ticker=AAPL&timeframe=1W
    """
    try:
        from datetime import datetime, timedelta, timezone

        # Fetch news articles
        news_articles = await news_service_instance.get_ticker_news(ticker)

        # Add score definitions to response
        score_defs = get_score_definitions()

        if not news_articles:
            return {
                "ticker": ticker,
                "timeframe": timeframe,
                "data": [],
                "message": "No news articles found",
                **score_defs
            }

        # Analyze sentiment for all articles
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Determine granularity and time range based on timeframe
        now = datetime.now(timezone.utc)

        if timeframe == "1W":
            # Hourly rolling 24h windows for past 7 days (168 data points)
            data_points = []

            for i in range(168):  # 7 days * 24 hours
                point_time = now - timedelta(hours=i)
                window_start = point_time - timedelta(hours=24)

                # Find articles published within this 24h window using exact timestamps
                window_articles = []
                for a in articles_with_sentiment:
                    pub_timestamp_str = a.get("publish_timestamp")
                    if pub_timestamp_str:
                        try:
                            pub_timestamp = datetime.fromisoformat(pub_timestamp_str)
                            # Ensure timezone-aware comparison
                            if pub_timestamp.tzinfo is None:
                                pub_timestamp = pub_timestamp.replace(tzinfo=timezone.utc)
                            if window_start <= pub_timestamp <= point_time:
                                window_articles.append(a)
                        except Exception:
                            # Fallback to date-based filtering if timestamp parsing fails
                            publish_date = a.get("publish_date")
                            if publish_date:
                                window_start_date = window_start.date()
                                window_end_date = point_time.date()
                                if window_start_date <= datetime.strptime(publish_date, "%Y-%m-%d").date() <= window_end_date:
                                    window_articles.append(a)

                volume = len(window_articles)
                avg_sentiment = sum(a.get("sentiment_score_raw", 0) for a in window_articles) / volume if volume > 0 else 0

                top_headlines = sorted(
                    window_articles,
                    key=lambda x: abs(x.get("sentiment_score_raw", 0)),
                    reverse=True
                )[:10]  # Increased from 5 to 10 for detail panel

                data_points.append({
                    "timestamp": point_time.isoformat(),
                    "label": point_time.strftime("%a %-I%p"),
                    "volume": volume,
                    "sentiment": avg_sentiment,
                    "headlines": [{
                        "title": h.get("title", ""),
                        "provider": h.get("provider", "Unknown"),
                        "sentiment_score": h.get("sentiment_score_raw", 0),
                        "link": h.get("link", "")
                    } for h in top_headlines]
                })

            # Reverse to show oldest to newest
            data_points.reverse()

        else:  # timeframe == "1M"
            # 6-hourly rolling 24h windows for past 30 days (120 data points)
            # Time points: 00:00, 06:00, 12:00, 18:00 daily
            data_points = []

            # Generate 120 time points (30 days * 4 points per day)
            for day_offset in range(30):
                for hour in [0, 6, 12, 18]:
                    point_time = now - timedelta(days=29 - day_offset)
                    point_time = point_time.replace(hour=hour, minute=0, second=0, microsecond=0)
                    window_start = point_time - timedelta(hours=24)

                    # Find articles published within this 24h window using exact timestamps
                    window_articles = []
                    for a in articles_with_sentiment:
                        pub_timestamp_str = a.get("publish_timestamp")
                        if pub_timestamp_str:
                            try:
                                pub_timestamp = datetime.fromisoformat(pub_timestamp_str)
                                # Ensure timezone-aware comparison
                                if pub_timestamp.tzinfo is None:
                                    pub_timestamp = pub_timestamp.replace(tzinfo=timezone.utc)
                                if window_start <= pub_timestamp <= point_time:
                                    window_articles.append(a)
                            except Exception:
                                # Fallback to date-based filtering if timestamp parsing fails
                                publish_date = a.get("publish_date")
                                if publish_date:
                                    window_start_date = window_start.date()
                                    window_end_date = point_time.date()
                                    if window_start_date <= datetime.strptime(publish_date, "%Y-%m-%d").date() <= window_end_date:
                                        window_articles.append(a)

                    volume = len(window_articles)
                    avg_sentiment = sum(a.get("sentiment_score_raw", 0) for a in window_articles) / volume if volume > 0 else 0

                    top_headlines = sorted(
                        window_articles,
                        key=lambda x: abs(x.get("sentiment_score_raw", 0)),
                        reverse=True
                    )[:10]  # Increased from 5 to 10 for detail panel

                    # Format label based on hour
                    hour_labels = {0: "12AM", 6: "6AM", 12: "12PM", 18: "6PM"}
                    label = point_time.strftime(f"%b %-d {hour_labels[hour]}")

                    data_points.append({
                        "timestamp": point_time.isoformat(),
                        "label": label,
                        "volume": volume,
                        "sentiment": avg_sentiment,
                        "headlines": [{
                            "title": h.get("title", ""),
                            "provider": h.get("provider", "Unknown"),
                            "sentiment_score": h.get("sentiment_score_raw", 0),
                            "link": h.get("link", "")
                        } for h in top_headlines]
                    })

        # Check if we have sufficient data
        has_data = any(point["volume"] > 0 for point in data_points)

        # Extract source earliest dates metadata if available
        source_earliest_dates = None
        if articles_with_sentiment:
            for article in articles_with_sentiment:
                if '_source_earliest_dates' in article:
                    source_earliest_dates = article['_source_earliest_dates']
                    break

        response_data = {
            "ticker": ticker,
            "timeframe": timeframe,
            "data": data_points,
            "has_data": has_data,
            **score_defs
        }
        
        # Add source coverage info if available
        if source_earliest_dates:
            response_data["source_earliest_dates"] = source_earliest_dates

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news-models")
async def get_news_models(ticker: str):
    """
    API endpoint that returns News objects using the proper model structure.
    This demonstrates that we're using the News, SentimentScore, and RelevanceScore models.
    Example: /api/news-models?ticker=AAPL
    """
    try:
        # Fetch news articles
        news_articles = await news_service_instance.get_ticker_news(ticker)

        # Add score definitions to response
        score_defs = get_score_definitions()

        if not news_articles:
            return {"ticker": ticker, "news": [], "message": "No news found", **score_defs}

        # Analyze sentiment - this creates News model objects
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        news_objects = sentiment_results.get("news_objects", [])

        # Convert News objects to dict format for JSON response
        formatted_news = []
        for news_obj in news_objects:
            news_item = {
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
            }

            # Add relevance score if available
            if news_obj.relevance_score is not None:
                news_item["relevance_score"] = {
                    "value": news_obj.relevance_score.value,
                    "source": news_obj.relevance_score.source,
                    "confidence": news_obj.relevance_score.confidence,
                    "timestamp": news_obj.relevance_score.timestamp.isoformat()
                }

            formatted_news.append(news_item)

        return {
            "ticker": ticker,
            "news": formatted_news,
            "overall_score": sentiment_results.get("overall_weighted_score", 0),
            "sentiment_counts": sentiment_results.get("sentiment_counts", {}),
            "message": "Using News, SentimentScore, and RelevanceScore models from app.models",
            **score_defs
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




REDIRECT_URI = os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/api/auth/callback")
AUTHORITY = os.getenv("AZURE_AUTHORITY", "https://login.microsoftonline.com/common")
SCOPES = ["user.read"]

# Initialize MSAL Confidential Client only if credentials are valid
cca = None
if CLIENT_ID and CLIENT_ID != "<your-client-id>" and CLIENT_SECRET:
    try:
        cca = msal.ConfidentialClientApplication(
            client_id=CLIENT_ID,
            authority=AUTHORITY,
            client_credential=CLIENT_SECRET,
        )
        print(f"✓ Azure AD authentication initialized")
        print(f"  Redirect URI: {REDIRECT_URI}")
        print(f"  Authority: {AUTHORITY}")
    except Exception as e:
        print(f"ERROR: Failed to initialize Azure AD authentication: {str(e)}")
else:
    print("WARNING: Azure AD authentication is disabled due to missing credentials.")


@router.get("/login")
def azure_login():
    """
    Redirects the user to Microsoft login page.
    """
    if not cca:
        raise HTTPException(
            status_code=503,
            detail="Azure AD authentication is not configured. Please check APPLICATION_ID and CLIENT_SECRET environment variables."
        )

    try:
        auth_url = cca.get_authorization_request_url(
            SCOPES,
            redirect_uri=REDIRECT_URI,
        )
        print(f"Azure login initiated. Redirect URI: {REDIRECT_URI}")
        return RedirectResponse(auth_url)
    except Exception as e:
        print(f"Azure login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Azure login init failed: {str(e)}")


@router.get("/auth/callback")
async def azure_auth_callback(request: Request):
    """
    Handles redirect from Azure after login.
    Exchanges authorization code for access token, then redirects to frontend.
    """
    if not cca:
        print("ERROR: Azure callback called but cca is not initialized")
        return RedirectResponse("http://localhost:3000/login?error=not_configured")

    try:
        # Check for error from Azure
        error = request.query_params.get("error")
        error_description = request.query_params.get("error_description")

        if error:
            print(f"Azure returned error: {error}")
            print(f"Error description: {error_description}")
            return RedirectResponse(f"http://localhost:3000/login?error={error}")

        code = request.query_params.get("code")
        if not code:
            print("ERROR: Missing authorization code in callback")
            raise HTTPException(status_code=400, detail="Missing authorization code")

        print(f"Exchanging authorization code for token...")
        print(f"Using redirect URI: {REDIRECT_URI}")

        result = cca.acquire_token_by_authorization_code(
            code,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
        )

        if "error" in result:
            error_msg = result.get("error", "unknown")
            error_desc = result.get("error_description", "No description")
            print(f"Azure token exchange error: {error_msg}")
            print(f"Error description: {error_desc}")
            return RedirectResponse(f"http://localhost:3000/login?error=azure_token_failed&msg={error_msg}")

        account = result.get("id_token_claims", {})
        username = account.get("preferred_username", "unknown")

        print(f"✓ Azure Login Success: {username}")

        return RedirectResponse(
            f"http://localhost:3000/portfolio?user={username}"
        )

    except Exception as e:
        print(f"Azure login callback exception: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return RedirectResponse("http://localhost:3000/login?error=azure_failed")




@router.post("/portfolio/save")
async def save_portfolio(data: dict):
    """
    Save a new portfolio (Account Details + Holdings) into MongoDB.
    Only saves if ALL stock symbols are valid.
    """
    try:
        username = data.get("username")
        account = data.get("accountDetails")
        holdings = data.get("holdings", [])

        if not username or not account:
            raise HTTPException(status_code=400, detail="Missing username or account details")

        account_name = account["accountName"].strip()
        account_no = account["accountNumber"].strip()

        # 1️. Check if account already exists
        existing_account = accounts_col.find_one({
            "username": username,
            "account_no": account_no
        })

        if existing_account:
            raise HTTPException(status_code=400, detail="Account already exists for this user.")

        # 2️. Validate ALL stock symbols before saving
        invalid_symbols = []
        for h in holdings:
            symbol = h.get("symbol", "").upper().strip()
            quantity = float(h.get("quantity", 0))
            purchase_price = float(h.get("purchasePrice", 0))

            if not symbol or quantity <= 0 or purchase_price <= 0:
                invalid_symbols.append(symbol or "(empty)")
                continue

            # Validate using yfinance
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="1d")
                if hist.empty:
                    invalid_symbols.append(symbol)
            except Exception:
                invalid_symbols.append(symbol)

        # 3️. If any invalid stock symbol, reject the entire save
        if invalid_symbols:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid stock symbols detected: {', '.join(invalid_symbols)}. "
                       f"Portfolio not saved."
            )

        # 4️. Insert account (all stocks are valid at this point)
        account_record = {
            "username": username,
            "client_account_name": account_name,
            "account_no": account_no,
            "open_date": account["openDate"],
            "created_at": datetime.utcnow()
        }
        accounts_col.insert_one(account_record)

        # 5️. Insert holdings or merge if exists
        holdings_added, holdings_updated = 0, 0

        for h in holdings:
            symbol = h["symbol"].upper().strip()
            quantity = float(h["quantity"])
            purchase_price = float(h["purchasePrice"])

            existing_holding = holdings_col.find_one({
                "username": username,
                "client_account_name": account_name,
                "account_no": account_no,
                "symbol": symbol
            })

            if existing_holding:
                # Weighted average update
                old_qty = float(existing_holding["quantity"])
                old_price = float(existing_holding["purchase_price"])
                new_qty = old_qty + quantity
                new_price = ((old_qty * old_price) + (quantity * purchase_price)) / new_qty

                holdings_col.update_one(
                    {
                        "username": username,
                        "client_account_name": account_name,
                        "account_no": account_no,
                        "symbol": symbol
                    },
                    {"$set": {
                        "quantity": new_qty,
                        "purchase_price": round(new_price, 2),
                        "updated_at": datetime.utcnow()
                    }}
                )
                holdings_updated += 1
            else:
                holding_record = {
                    "username": username,
                    "client_account_name": account_name,
                    "account_no": account_no,
                    "symbol": symbol,
                    "quantity": quantity,
                    "purchase_price": purchase_price,
                    "created_at": datetime.utcnow()
                }
                holdings_col.insert_one(holding_record)
                holdings_added += 1

        return {
            "message": "Portfolio saved successfully!",
            "account_added": True,
            "holdings_added": holdings_added,
            "holdings_updated": holdings_updated
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        print("Error saving portfolio:", e)
        raise HTTPException(status_code=500, detail=f"Failed to save portfolio: {str(e)}")





@router.get("/accounts/{username}")
async def get_accounts_for_user(username: str):
    """
    Get all client accounts for a given username.
    Returns client_account_name and account_no.
    """
    try:
        accounts = list(accounts_col.find(
            {"username": username},
            {"_id": 0, "client_account_name": 1, "account_no": 1}
        ))

        if not accounts:
            return {"accounts": []}

        return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch accounts: {str(e)}")




@router.get("/portfolio/{username}/{account_name}")
async def get_portfolio_details(username: str, account_name: str):
    """
    Returns the account details and all holdings for this user/account.
    """
    try:
        # Fetch account details
        account = accounts_col.find_one(
            {"username": username, "client_account_name": account_name},
            {"_id": 0}
        )
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Fetch holdings
        holdings = list(holdings_col.find(
            {"username": username, "client_account_name": account_name},
            {"_id": 0}
        ))

        return {"account": account, "holdings": holdings}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio: {str(e)}")






@router.put("/portfolio/update")
async def update_portfolio(data: dict):
    try:
        username = data.get("username")
        account = data.get("accountDetails")
        holdings = data.get("holdings", [])

        if not username or not account:
            raise HTTPException(status_code=400, detail="Missing username or account details")

        if not holdings:
            raise HTTPException(status_code=400, detail="Holdings list is empty")

        # Step 1: Validate all stock symbols
        invalid_symbols = []
        for h in holdings:
            symbol = h.get("symbol")
            if not symbol:
                invalid_symbols.append("(empty symbol)")
                continue

            ticker = yf.Ticker(symbol)
            info = ticker.info
            if not info or "shortName" not in info:
                invalid_symbols.append(symbol)

        if invalid_symbols:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid stock symbol(s): {', '.join(invalid_symbols)}"
            )

        # Step 2: Update the account details
        result = accounts_col.update_one(
            {"username": username, "client_account_name": account["accountName"]},
            {"$set": {
                "account_no": account.get("accountNumber"),
                "open_date": account.get("openDate"),
                "updated_at": datetime.utcnow()
            }}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")

        # Step 3: Clear old holdings for this account
        holdings_col.delete_many({
            "username": username,
            "client_account_name": account["accountName"]
        })

        # Step 4: Insert validated holdings
        new_holdings = []
        for h in holdings:
            new_holdings.append({
                "username": username,
                "client_account_name": account["accountName"],
                "symbol": h["symbol"].upper(),
                "quantity": float(h["quantity"]) if h["quantity"] else 0,
                "purchase_price": float(h["purchasePrice"]) if h["purchasePrice"] else 0,
                "updated_at": datetime.utcnow()
            })

        if new_holdings:
            holdings_col.insert_many(new_holdings)

        return {"message": "Portfolio updated successfully!"}

    except HTTPException:
        raise
    except Exception as e:
        print("Error updating portfolio:", e)
        raise HTTPException(status_code=500, detail=f"Invalid Stock Symbol: {str(e)}")



@router.get("/portfolio/holdings/{username}/{account_name}")
async def get_portfolio_holdings(username: str, account_name: str):
    """
    Retrieve holdings for a user and account, aggregate duplicates,
    calculate avg cost, market price, P/L, and attach live news + sentiment data.
    """
    try:
        holdings_cursor = holdings_col.find({
            "username": username,
            "client_account_name": account_name
        })

        holdings_list = list(holdings_cursor)
        if not holdings_list:
            return {"holdings": []}

        aggregated = {}
        for h in holdings_list:
            symbol = h.get("symbol", "").upper()
            qty = float(h.get("quantity", 0))
            price = float(h.get("purchase_price", 0))
            if symbol not in aggregated:
                aggregated[symbol] = {"total_qty": 0, "total_cost": 0}
            aggregated[symbol]["total_qty"] += qty
            aggregated[symbol]["total_cost"] += qty * price

        results = []

        # Loop through each stock symbol
        for symbol, data in aggregated.items():
            total_qty = data["total_qty"]
            avg_cost = round(data["total_cost"] / total_qty, 2) if total_qty > 0 else 0.0

            # Fetch live market data
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="1d")
                market_price = round(float(hist["Close"].iloc[-1]), 2) if not hist.empty else None
            except Exception:
                market_price = None

            # Calculate profit/loss
            if market_price:
                pl_absolute = round(float((market_price - avg_cost) * total_qty), 2)
                pl_percent = round(float(((market_price - avg_cost) / avg_cost) * 100), 2)
                is_positive = bool(pl_absolute >= 0)
            else:
                pl_absolute, pl_percent, is_positive = None, None, None

            # Fetch news and sentiment data for this symbol
            try:
                news_data = await get_news_data(symbol)
                avg_score = news_data.get("avg_score", 0)
                articles = news_data.get("news", [])

                # Derive qualitative sentiment label
                if avg_score > 0.2:
                    sentiment_label = "Positive"
                elif avg_score < -0.2:
                    sentiment_label = "Negative"
                else:
                    sentiment_label = "Neutral"

                # Use the raw article count for newsVolume
                news_volume = len(articles)

            except Exception as e:
                print(f"⚠️ News fetch failed for {symbol}: {e}")
                sentiment_label, news_volume = "N/A", 0

            #  Combine all data into one unified record
            results.append({
                "symbol": symbol,
                "quantity": round(float(total_qty), 2),
                "averageCostPrice": f"{float(avg_cost):,.1f}",
                "marketPrice": f"{float(market_price):,.1f}" if market_price else None,
                "profitLoss": f"{float(pl_absolute):,.1f}" if pl_absolute is not None else None,
                "gainLossPercent": float(pl_percent) if pl_percent is not None else None,
                "isPositive": bool(is_positive) if is_positive is not None else None,
                "newsVolume": news_volume,  #  Now an integer (count of articles)
                "sentiment": avg_score,
                "position": f"{float(market_price) * round(float(total_qty), 2):,.1f}"
            })

        return {"holdings": results}

    except Exception as e:
        print(" Error fetching holdings:", e)
        raise HTTPException(status_code=500, detail=f"Failed to fetch holdings: {str(e)}")




# @router.get("/portfolio/holdings/{username}/{account_name}")
# async def get_portfolio_holdings(username: str, account_name: str):
#     """
#     Retrieve holdings for a user and account, aggregate duplicates,
#     calculate avg cost, market price, and P/L.
#     """
#     try:
#         holdings_cursor = holdings_col.find({
#             "username": username,
#             "client_account_name": account_name
#         })

#         holdings_list = list(holdings_cursor)
#         if not holdings_list:
#             return {"holdings": []}

#         aggregated = {}
#         for h in holdings_list:
#             symbol = h.get("symbol", "").upper()
#             qty = float(h.get("quantity", 0))
#             price = float(h.get("purchase_price", 0))
#             if symbol not in aggregated:
#                 aggregated[symbol] = {"total_qty": 0, "total_cost": 0}
#             aggregated[symbol]["total_qty"] += qty
#             aggregated[symbol]["total_cost"] += qty * price

#         results = []
#         for symbol, data in aggregated.items():
#             total_qty = data["total_qty"]
#             avg_cost = round(data["total_cost"] / total_qty, 2) if total_qty > 0 else 0.0

#             try:
#                 ticker = yf.Ticker(symbol)
#                 hist = ticker.history(period="1d")
#                 market_price = round(float(hist["Close"].iloc[-1]), 2) if not hist.empty else None
#             except Exception:
#                 market_price = None

#             if market_price:
#                 pl_absolute = round(float((market_price - avg_cost) * total_qty), 2)
#                 pl_percent = round(float(((market_price - avg_cost) / avg_cost) * 100), 2)
#                 is_positive = bool(pl_absolute >= 0)
#             else:
#                 pl_absolute, pl_percent, is_positive = None, None, None

#             results.append({
#                 "symbol": symbol,
#                 "quantity": round(float(total_qty), 2),
#                 "averageCostPrice": f"{float(avg_cost):,.1f}",
#                 "marketPrice": f"{float(market_price):,.1f}" if market_price else None,
#                 "profitLoss": f"{float(pl_absolute):,.1f}" if pl_absolute is not None else None,
#                 "gainLossPercent": float(pl_percent) if pl_percent is not None else None,
#                 "isPositive": bool(is_positive) if is_positive is not None else None,
#                 "newsVolume": "N/A",
#                 "sentiment": "N/A",
#                 "position": f"{float(market_price) * round(float(total_qty), 2):,.1f}"
#             })

#         return {"holdings": results}

#     except Exception as e:
#         print("Error fetching holdings:", e)
#         raise HTTPException(status_code=500, detail=f"Failed to fetch holdings: {str(e)}")
    








#python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
#source venv/bin/activate