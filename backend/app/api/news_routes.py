# app/api/news_routes.py
"""
News and sentiment analysis routes.

Endpoints:
- GET /news - Get news and sentiment for a ticker with momentum analysis
- GET /news/sources - Get news source reliability and sentiment breakdown
- GET /daily-sentiment - Get daily sentiment data for charting
- GET /rolling-sentiment - Get rolling-window sentiment data
- GET /news-models - Get news using proper model structure
- GET /price - Get historical price data with company metadata
"""

import copy
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
import yfinance as yf

from app.services.news_service import news_service_instance
from app.services.stock_data_service import stock_data_service
from app.services.sentiment_service import sentiment_service
from app.services.sector_service import sector_service_instance
from app.services.sector_sentiment_service import sector_sentiment_service
from app.core.cache import redis_cache, async_cache_result
from app.core.config import settings
from app.config.scoring import get_score_definitions

logger = logging.getLogger(__name__)

router = APIRouter(tags=["News & Sentiment"])


@router.get("/news")
async def get_news_data(ticker: str, timeframe: str = "1Y"):
    """
    Get recent news and sentiment for a ticker with momentum analysis.

    Args:
        ticker: Stock ticker symbol
        timeframe: Time range for news (1D, 1W, 1M, 3M, 6M, YTD, 1Y) - default: 1Y

    Returns comprehensive sentiment data including:
    - feed: Raw Alpha Vantage feed data with all details
    - news: Formatted/simplified news articles
    - avg_score: Overall weighted sentiment score (slow/24h trend)
    - fast_score: Current intraday sentiment (7h half-life)
    - slow_score: Daily trend sentiment (24h half-life)
    - sentiment_momentum: fast_score - slow_score
    - momentum_label: Classification (e.g., "Positive Momentum")
    - momentum_interpretation: Human-readable description
    - Source & topic analysis metrics

    Example: /news?ticker=AAPL&timeframe=1Y
    """
    try:
        # Fetch news articles using the timeframe-aware news service
        news_articles = await news_service_instance.get_ticker_news_for_timeframe(
            ticker,
            timeframe=timeframe,
            trigger_progressive=True,
            preserve_all_tickers=True
        )

        # Preserve the original format for raw_feed
        raw_feed = copy.deepcopy(news_articles) if news_articles else []

        # Extract ticker-specific sentiment from ticker_sentiment array
        if news_articles:
            for article in news_articles:
                if "ticker_sentiment" in article and isinstance(article["ticker_sentiment"], list):
                    for ts in article["ticker_sentiment"]:
                        if ts.get("ticker", "").upper() == ticker.upper():
                            article["ticker_sentiment_score"] = float(ts.get("ticker_sentiment_score", 0.0))
                            article["ticker_sentiment_label"] = ts.get("ticker_sentiment_label", "Neutral")
                            article["ticker_relevance_score"] = float(ts.get("relevance_score", 0.0))
                            break

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

        # Analyze sentiment WITH MOMENTUM
        sentiment_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Format news for frontend
        formatted_news = []
        for article in articles_with_sentiment:
            news_item = {
                "title": article.get("title", ""),
                "provider": article.get("source_domain", article.get("provider", "Unknown")),
                "sentiment_score": article.get("sentiment_score_raw", 0),
                "sentiment_label": article.get("sentiment_label", "Neutral"),
                "link": article.get("link", ""),
                "publish_date": article.get("publish_date", ""),
                "publish_timestamp": article.get("publish_timestamp", ""),
                "image": article.get("banner_image", article.get("image", ""))
            }

            relevance_score = article.get("ticker_relevance_score")
            if relevance_score is not None and relevance_score > 0:
                news_item["relevance_score"] = relevance_score

            formatted_news.append(news_item)

        score_defs = get_score_definitions()

        return {
            "ticker": ticker,
            "news": formatted_news,
            "feed": raw_feed,
            "items": str(len(raw_feed)),
            "avg_score": sentiment_results.get("overall_weighted_score", 0),
            # Momentum fields
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
            # Volatility fields
            "sentiment_volatility": sentiment_results.get("sentiment_volatility"),
            "volatility_quality": sentiment_results.get("volatility_quality"),
            # Effective news volume
            "effective_news_volume": sentiment_results.get("effective_news_volume"),
            "volume_interpretation": sentiment_results.get("volume_interpretation"),
            # Breadth metrics
            "sentiment_breadth_score": sentiment_results.get("sentiment_breadth_score"),
            "num_bullish_articles": sentiment_results.get("num_bullish_articles"),
            "num_bearish_articles": sentiment_results.get("num_bearish_articles"),
            "total_directional_articles": sentiment_results.get("total_directional_articles"),
            "breadth_interpretation": sentiment_results.get("breadth_interpretation"),
            "breadth_quality": sentiment_results.get("breadth_quality"),
            # Z-Score metrics
            "sentiment_z_score": sentiment_results.get("sentiment_z_score"),
            "z_score_interpretation": sentiment_results.get("z_score_interpretation"),
            "z_score_historical_mean": sentiment_results.get("z_score_historical_mean"),
            "z_score_historical_std": sentiment_results.get("z_score_historical_std"),
            "z_score_days_of_history": sentiment_results.get("z_score_days_of_history"),
            "z_score_quality": sentiment_results.get("z_score_quality"),
            # Source & Topic Analysis
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
        logger.error(f"Error fetching news for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/news/sources")
async def get_news_sources(ticker: str):
    """
    Get news source reliability and sentiment breakdown.

    Returns metrics for each news source including reliability score based on:
    - Article volume (consistency)
    - Sentiment consistency
    - Coverage breadth

    Example: /news/sources?ticker=AAPL
    """
    try:
        news_articles = await news_service_instance.get_ticker_news(ticker)

        if not news_articles:
            return {"ticker": ticker, "sources": []}

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

            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0

            # Calculate reliability score
            volume_factor = min(0.4, (article_count / total_articles) * 0.8)

            if len(sentiment_scores) > 1:
                mean = sum(sentiment_scores) / len(sentiment_scores)
                variance = sum((x - mean) ** 2 for x in sentiment_scores) / len(sentiment_scores)
                std_dev = variance ** 0.5
                consistency_factor = max(0, 0.3 - (std_dev * 0.15))
            else:
                consistency_factor = 0.15
                std_dev = 0

            base_reliability = 0.3
            reliability = min(1.0, max(0.0, base_reliability + volume_factor + consistency_factor))

            sources.append({
                "name": source_name,
                "sentiment": avg_sentiment,
                "reliability": reliability,
                "articles": article_count,
                "consistency": 1.0 - min(1.0, std_dev) if len(sentiment_scores) > 1 else 0.5
            })

        sources.sort(key=lambda x: x["reliability"], reverse=True)

        return {"ticker": ticker, "sources": sources}

    except Exception as e:
        logger.error(f"Error fetching news sources for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/daily-sentiment")
@async_cache_result(ttl=600, key_prefix="daily_sentiment")
async def get_daily_sentiment(ticker: str, days: int = None, timeframe: str = None):
    """
    Get daily sentiment data for a ticker.

    Supports configurable number of days OR timeframe.

    Args:
        ticker: Stock ticker symbol
        days: Number of days to fetch (1-7300)
        timeframe: Time range - '1M', '6M', 'YTD', '1Y', '5Y', '10Y', 'MAX'

    Returns:
        Daily sentiment scores with headlines grouped by date

    Example: /daily-sentiment?ticker=AAPL&timeframe=6M
    """
    try:
        # Determine days from timeframe if provided
        if timeframe:
            timeframe_days_map = {
                '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180,
                'YTD': None, '1Y': 365, '5Y': 1825, '10Y': 3650, 'MAX': 7300
            }

            if timeframe == 'YTD':
                now = datetime.now(timezone.utc)
                start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)
                days = (now - start_of_year).days
            else:
                days = timeframe_days_map.get(timeframe, 30)
        elif days is None:
            days = 7

        days = min(max(days, 1), 7300)

        # Fetch news articles
        if timeframe:
            news_articles = await news_service_instance.get_ticker_news_for_timeframe(
                ticker, timeframe=timeframe, trigger_progressive=True
            )
        else:
            news_articles = await news_service_instance.get_ticker_news(ticker)

        # Initialize all requested days with empty data
        today = datetime.now(timezone.utc).date()
        daily_data = {}
        for i in range(days):
            date = today - timedelta(days=days - 1 - i)
            date_str = date.strftime("%Y-%m-%d")
            daily_data[date_str] = {"score": 0, "count": 0, "headlines": []}

        score_defs = get_score_definitions()

        if not news_articles:
            empty_metadata = {
                "source_concentration_hhi": None,
                "concentration_interpretation": None,
                "dominant_source": None,
                "dominant_topic": None,
                "topic_distribution": {},
                "source_breakdown": {}
            }
            return {"ticker": ticker, "daily": daily_data, "metadata": empty_metadata, **score_defs}

        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Get topic/source metadata
        momentum_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)
        metadata = {
            "source_concentration_hhi": momentum_results.get("source_concentration_hhi"),
            "concentration_interpretation": momentum_results.get("concentration_interpretation"),
            "dominant_source": momentum_results.get("top_sources", [{}])[0].get("source") if momentum_results.get("top_sources") else None,
            "dominant_topic": momentum_results.get("dominant_topic"),
            "topic_distribution": momentum_results.get("topic_weights", {}),
            "source_breakdown": {
                source["source"]: source["percentage"]
                for source in momentum_results.get("top_sources", [])
            }
        }

        # Group articles by date
        for article in articles_with_sentiment:
            date = article.get("publish_date")
            if not date or date not in daily_data:
                continue

            sentiment_score = article.get("sentiment_score_raw", 0)
            daily_data[date]["score"] += sentiment_score
            daily_data[date]["count"] += 1

            headline_item = {
                "title": article.get("title", ""),
                "provider": article.get("provider", "Unknown"),
                "sentiment_score": sentiment_score,
                "sentiment_label": article.get("sentiment_label", "Neutral"),
                "link": article.get("link", "")
            }

            relevance_score = article.get("ticker_relevance_score")
            if relevance_score is not None and relevance_score > 0:
                headline_item["relevance_score"] = relevance_score

            daily_data[date]["headlines"].append(headline_item)

        # Calculate averages and sort headlines
        for date, data in daily_data.items():
            if data["count"] > 0:
                data["score"] = data["score"] / data["count"]
            data["headlines"].sort(
                key=lambda x: abs(x.get("sentiment_score", 0)) * max(0.0001, x.get("relevance_score", 1.0)),
                reverse=True
            )

        return {"ticker": ticker, "daily": daily_data, "metadata": metadata, **score_defs}

    except Exception as e:
        logger.error(f"Error fetching daily sentiment for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/rolling-sentiment")
