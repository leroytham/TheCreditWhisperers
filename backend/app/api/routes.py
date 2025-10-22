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


CLIENT_ID = os.getenv("Application_ID", "<your-client-id>")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")


mongo_uri = os.getenv("MONGO_URI_PYTHON")
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
async def get_daily_sentiment(ticker: str):
    """
    API endpoint to get daily sentiment data for a ticker.
    Example: /api/daily-sentiment?ticker=AAPL
    """
    try:
        from datetime import datetime, timedelta, timezone

        # Fetch news articles
        news_articles = await news_service_instance.get_ticker_news(ticker)

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
async def get_news_models(ticker: str):
    """
    API endpoint that returns News objects using the proper model structure.
    This demonstrates that we're using the News and SentimentScore models.
    Example: /api/news-models?ticker=AAPL
    """
    try:
        # Fetch news articles
        news_articles = await news_service_instance.get_ticker_news(ticker)

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




REDIRECT_URI = os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/api/auth/callback")
AUTHORITY = "https://login.microsoftonline.com/common"
SCOPES = ["user.read"]

# Initialize MSAL Confidential Client
cca = msal.ConfidentialClientApplication(
    client_id=CLIENT_ID,
    authority=AUTHORITY,
    client_credential=CLIENT_SECRET,
)


@router.get("/login")
def azure_login():
    """
    Redirects the user to Microsoft login page.
    """
    try:
        auth_url = cca.get_authorization_request_url(
            SCOPES,
            redirect_uri=REDIRECT_URI,
        )
        return RedirectResponse(auth_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Azure login init failed: {str(e)}")


@router.get("/auth/callback")
async def azure_auth_callback(request: Request):
    """
    Handles redirect from Azure after login.
    Exchanges authorization code for access token, then redirects to frontend.
    """
    try:
        code = request.query_params.get("code")
        if not code:
            raise HTTPException(status_code=400, detail="Missing authorization code")

        result = cca.acquire_token_by_authorization_code(
            code,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
        )

        if "error" in result:
            print("Azure login error:", result)
            return RedirectResponse("http://localhost:3000/login?error=azure_failed")

        account = result.get("id_token_claims", {})
        username = account.get("preferred_username", "unknown")

        print("Azure Login Success:", username)
        print("Account?: ", account)

        return RedirectResponse(
            f"http://localhost:3000/portfolio?user={username}"
        )

    except Exception as e:
        print("Azure login callback error:", e)
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