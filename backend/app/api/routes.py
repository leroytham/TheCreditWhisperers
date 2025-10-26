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
from app.services.sector_service import sector_service_instance
from app.services.sector_sentiment_service import sector_sentiment_service
from app.services.earnings_service import earnings_service

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
        # Determine the period to fetch based on timeframe
        # For 5Y, we need to fetch 5 years of data
        period = "5y" if timeframe == "5Y" else "1y"
        
        # 1. Fetch data from the service with appropriate period
        full_data = stock_data_service.get_stock_data(ticker, period=period)
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
    API endpoint to get recent news and its advanced sentiment analysis with momentum.

    This endpoint returns:
    - Weighted sentiment scores using exponential decay and relevance
    - Sentiment momentum (MACD-style Fast vs. Slow scores)
    - Detailed article-level sentiment and weights
    - Data quality indicators

    Example: /stocks/TSLA/sentiment

    Response includes:
    - overall_weighted_score: Primary sentiment score (slow/24h trend)
    - fast_score: Current intraday sentiment (7h half-life)
    - slow_score: Daily trend sentiment (24h half-life)
    - sentiment_momentum: fast_score - slow_score
    - momentum_label: "Positive Momentum", "Negative Momentum", etc.
    - momentum_interpretation: Human-readable description
    """
    try:
        # 1. Fetch recent news using the service
        news_articles = await news_service_instance.get_ticker_news(ticker)
        if not news_articles:
            return {"ticker": ticker, "message": "No recent news found."}

        # 2. Call the advanced sentiment analysis method with momentum
        sentiment_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)

        # 3. Add score definitions to response
        score_defs = get_score_definitions()

        # 4. Return the rich data structure with momentum fields and score definitions
        return {
            "ticker": ticker,
            **sentiment_results,
            **score_defs
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/earnings-transcript")
async def get_earnings_transcript(ticker: str, quarter: str):
    """
    API endpoint to get earnings call transcript for a given ticker and quarter.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'IBM', 'AAPL')
        quarter: Fiscal quarter in YYYYQM format (e.g., '2024Q1', '2023Q4')
    
    Returns:
        {
            "symbol": "IBM",
            "quarter": "2024Q1",
            "transcript": [
                {
                    "speaker": "Arvind Krishna",
                    "title": "CEO",
                    "content": "...",
                    "sentiment": 0.7,
                    "word_count": 234
                }
            ],
            "total_segments": 25,
            "fetched_at": "2024-10-26T10:30:00"
        }
    
    Example: /stocks/IBM/earnings-transcript?quarter=2024Q1
    """
    try:
        result = await earnings_service.fetch_earnings_transcript(ticker, quarter)
        
        if "error" in result:
            # Return 404 if no data available, 500 for other errors
            if "not available" in result["error"].lower() or "invalid quarter" in result["error"].lower():
                raise HTTPException(status_code=404, detail=result["error"])
            else:
                raise HTTPException(status_code=500, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/earnings-quarters")
async def get_available_earnings_quarters(ticker: str, years_back: int = 5):
    """
    API endpoint to get a list of potential earnings quarters to query.
    
    Args:
        ticker: Stock ticker symbol
        years_back: Number of years to look back (default: 5, max: 15)
    
    Returns:
        {
            "ticker": "IBM",
            "quarters": ["2024Q3", "2024Q2", "2024Q1", ...]
        }
    
    Example: /stocks/IBM/earnings-quarters?years_back=3
    """
    try:
        # Limit years_back to reasonable range
        years_back = min(max(1, years_back), 15)
        
        quarters = await earnings_service.get_available_quarters(ticker, years_back)
        
        return {
            "ticker": ticker.upper(),
            "quarters": quarters,
            "count": len(quarters)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/company-overview")
async def get_company_overview(ticker: str):
    """
    API endpoint to get comprehensive company overview data from Alpha Vantage.
    
    This returns detailed company information including:
    - Basic info (name, description, sector, industry, etc.)
    - Financial ratios (P/E, P/B, EPS, etc.)
    - Analyst ratings and target price
    - Key metrics (market cap, revenue, profit margin, etc.)
    
    Args:
        ticker: Stock ticker symbol (e.g., 'IBM', 'AAPL')
    
    Returns:
        Complete company overview data from Alpha Vantage API
    
    Example: /stocks/IBM/company-overview
    """
    try:
        overview = await stock_data_service.get_company_overview(ticker)
        
        if not overview:
            raise HTTPException(
                status_code=404, 
                detail=f"Company overview data not available for ticker {ticker}"
            )
        
        return {
            "ticker": ticker.upper(),
            "data": overview
        }
    
    except HTTPException:
        raise
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

@router.get("/sectors/{sector_identifier}/aggregated-news")
async def get_sector_aggregated_news(
    sector_identifier: str,
    limit: int = 100,
    timeframe: str = "1W"
):
    """
    API endpoint to get aggregated news for all companies in a sector.

    This endpoint:
    1. Resolves the sector identifier to a yfinance sector key
    2. Fetches the list of constituent tickers dynamically from yfinance
    3. Queries Alpha Vantage for news on each ticker in parallel
    4. Deduplicates by both URL and normalized title
    5. Returns comprehensive sector news with metadata

    Args:
        sector_identifier: Can be:
            - S&P 500 ticker (e.g., ^SP500-45 - must be URL-encoded as %5ESP500-45)
            - SPDR ETF ticker (e.g., XLK)
            - Sector name (e.g., "Information Technology")
            - yfinance sector key (e.g., "technology")
        limit: Maximum number of unique articles to return (default: 100)
        timeframe: Time range for news - "1D", "1W", "1M", etc. (default: "1W")

    Returns:
        {
            "success": true,
            "sector_key": "technology",
            "sector_name": "Information Technology",
            "tickers_queried": ["AAPL", "MSFT", "NVDA", ...],
            "total_tickers": 25,
            "total_articles_fetched": 487,
            "unique_articles": 245,
            "deduplication_rate": 49.69,
            "articles": [...],
            "timeframe": "1W",
            "cached": true,
            "metadata": {
                "url_duplicates_removed": 132,
                "title_duplicates_removed": 110,
                "total_duplicates_removed": 242
            }
        }

    Example:
        /sectors/XLK/aggregated-news?limit=50&timeframe=1W
        /sectors/%5ESP500-45/aggregated-news?limit=100
    """
    try:
        # Resolve sector identifier to yfinance key
        sector_key = sector_service_instance.resolve_sector_key(sector_identifier)

        # Fetch aggregated news
        result = await news_service_instance.get_sector_news(
            sector_key=sector_key,
            limit=limit,
            timeframe=timeframe
        )

        return {
            "success": True,
            **result
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"ERROR in get_sector_aggregated_news: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/sectors/{sector_identifier}/daily-sentiment")
async def get_sector_daily_sentiment(
    sector_identifier: str,
    days: int = 30
):
    """
    API endpoint to get daily sector-wide sentiment scores for charting.

    This endpoint:
    1. Resolves the sector identifier to a yfinance sector key
    2. Fetches aggregated news for the sector
    3. Groups articles by date and calculates daily sector sentiment
    4. Returns daily sentiment data compatible with CombinedSentimentVolumeChart

    Args:
        sector_identifier: Can be:
            - S&P 500 ticker (e.g., ^SP500-45)
            - SPDR ETF ticker (e.g., XLK)
            - Sector name (e.g., "Information Technology")
            - yfinance sector key (e.g., "technology")
        days: Number of days to include (default: 30)

    Returns:
        {
            "success": true,
            "sector_key": "technology",
            "sector_name": "Information Technology",
            "daily": {
                "2025-10-25": {
                    "score": 0.24,
                    "count": 1234,
                    "headlines": [...]
                },
                "2025-10-24": {...}
            }
        }

    Example:
        /sectors/technology/daily-sentiment?days=30
        /sectors/XLK/daily-sentiment?days=7
    """
    try:
        # Resolve sector identifier to yfinance key
        sector_key = sector_service_instance.resolve_sector_key(sector_identifier)

        # Get sector metadata
        sector_metadata = sector_service_instance.get_sector_metadata(sector_key)

        # Get sector tickers
        tickers, _ = sector_service_instance.get_sector_tickers(sector_key)

        # Fetch aggregated news (we need a larger timeframe to get enough days)
        # For 30 days, fetch 1M of news
        timeframe_map = {7: "1W", 14: "2W", 30: "1M", 60: "2M", 90: "3M"}
        timeframe = timeframe_map.get(days, "1M")

        news_result = await news_service_instance.get_sector_news(
            sector_key=sector_key,
            limit=1000,  # Get more articles for daily aggregation
            timeframe=timeframe
        )

        # Calculate daily sentiment
        daily_sentiment = sector_sentiment_service.calculate_daily_sector_sentiment(
            articles=news_result['articles'],
            sector_tickers=tickers,
            days=days
        )

        return {
            "success": True,
            "sector_key": sector_key,
            "sector_name": sector_metadata['display_name'],
            "daily": daily_sentiment
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"ERROR in get_sector_daily_sentiment: {str(e)}")
        import traceback
        traceback.print_exc()
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
        # For 1D intraday data, fetch with 15-minute interval
        if timeframe == "1D":
            stock_data = stock_data_service.get_stock_data(ticker, period="1d", interval="15m")
        elif timeframe == "5Y":
            stock_data = stock_data_service.get_stock_data(ticker, period="5y", interval="1d")
        else:
            stock_data = stock_data_service.get_stock_data(ticker, period="1y", interval="1d")

        if stock_data is None or stock_data.empty:
            raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}")

        print(f"[DEBUG] Raw data for {ticker} ({timeframe}): {len(stock_data)} rows")
        if len(stock_data) > 0:
            print(f"[DEBUG] Last 3 dates in raw data: {stock_data.index[-3:].tolist()}")

        # Filter by timeframe if needed
        filtered_data = stock_data_service.filter_data_by_timeframe(stock_data, timeframe)

        print(f"[DEBUG] Filtered data for {ticker} ({timeframe}): {len(filtered_data)} rows")
        if len(filtered_data) > 0:
            print(f"[DEBUG] Last date in filtered data: {filtered_data.index[-1]}")

        # Fetch company info for metadata
        company_info = stock_data_service.get_company_info(ticker)

        # Fetch additional ticker info from yfinance
        ticker_obj = yf.Ticker(ticker)
        ticker_info = ticker_obj.info

        # Calculate previous close (last close from the previous trading day)
        prev_close = None
        if timeframe == "1D" and len(stock_data) > 0:
            # Get the close price from the previous trading day
            try:
                # Fetch 5 days to ensure we have previous close even with weekends
                hist_5d = ticker_obj.history(period="5d", interval="1d")
                print(f"[DEBUG] Fetched {len(hist_5d)} days of data for prev close")
                print(f"[DEBUG] Last 2 dates: {hist_5d.index[-2:].tolist() if len(hist_5d) >= 2 else 'N/A'}")

                if len(hist_5d) >= 2:
                    # Get the second-to-last day's close (previous trading day)
                    prev_close = float(hist_5d['Close'].iloc[-2])
                    print(f"[DEBUG] Previous close for {ticker}: {prev_close}")
                elif len(hist_5d) == 1:
                    # Fallback if only one day available
                    prev_close = float(hist_5d['Close'].iloc[0])
                    print(f"[DEBUG] Only 1 day available, using: {prev_close}")
            except Exception as e:
                print(f"[ERROR] Error fetching previous close for {ticker}: {e}")

        # Convert to the format expected by frontend
        prices = []
        for idx, row in filtered_data.iterrows():
            price_item = {
                "date": idx.strftime("%Y-%m-%d"),
                "price": float(row['Close']),
                "close": float(row['Close'])
            }
            # Add time for intraday data
            if timeframe == "1D":
                price_item["time"] = idx.strftime("%I:%M %p")
            prices.append(price_item)

        response = {
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

        # Add prev_close for 1D timeframe
        if prev_close is not None:
            response["prev_close"] = prev_close

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news")
async def get_news_data(ticker: str):
    """
    API endpoint to get recent news and sentiment for a ticker with momentum analysis.
    Example: /api/news?ticker=AAPL
    
    Returns comprehensive sentiment data including:
    - feed: Raw Alpha Vantage feed data with all details
    - news: Formatted/simplified news articles for backward compatibility
    - avg_score: Overall weighted sentiment score (slow/24h trend)
    - fast_score: Current intraday sentiment (7h half-life)
    - slow_score: Daily trend sentiment (24h half-life)
    - sentiment_momentum: fast_score - slow_score
    - momentum_label: Classification (e.g., "Positive Momentum")
    - momentum_interpretation: Human-readable description
    - momentum_quality: Data quality indicator
    """
    try:
        # Fetch news articles using the news service
        news_articles = await news_service_instance.get_ticker_news(ticker)
        
        # Also fetch raw Alpha Vantage data if available
        raw_feed = []
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                raw_av_data = await news_service_instance._fetch_alpha_vantage_news(
                    session, ticker, limit=1000, preserve_all_tickers=True
                )
                # Extract the raw feed items from Alpha Vantage
                if raw_av_data:
                    # The _fetch_alpha_vantage_news returns processed articles
                    # We need to fetch raw data directly
                    alpha_vantage_api_key = news_service_instance.alpha_vantage_api_key
                    if alpha_vantage_api_key:
                        url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=1000&tickers={ticker}&apikey={alpha_vantage_api_key}"
                        async with session.get(url, timeout=30) as response:
                            data = await response.json()
                            raw_feed = data.get("feed", [])
        except Exception as e:
            print(f"Error fetching raw Alpha Vantage feed: {e}")

        if not news_articles:
            score_defs = get_score_definitions()
            return {
                "ticker": ticker, 
                "news": [], 
                "feed": raw_feed,
                "items": str(len(raw_feed)),
                "avg_score": 0, 
                **score_defs
            }

        # Analyze sentiment WITH MOMENTUM - this includes fast/slow scores and momentum calculation
        sentiment_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)
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
            "feed": raw_feed,  # Add raw Alpha Vantage feed
            "items": str(len(raw_feed)),  # Number of feed items
            "avg_score": sentiment_results.get("overall_weighted_score", 0),
            # Add momentum fields to response
            "sentiment_momentum": sentiment_results.get("sentiment_momentum"),
            "fast_score": sentiment_results.get("fast_score"),
            "slow_score": sentiment_results.get("slow_score"),
            "momentum_label": sentiment_results.get("momentum_label"),
            "momentum_interpretation": sentiment_results.get("momentum_interpretation"),
            "momentum_quality": sentiment_results.get("momentum_quality"),
            "momentum_direction": sentiment_results.get("momentum_direction"),
            "momentum_strength": sentiment_results.get("momentum_strength"),
            "half_life_fast_hours": sentiment_results.get("half_life_fast_hours"),
            "half_life_slow_hours": sentiment_results.get("half_life_slow_hours"),
            "data_quality": sentiment_results.get("data_quality"),
            # Add volatility fields to response
            "sentiment_volatility": sentiment_results.get("sentiment_volatility"),
            "volatility_quality": sentiment_results.get("volatility_quality"),
            # Add effective news volume (quantity metric)
            "effective_news_volume": sentiment_results.get("effective_news_volume"),
            "volume_interpretation": sentiment_results.get("volume_interpretation"),
            # Add breadth metrics (bull/bear ratio)
            "sentiment_breadth_score": sentiment_results.get("sentiment_breadth_score"),
            "num_bullish_articles": sentiment_results.get("num_bullish_articles"),
            "num_bearish_articles": sentiment_results.get("num_bearish_articles"),
            "total_directional_articles": sentiment_results.get("total_directional_articles"),
            "breadth_interpretation": sentiment_results.get("breadth_interpretation"),
            "breadth_quality": sentiment_results.get("breadth_quality"),
            # Add Z-Score metrics (sentiment shock)
            "sentiment_z_score": sentiment_results.get("sentiment_z_score"),
            "z_score_interpretation": sentiment_results.get("z_score_interpretation"),
            "z_score_historical_mean": sentiment_results.get("z_score_historical_mean"),
            "z_score_historical_std": sentiment_results.get("z_score_historical_std"),
            "z_score_days_of_history": sentiment_results.get("z_score_days_of_history"),
            "z_score_quality": sentiment_results.get("z_score_quality"),
            # Add Source & Topic Analysis metrics
            "source_concentration_hhi": sentiment_results.get("source_concentration_hhi"),
            "concentration_interpretation": sentiment_results.get("concentration_interpretation"),
            "top_sources": sentiment_results.get("top_sources", []),
            "dominant_topic": sentiment_results.get("dominant_topic"),
            "dominant_topic_weight": sentiment_results.get("dominant_topic_weight"),
            "dominant_topic_percentage": sentiment_results.get("dominant_topic_percentage"),
            "topic_count": sentiment_results.get("topic_count", 0),
            "sentiment_by_topic": sentiment_results.get("sentiment_by_topic", {}),
            "topic_weights": sentiment_results.get("topic_weights", {}),
            **score_defs
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news/sources")
async def get_news_sources(ticker: str):
    """
    API endpoint to get news source reliability and sentiment breakdown.
    Returns metrics for each news source including reliability score based on:
    - Article volume (consistency)
    - Sentiment consistency
    - Coverage breadth
    Example: /api/news/sources?ticker=AAPL
    """
    try:
        # Fetch news articles
        news_articles = await news_service_instance.get_ticker_news(ticker)

        if not news_articles:
            return {"ticker": ticker, "sources": []}

        # Analyze sentiment to get scores
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Group articles by source
        source_map = {}
        for article in articles_with_sentiment:
            source = article.get("provider", "Unknown")
            if source not in source_map:
                source_map[source] = {
                    "name": source,
                    "articles": [],
                    "sentiment_scores": []
                }
            
            sentiment_score = article.get("sentiment_score_raw", 0)
            source_map[source]["articles"].append(article)
            source_map[source]["sentiment_scores"].append(sentiment_score)

        # Calculate metrics for each source
        sources = []
        total_articles = len(articles_with_sentiment)
        
        for source_name, source_data in source_map.items():
            article_count = len(source_data["articles"])
            sentiment_scores = source_data["sentiment_scores"]
            
            # Calculate average sentiment
            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
            
            # Calculate reliability score based on multiple factors:
            # 1. Volume factor (0-0.4): More articles = more reliable
            volume_factor = min(0.4, (article_count / total_articles) * 0.8)
            
            # 2. Consistency factor (0-0.3): Lower standard deviation = more consistent
            if len(sentiment_scores) > 1:
                mean = sum(sentiment_scores) / len(sentiment_scores)
                variance = sum((x - mean) ** 2 for x in sentiment_scores) / len(sentiment_scores)
                std_dev = variance ** 0.5
                # Normalize std_dev (0-1 range maps to 0.3-0 reliability)
                consistency_factor = max(0, 0.3 - (std_dev * 0.15))
            else:
                consistency_factor = 0.15  # Neutral for single article
            
            # 3. Base reliability (0.3): All sources start with base reliability
            base_reliability = 0.3
            
            # Total reliability score (0-1 scale)
            reliability = base_reliability + volume_factor + consistency_factor
            reliability = min(1.0, max(0.0, reliability))  # Clamp to 0-1
            
            sources.append({
                "name": source_name,
                "sentiment": avg_sentiment,
                "reliability": reliability,
                "articles": article_count,
                "consistency": 1.0 - min(1.0, std_dev) if len(sentiment_scores) > 1 else 0.5
            })

        # Sort by reliability (descending)
        sources.sort(key=lambda x: x["reliability"], reverse=True)

        return {
            "ticker": ticker,
            "sources": sources
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/daily-sentiment")
async def get_daily_sentiment(ticker: str, days: int = None, timeframe: str = None):
    """
    API endpoint to get daily sentiment data for a ticker.
    Supports configurable number of days OR timeframe (e.g., '1M', '6M', 'YTD', '1Y', '5Y')
    Example: /api/daily-sentiment?ticker=AAPL&timeframe=6M
    Example: /api/daily-sentiment?ticker=AAPL&days=30
    """
    try:
        from datetime import datetime, timedelta, timezone

        # Determine days from timeframe if provided
        if timeframe:
            timeframe_days_map = {
                '1D': 1,
                '1W': 7,
                '1M': 30,
                '3M': 90,
                '6M': 180,
                'YTD': None,  # Will be calculated
                '1Y': 365,
                '5Y': 1825
            }

            if timeframe == 'YTD':
                # Calculate days since start of year
                now = datetime.now(timezone.utc)
                start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)
                days = (now - start_of_year).days
            else:
                days = timeframe_days_map.get(timeframe, 30)
        elif days is None:
            # Default to 7 days if neither specified
            days = 7

        # Validate and cap days parameter
        days = min(max(days, 1), 1825)  # Max 5 years

        # Fetch news articles using timeframe-aware method if timeframe specified
        if timeframe:
            news_articles = await news_service_instance.get_ticker_news_for_timeframe(
                ticker,
                timeframe=timeframe,
                trigger_progressive=True
            )
        else:
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
    Supports: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y
    Uses progressive background fetching to pre-load future timeframes.

    Supports both individual stock tickers (e.g., AAPL) and sector identifiers
    (e.g., XLK, technology, ^SP500-45, Information Technology).

    Example: /api/rolling-sentiment?ticker=AAPL&timeframe=1W
    Example: /api/rolling-sentiment?ticker=XLK&timeframe=1W
    """
    try:
        from datetime import datetime, timedelta, timezone

        # Try to resolve as sector identifier first
        is_sector = False
        sector_key = None

        try:
            sector_key = sector_service_instance.resolve_sector_key(ticker)
            is_sector = True
            print(f"Resolved '{ticker}' as sector: {sector_key}")
        except ValueError:
            # Not a sector, treat as stock ticker
            is_sector = False
            print(f"Treating '{ticker}' as stock ticker")

        # Configure timeframe parameters for Rolling 24h Windows
        timeframe_configs = {
            '1D': {'hours': 24, 'interval_hours': 1, 'window_hours': 24},
            '1W': {'hours': 168, 'interval_hours': 6, 'window_hours': 24},
            '1M': {'hours': 720, 'interval_hours': 12, 'window_hours': 24},
            '3M': {'days': 90, 'interval_hours': 24, 'window_hours': 24},
            '6M': {'days': 180, 'interval_hours': 24, 'window_hours': 24},
            'YTD': {'days': (datetime.now(timezone.utc) - datetime(datetime.now(timezone.utc).year, 1, 1, tzinfo=timezone.utc)).days, 'interval_hours': 24, 'window_hours': 24},
            '1Y': {'days': 365, 'interval_hours': 24, 'window_hours': 24},
            '5Y': {'days': 1825, 'interval_hours': 24, 'window_hours': 24}
        }

        config = timeframe_configs.get(timeframe, timeframe_configs['1W'])

        if is_sector:
            # SECTOR PATH: Fetch aggregated sector news and calculate rolling sentiment
            print(f"Fetching sector rolling sentiment for: {sector_key} (timeframe: {timeframe})")

            # Get sector tickers
            tickers, _ = sector_service_instance.get_sector_tickers(sector_key)

            # Fetch aggregated sector news
            news_result = await news_service_instance.get_sector_news(
                sector_key=sector_key,
                limit=1000,
                timeframe=timeframe
            )

            articles = news_result.get('articles', [])

            if not articles:
                score_defs = get_score_definitions()
                return {
                    "ticker": ticker,
                    "timeframe": timeframe,
                    "data": [],
                    "has_data": False,
                    "message": "No news articles found for sector",
                    **score_defs
                }

            # Calculate rolling sector sentiment
            data_points = sector_sentiment_service.calculate_rolling_sector_sentiment(
                articles=articles,
                sector_tickers=tickers,
                timeframe=timeframe,
                interval_hours=config['interval_hours'],
                window_hours=config['window_hours']
            )

            has_data = any(point["volume"] > 0 for point in data_points)
            source_earliest_dates = None

        else:
            # STOCK PATH: Existing logic for individual stocks
            print(f"Fetching stock rolling sentiment for: {ticker} (timeframe: {timeframe})")

            # Fetch news articles using timeframe-aware method with progressive fetching
            news_articles = await news_service_instance.get_ticker_news_for_timeframe(
                ticker,
                timeframe=timeframe,
                trigger_progressive=True
            )

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
            data_points = []

            # Calculate number of data points based on config
            if 'days' in config:
                num_points = config['days'] * (24 // config['interval_hours'])
            else:
                num_points = config['hours'] // config['interval_hours']

            # Unified approach for all timeframes
            for i in range(num_points):
                point_time = now - timedelta(hours=i * config['interval_hours'])
                window_start = point_time - timedelta(hours=config['window_hours'])

                # Find articles published within this window using exact timestamps
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
                )[:10]

                # Format label based on timeframe and interval
                if timeframe == '1D':
                    label = point_time.strftime("%-I%p")
                elif timeframe == '1W':
                    label = point_time.strftime("%a %-I%p")
                elif timeframe == '1M':
                    label = point_time.strftime("%b %-d %-I%p")
                elif timeframe in ['3M', '6M']:
                    label = point_time.strftime("%b %-d")
                elif timeframe in ['YTD', '1Y']:
                    label = point_time.strftime("%b %-d")
                elif timeframe == '5Y':
                    label = point_time.strftime("%b %-d, %Y")
                else:
                    label = point_time.strftime("%b %-d")

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

            # Reverse to show oldest to newest
            data_points.reverse()

            # Check if we have sufficient data
            has_data = any(point["volume"] > 0 for point in data_points)

            # Extract source earliest dates metadata if available
            source_earliest_dates = None
            if articles_with_sentiment:
                for article in articles_with_sentiment:
                    if '_source_earliest_dates' in article:
                        source_earliest_dates = article['_source_earliest_dates']
                        break

        # Common return logic for both stocks and sectors
        score_defs = get_score_definitions()

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