async def get_rolling_sentiment(ticker: str, timeframe: str = "1W"):
    """
    Get rolling-window sentiment data for different timeframes.

    Supports both individual stock tickers and sector identifiers.

    Args:
        ticker: Stock ticker (e.g., AAPL) or sector identifier (e.g., XLK, technology)
        timeframe: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y, 10Y, MAX

    Returns:
        Rolling sentiment data points with timestamps and headlines

    Example: /rolling-sentiment?ticker=AAPL&timeframe=1W
    """
    try:
        # Try to resolve as sector identifier first
        is_sector = False
        sector_key = None

        try:
            sector_key = sector_service_instance.resolve_sector_key(ticker)
            is_sector = True
            logger.debug(f"Resolved '{ticker}' as sector: {sector_key}")
        except ValueError:
            is_sector = False

        # Configure timeframe parameters
        timeframe_configs = {
            '1D': {'hours': 24, 'interval_hours': 1, 'window_hours': 24},
            '1W': {'hours': 168, 'interval_hours': 6, 'window_hours': 24},
            '1M': {'hours': 720, 'interval_hours': 12, 'window_hours': 24},
            '3M': {'days': 90, 'interval_hours': 24, 'window_hours': 24},
            '6M': {'days': 180, 'interval_hours': 24, 'window_hours': 24},
            'YTD': {'days': (datetime.now(timezone.utc) - datetime(datetime.now(timezone.utc).year, 1, 1, tzinfo=timezone.utc)).days, 'interval_hours': 24, 'window_hours': 24},
            '1Y': {'days': 365, 'interval_hours': 24, 'window_hours': 24},
            '5Y': {'days': 1825, 'interval_hours': 24, 'window_hours': 24},
            '10Y': {'days': 3650, 'interval_hours': 48, 'window_hours': 168},
            'MAX': {'days': 7300, 'interval_hours': 168, 'window_hours': 720}
        }

        config = timeframe_configs.get(timeframe, timeframe_configs['1W'])

        # SECTOR LIMIT: Cap at 1M for sectors
        effective_timeframe = timeframe
        if is_sector:
            effective_timeframe = timeframe if timeframe in ['1D', '1W', '1M'] else '1M'

        score_defs = get_score_definitions()

        if is_sector:
            # SECTOR PATH
            tickers, _ = sector_service_instance.get_sector_tickers(sector_key)

            news_result = await news_service_instance.get_sector_news(
                sector_key=sector_key,
                limit=5000,
                timeframe=effective_timeframe
            )

            articles = news_result.get('articles', [])

            if not articles:
                return {
                    "ticker": ticker,
                    "timeframe": effective_timeframe,
                    "data": [],
                    "has_data": False,
                    "message": "No news articles found for sector",
                    **score_defs
                }

            sector_config = timeframe_configs.get(effective_timeframe, timeframe_configs['1W'])
            data_points = sector_sentiment_service.calculate_rolling_sector_sentiment(
                articles=articles,
                sector_tickers=tickers,
                timeframe=effective_timeframe,
                interval_hours=sector_config['interval_hours'],
                window_hours=sector_config['window_hours']
            )

            has_data = any(point["volume"] > 0 for point in data_points)
            source_earliest_dates = None

        else:
            # STOCK PATH
            news_articles = await news_service_instance.get_ticker_news_for_timeframe(
                ticker, timeframe=timeframe, trigger_progressive=True
            )

            if not news_articles:
                return {
                    "ticker": ticker,
                    "timeframe": timeframe,
                    "data": [],
                    "message": "No news articles found",
                    **score_defs
                }

            sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
            articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

            now = datetime.now(timezone.utc)
            data_points = []

            if 'days' in config:
                num_points = config['days'] * (24 // config['interval_hours'])
            else:
                num_points = config['hours'] // config['interval_hours']

            for i in range(num_points):
                point_time = now - timedelta(hours=i * config['interval_hours'])
                window_start = point_time - timedelta(hours=config['window_hours'])

                window_articles = []
                for a in articles_with_sentiment:
                    pub_timestamp_str = a.get("publish_timestamp")
                    if pub_timestamp_str:
                        try:
                            pub_timestamp = datetime.fromisoformat(pub_timestamp_str)
                            if pub_timestamp.tzinfo is None:
                                pub_timestamp = pub_timestamp.replace(tzinfo=timezone.utc)
                            if window_start <= pub_timestamp <= point_time:
                                window_articles.append(a)
                        except Exception:
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
                    key=lambda x: abs(x.get("sentiment_score_raw", 0)) * x.get("relevance_score", 1.0),
                    reverse=True
                )

                # Format label based on timeframe
                hour = point_time.strftime("%I").lstrip("0")
                day = str(point_time.day)

                if timeframe == '1D':
                    label = f"{hour}{point_time.strftime('%p')}"
                elif timeframe == '1W':
                    label = f"{point_time.strftime('%a')} {hour}{point_time.strftime('%p')}"
                elif timeframe == '1M':
                    label = f"{point_time.strftime('%b')} {day} {hour}{point_time.strftime('%p')}"
                elif timeframe in ['3M', '6M', 'YTD', '1Y']:
                    label = f"{point_time.strftime('%b')} {day}"
                elif timeframe == '5Y':
                    label = f"{point_time.strftime('%b')} {day}, {point_time.year}"
                else:
                    label = f"{point_time.strftime('%b')} {day}"

                data_points.append({
                    "timestamp": point_time.isoformat(),
                    "label": label,
                    "volume": volume,
                    "sentiment": avg_sentiment,
                    "headlines": [{
                        "title": h.get("title", ""),
                        "provider": h.get("provider", "Unknown"),
                        "sentiment_score": h.get("sentiment_score_raw", 0),
                        "relevance_score": h.get("relevance_score", 1.0),
                        "link": h.get("link", "")
                    } for h in top_headlines]
                })

            data_points.reverse()
            has_data = any(point["volume"] > 0 for point in data_points)

            source_earliest_dates = None
            if articles_with_sentiment:
                for article in articles_with_sentiment:
                    if '_source_earliest_dates' in article:
                        source_earliest_dates = article['_source_earliest_dates']
                        break

        response_data = {
            "ticker": ticker,
            "timeframe": effective_timeframe,
            "data": data_points,
            "has_data": has_data,
            **score_defs
        }

        if source_earliest_dates:
            response_data["source_earliest_dates"] = source_earliest_dates

        return response_data

    except Exception as e:
        logger.error(f"Error fetching rolling sentiment for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/news-models")
