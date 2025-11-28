"""
Holding-level sentiment fetching for portfolio analysis.

This module handles:
- Fetching daily sentiment data for individual holdings
- Fetching rolling sentiment data for individual holdings
- Handling both stocks and ETFs/sectors
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)


async def fetch_holding_daily_sentiment(
    ticker: str,
    sentiment_service,
    news_service,
    days: int = None,
    timeframe: str = None
) -> Optional[Dict]:
    """
    Fetches daily sentiment data for a single holding.

    Args:
        ticker: Stock/ETF ticker symbol
        sentiment_service: Sentiment service instance
        news_service: News service instance
        days: Number of days to fetch
        timeframe: Timeframe string (e.g., '1M', '6M', 'YTD', '1Y')

    Returns:
        Dictionary with ticker, daily data, and metadata or None on error
    """
    try:
        if timeframe:
            timeframe_days_map = {
                '1D': 1,
                '1W': 7,
                '1M': 30,
                '3M': 90,
                '6M': 180,
                'YTD': None,
                '1Y': 365,
                '5Y': 1825,
                '10Y': 3650,
                'MAX': 7300
            }

            if timeframe == 'YTD':
                now = datetime.now(timezone.utc)
                start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)
                days = (now - start_of_year).days
            else:
                days = timeframe_days_map.get(timeframe, 30)

            news_articles = await news_service.get_ticker_news_for_timeframe(
                ticker,
                timeframe=timeframe,
                trigger_progressive=True
            )
        else:
            days = days or 7
            news_articles = await news_service.get_ticker_news(ticker)

        days = min(max(days, 1), 7300)

        # Initialize daily data
        today = datetime.now(timezone.utc).date()
        daily_data = {}
        for i in range(days):
            date = today - timedelta(days=days - 1 - i)
            date_str = date.strftime("%Y-%m-%d")
            daily_data[date_str] = {"score": 0, "count": 0, "headlines": []}

        if not news_articles:
            return {"ticker": ticker, "daily": daily_data, "metadata": None}

        # Analyze sentiment with full momentum analytics
        momentum_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)
        articles_with_sentiment = momentum_results.get("articles_with_sentiment", [])

        # Extract comprehensive metadata
        metadata = _extract_holding_metadata(momentum_results)

        # Group by date
        for article in articles_with_sentiment:
            date = article.get("publish_date")
            if not date or date not in daily_data:
                continue

            sentiment_score = article.get("sentiment_score_raw", 0)
            daily_data[date]["score"] += sentiment_score
            daily_data[date]["count"] += 1

            daily_data[date]["headlines"].append({
                "title": article.get("title", ""),
                "provider": article.get("provider", "Unknown"),
                "sentiment_score": sentiment_score,
                "sentiment_label": article.get("sentiment_label", "Neutral"),
                "link": article.get("link", ""),
                "relevance_score": article.get("ticker_relevance_score", 0)
            })

        # Calculate averages
        for date, data in daily_data.items():
            if data["count"] > 0:
                data["score"] = data["score"] / data["count"]
            data["headlines"].sort(
                key=lambda x: abs(x.get("sentiment_score", 0)) * max(0.0001, x.get("relevance_score", 1.0)),
                reverse=True
            )

        return {
            "ticker": ticker,
            "daily": daily_data,
            "metadata": metadata
        }

    except Exception as e:
        print(f"Error fetching daily sentiment for {ticker}: {e}")
        return None


async def fetch_holding_rolling_sentiment(
    ticker: str,
    sentiment_service,
    news_service,
    timeframe: str = "1W"
) -> Optional[Dict]:
    """
    Fetches rolling sentiment data for a single holding.

    Args:
        ticker: Stock/ETF ticker symbol
        sentiment_service: Sentiment service instance
        news_service: News service instance
        timeframe: Timeframe string (e.g., '1W', '1M', '3M', '6M', '1Y')

    Returns:
        Dictionary with timeframe and data points or None on error
    """
    try:
        # Check if this is a sector/ETF
        is_sector = False
        sector_key = None

        try:
            from app.services.sector_service import sector_service_instance
            sector_key = sector_service_instance.resolve_sector_key(ticker)
            is_sector = True
        except KeyError:
            is_sector = False
        except Exception as e:
            logger.warning(f"Error resolving sector key for {ticker}: {e}")
            is_sector = False

        # Configure timeframe parameters
        timeframe_configs = {
            '1D': {'hours': 24, 'interval_hours': 1, 'window_hours': 24},
            '1W': {'hours': 168, 'interval_hours': 6, 'window_hours': 24},
            '1M': {'hours': 720, 'interval_hours': 12, 'window_hours': 24},
            '3M': {'days': 90, 'interval_hours': 24, 'window_hours': 24},
            '6M': {'days': 180, 'interval_hours': 24, 'window_hours': 24},
            'YTD': {
                'days': (datetime.now(timezone.utc) - datetime(datetime.now(timezone.utc).year, 1, 1, tzinfo=timezone.utc)).days,
                'interval_hours': 24,
                'window_hours': 24
            },
            '1Y': {'days': 365, 'interval_hours': 24, 'window_hours': 24},
            '5Y': {'days': 1825, 'interval_hours': 24, 'window_hours': 24},
            '10Y': {'days': 3650, 'interval_hours': 48, 'window_hours': 168},
            'MAX': {'days': 7300, 'interval_hours': 168, 'window_hours': 720}
        }

        config = timeframe_configs.get(timeframe, timeframe_configs['1W'])

        # Apply sector limits
        effective_timeframe = timeframe
        if is_sector:
            effective_timeframe = timeframe if timeframe in ['1D', '1W', '1M'] else '1M'
            config = timeframe_configs.get(effective_timeframe, timeframe_configs['1M'])

        # Fetch news
        if is_sector:
            from app.services.sector_service import sector_service_instance
            news_articles = await sector_service_instance.get_sector_news(
                sector_key,
                days=config.get('days', config.get('hours', 24) // 24)
            )
        else:
            news_articles = await news_service.get_ticker_news_for_timeframe(
                ticker,
                timeframe=effective_timeframe,
                trigger_progressive=True
            )

        if not news_articles:
            return {"timeframe": effective_timeframe, "data": []}

        # Generate time windows
        now = datetime.now(timezone.utc)
        if 'days' in config:
            start_time = now - timedelta(days=config['days'])
        else:
            start_time = now - timedelta(hours=config['hours'])

        time_windows = []
        current_time = start_time

        while current_time <= now:
            window_end = current_time + timedelta(hours=config['window_hours'])
            time_windows.append({
                'start': current_time,
                'end': window_end,
                'timestamp': current_time.isoformat(),
                'articles': [],
                'score': 0,
                'article_count': 0
            })
            current_time += timedelta(hours=config['interval_hours'])

        # Analyze sentiment
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Assign articles to windows
        for article in articles_with_sentiment:
            pub_date_str = article.get("publish_date")
            if not pub_date_str:
                continue

            try:
                pub_date = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))
                if pub_date.tzinfo is None:
                    pub_date = pub_date.replace(tzinfo=timezone.utc)

                for window in time_windows:
                    if window['start'] <= pub_date < window['end']:
                        window['articles'].append(article)
                        window['score'] += article.get("sentiment_score_raw", 0)
                        window['article_count'] += 1

            except Exception:
                continue

        # Calculate window averages and momentum
        data_points = []
        prev_score = None

        for window in time_windows:
            if window['article_count'] > 0:
                avg_score = window['score'] / window['article_count']
            else:
                avg_score = 0

            momentum = 0
            if prev_score is not None:
                momentum = avg_score - prev_score

            headlines = []
            for article in window['articles']:
                headlines.append({
                    "title": article.get("title", ""),
                    "provider": article.get("provider", "Unknown"),
                    "sentiment_score": article.get("sentiment_score_raw", 0),
                    "sentiment_label": article.get("sentiment_label", "Neutral"),
                    "link": article.get("link", ""),
                    "relevance_score": article.get("ticker_relevance_score", 0),
                    "publish_date": article.get("publish_date", "")
                })

            headlines.sort(
                key=lambda x: abs(x.get("sentiment_score", 0)) * max(0.0001, x.get("relevance_score", 1.0)),
                reverse=True
            )

            data_points.append({
                'timestamp': window['timestamp'],
                'score': avg_score,
                'article_count': window['article_count'],
                'momentum': momentum,
                'headlines': headlines
            })

            prev_score = avg_score

        return {
            "timeframe": effective_timeframe,
            "data": data_points
        }

    except Exception as e:
        print(f"Error fetching rolling sentiment for {ticker}: {e}")
        return None


def _extract_holding_metadata(momentum_results: Dict) -> Dict:
    """Extract comprehensive metadata from momentum results."""
    return {
        # Fast/Slow Scores and Momentum
        "fast_score": momentum_results.get("fast_score"),
        "slow_score": momentum_results.get("slow_score"),
        "overall_weighted_score": momentum_results.get("overall_weighted_score"),
        "sentiment_momentum": momentum_results.get("sentiment_momentum"),
        "momentum_label": momentum_results.get("momentum_label"),
        "momentum_interpretation": momentum_results.get("momentum_interpretation"),
        "momentum_quality": momentum_results.get("momentum_quality"),
        "half_life_fast_hours": momentum_results.get("half_life_fast_hours"),
        "half_life_slow_hours": momentum_results.get("half_life_slow_hours"),

        # News Coverage Quality
        "effective_news_volume": momentum_results.get("effective_news_volume"),
        "volume_interpretation": momentum_results.get("volume_interpretation"),

        # Sentiment Breadth
        "sentiment_breadth_score": momentum_results.get("sentiment_breadth_score"),
        "num_bullish_articles": momentum_results.get("num_bullish_articles", 0),
        "num_bearish_articles": momentum_results.get("num_bearish_articles", 0),
        "total_directional_articles": momentum_results.get("total_directional_articles", 0),
        "breadth_interpretation": momentum_results.get("breadth_interpretation"),
        "breadth_quality": momentum_results.get("breadth_quality"),

        # Sentiment Shock (Z-Score)
        "sentiment_z_score": momentum_results.get("sentiment_z_score"),
        "z_score_interpretation": momentum_results.get("z_score_interpretation"),
        "z_score_historical_mean": momentum_results.get("z_score_historical_mean"),
        "z_score_historical_std": momentum_results.get("z_score_historical_std"),
        "z_score_days_of_history": momentum_results.get("z_score_days_of_history", 0),
        "z_score_quality": momentum_results.get("z_score_quality"),

        # Volatility Metrics
        "sentiment_volatility": momentum_results.get("sentiment_volatility"),
        "volatility_quality": momentum_results.get("volatility_quality"),

        # Data Quality
        "data_quality": momentum_results.get("data_quality"),

        # Source Concentration
        "source_concentration_hhi": momentum_results.get("source_concentration_hhi"),
        "concentration_interpretation": momentum_results.get("concentration_interpretation"),
        "dominant_source": momentum_results.get("top_sources", [{}])[0].get("source") if momentum_results.get("top_sources") else None,
        "top_sources": momentum_results.get("top_sources", []),
        "source_breakdown": {
            source["source"]: source["percentage"]
            for source in momentum_results.get("top_sources", [])
        },

        # Topic Analysis
        "dominant_topic": momentum_results.get("dominant_topic"),
        "topic_distribution": momentum_results.get("topic_weights", {}),
        "sentiment_by_topic": momentum_results.get("sentiment_by_topic", {})
    }