async def get_news_models(ticker: str):
    """
    Get news using the proper model structure (News, SentimentScore, RelevanceScore).

    Example: /news-models?ticker=AAPL
    """
    try:
        news_articles = await news_service_instance.get_ticker_news(ticker)

        score_defs = get_score_definitions()

        if not news_articles:
            return {"ticker": ticker, "news": [], "message": "No news found", **score_defs}

        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        news_objects = sentiment_results.get("news_objects", [])

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
        logger.error(f"Error fetching news models for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/price")
def get_price_data(ticker: str, timeframe: str = "1Y"):
    """
    Get historical price data for a ticker with company metadata.

    Args:
        ticker: Stock ticker symbol
        timeframe: Time period - 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y

    Returns:
        Price data array with company info and previous close

    Example: /price?ticker=AAPL&timeframe=1Y
    """
    try:
        # Use Redis cache
        cache_key = f"price:{ticker.upper()}:{timeframe}"
        try:
            cached_response = redis_cache.get(cache_key)
            if cached_response is not None:
                return cached_response
        except Exception:
            pass

        # Fetch stock data
        if timeframe == "1D":
            stock_data = stock_data_service.get_stock_data(ticker, period="1d", interval="1m")
        else:
            stock_data = stock_data_service.get_stock_data(ticker, period="5y", interval="1d")

        if stock_data is None or stock_data.empty:
            raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}")

        filtered_data = stock_data_service.filter_data_by_timeframe(stock_data, timeframe)

        company_info = stock_data_service.get_company_info(ticker)
        ticker_obj = yf.Ticker(ticker)
        ticker_info = ticker_obj.info

        # Calculate previous close for 1D
        prev_close = None
        if timeframe == "1D" and len(stock_data) > 0:
            try:
                hist_5d = ticker_obj.history(period="5d", interval="1d")
                if len(hist_5d) >= 2:
                    prev_close = float(hist_5d['Close'].iloc[-2])
                elif len(hist_5d) == 1:
                    prev_close = float(hist_5d['Close'].iloc[0])
            except Exception as e:
                logger.warning(f"Error fetching previous close for {ticker}: {e}")

        # Convert to frontend format
        prices = []
        for idx, row in filtered_data.iterrows():
            price_item = {
                "date": idx.strftime("%Y-%m-%d"),
                "price": float(row['Close']),
                "close": float(row['Close'])
            }
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

        if prev_close is not None:
            response["prev_close"] = prev_close

        # Cache the response
        try:
            ttl = settings.PRICE_CACHE_TTL if timeframe != "1D" else max(30, int(settings.PRICE_CACHE_TTL / 10))
            redis_cache.set(cache_key, response, ttl=ttl)
        except Exception as e:
            logger.warning(f"Failed to cache price data for {ticker}: {e}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching price data for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")
