# app/services/market_analysis_service.py

import logging
import os
import numpy as np
import pandas as pd
import asyncio
import aiohttp
from datetime import datetime, timedelta
from dotenv import load_dotenv

from .stock_data_service import stock_data_service
from .news_service import NewsService
from app.core.cache import cache_result
from app.core.config import settings
from app.core.http_client import http_client

logger = logging.getLogger(__name__)


class MarketAnalysisService:
    """
    Service for analyzing market data and detecting significant events.
    Identifies large price moves, streaks, and correlates them with news.
    """

    # ETF ticker to sector index ticker mapping
    ETF_TO_SECTOR_MAP = {
        'XLK': '^SP500-45',  # Information Technology
        'XLV': '^SP500-35',  # Health Care
        'XLF': '^SP500-40',  # Financials
        'XLI': '^SP500-20',  # Industrials
        'XLY': '^SP500-25',  # Consumer Discretionary
        'XLP': '^SP500-30',  # Consumer Staples
        'XLE': '^GSPE',      # Energy
        'XLB': '^SP500-15',  # Materials
        'XLC': '^SP500-50',  # Communication Services
        'XLRE': '^SP500-60', # Real Estate
        'XLU': '^SP500-55',  # Utilities
    }

    def __init__(self):
        # Initialize NewsService for Alpha Vantage news fetching
        self.news_service = NewsService()

        # SPDR ETF tickers that represent S&P 500 sectors
        self.sector_etf_tickers = set(self.ETF_TO_SECTOR_MAP.keys())

    def detect_large_moves(self, df: pd.DataFrame, top_n: int = 5, threshold_std: float = 2.0) -> list[dict]:
        """
        Detects the largest price movements in a DataFrame.

        Args:
            df: DataFrame with 'Close' prices and datetime index
            top_n: Number of top moves to return
            threshold_std: Standard deviation threshold for "large" moves

        Returns:
            List of dictionaries with date and percent change
        """
        if df is None or df.empty:
            return []

        df = df.copy()
        df['pct_change'] = df['Close'].pct_change()

        # Filter for significant moves
        std = df['pct_change'].std()
        large_moves = df[df['pct_change'].abs() > (threshold_std * std)]

        # Sort by absolute change and take top N
        large_moves = large_moves.sort_values(by='pct_change', key=abs, ascending=False).head(top_n)

        moves = []
        for idx, row in large_moves.iterrows():
            moves.append({
                "date": idx.strftime("%Y-%m-%d") if hasattr(idx, 'strftime') else str(idx),
                "pct_change": float(row['pct_change']),
                "close": float(row['Close'])
            })

        return moves

    def _detect_price_streaks(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Detect consecutive price movement streaks in the same direction.

        Args:
            df: DataFrame with 'Close' prices and 'Date' column

        Returns:
            DataFrame with streak information (start_date, end_date, total_move_pct, num_days)
        """
        df = df.copy()
        df['pct_change'] = df['Close'].pct_change()
        df['direction'] = np.sign(df['pct_change'])

        # Find streaks - a streak breaks when direction changes
        direction_changes = (df['direction'] != df['direction'].shift())
        df['streak_id'] = direction_changes.cumsum()

        # Group streaks and calculate total move
        all_streaks = df.groupby('streak_id').agg(
            start_date=('Date', 'min'),
            end_date=('Date', 'max'),
            total_move_pct=('pct_change', 'sum'),
            num_days=('Date', 'count')
        ).reset_index()

        # Filter out very small movements
        all_streaks = all_streaks[
            (all_streaks['num_days'] >= 1) &
            (all_streaks['total_move_pct'].abs() > 0.001)
        ]

        return all_streaks

    def _select_non_overlapping_events(
        self,
        sorted_streaks: pd.DataFrame,
        event_count: int
    ) -> list[pd.Series]:
        """
        Select non-overlapping events above importance threshold.

        Args:
            sorted_streaks: DataFrame sorted by importance (descending)
            event_count: Minimum number of events to return

        Returns:
            List of selected event Series
        """
        if sorted_streaks.empty:
            return []

        # Determine threshold based on event_count
        if len(sorted_streaks) >= event_count:
            threshold_move = sorted_streaks.iloc[event_count - 1]['importance']
        else:
            threshold_move = 0.001

        selected_events = []
        used_date_ranges = []

        for _, event in sorted_streaks.iterrows():
            event_start = event['start_date']
            event_end = event['end_date']

            if event['importance'] < threshold_move:
                break

            # Check for overlap with selected events
            is_overlapping = any(
                not (event_end < used_start or event_start > used_end)
                for used_start, used_end in used_date_ranges
            )

            if not is_overlapping:
                selected_events.append(event)
                used_date_ranges.append((event_start, event_end))

        return selected_events

    def _filter_news_for_event(
        self,
        start_date: datetime,
        news_articles: list[dict]
    ) -> list[dict]:
        """
        Filter pre-fetched news articles within ±1 day window of event date.

        Args:
            start_date: Event start date
            news_articles: List of pre-fetched news articles

        Returns:
            Filtered list of news articles within the date window
        """
        from dateutil import parser as date_parser

        window_start = start_date - timedelta(days=1)
        window_end = start_date + timedelta(days=1)

        filtered_news = []
        for article in news_articles:
            try:
                article_date_str = article.get('publish_date') or article.get('time_published', '')
                if not article_date_str:
                    continue

                # Handle both formats: "YYYY-MM-DD" and "YYYYMMDDTHHMM"
                if 'T' in article_date_str:
                    article_date = date_parser.parse(article_date_str[:8])
                else:
                    article_date = date_parser.parse(article_date_str)

                if window_start <= article_date <= window_end:
                    filtered_news.append(article)
            except Exception as e:
                logger.debug("Error parsing article date: %s", e)
                continue

        return filtered_news

    @cache_result(ttl=3600, key_prefix="significant_events")  # Cache for 1 hour
    def analyze_significant_events(
        self,
        ticker: str,
        timeframe: str = "1Y",
        std_threshold: float = 2.0,
        event_count: int = None,
        news_articles: list[dict] = None
    ) -> list[dict]:
        """
        Identifies significant price moves for a ticker and finds correlated news.
        Results are cached in Redis for 1 hour.

        Args:
            ticker: Stock ticker symbol
            timeframe: Timeframe for analysis (1D, 1W, 1M, 3M, 6M, YTD, 1Y)
            std_threshold: Standard deviation multiplier for significance
            event_count: Number of top events to return (auto-determined if None)
            news_articles: Optional pre-fetched news articles to filter by date

        Returns:
            List of events with dates, move percentages, and related news
        """
        if event_count is None:
            event_count = 1 if timeframe == "1D" else 5

        # Map timeframe to yfinance period
        period_map = {
            "1D": "1d", "1W": "5d", "1M": "1mo", "3M": "3mo",
            "6M": "6mo", "YTD": "ytd", "1Y": "1y",
        }
        period = period_map.get(timeframe, "1y")

        # Fetch and prepare data
        df = stock_data_service.get_stock_data(ticker, period=period)
        if df is None or df.empty:
            return []
        df = df.reset_index()

        # Detect streaks and select top events
        all_streaks = self._detect_price_streaks(df)
        if all_streaks.empty:
            return []

        all_streaks['importance'] = all_streaks['total_move_pct'].abs()
        sorted_streaks = all_streaks.sort_values(by='importance', ascending=False)

        selected_events = self._select_non_overlapping_events(sorted_streaks, event_count)
        if not selected_events:
            return []

        # Build results with news for each event
        final_results = []
        for event in selected_events:
            start_date = pd.to_datetime(event['start_date'])
            end_date = pd.to_datetime(event['end_date'])

            logger.debug("Event: start=%s, end=%s, days=%d, move=%.2f%%",
                        start_date, end_date, event['num_days'], event['total_move_pct'])

            # Get news for this event
            if news_articles is not None:
                news = self._filter_news_for_event(start_date, news_articles)
                logger.debug("Filtered %d articles from cache for event on %s",
                           len(news), start_date.strftime('%Y-%m-%d'))
            elif ticker.upper() in self.sector_etf_tickers:
                logger.debug("Detected sector ETF %s, fetching aggregated constituent news", ticker)
                news = self.fetch_sector_aggregated_news(ticker, start_date)
            else:
                news = self.fetch_alpha_vantage_news(ticker, start_date)

            final_results.append({
                "start_date": start_date.strftime('%Y-%m-%d'),
                "end_date": end_date.strftime('%Y-%m-%d'),
                "total_move_pct": event['total_move_pct'],
                "news": news,
                "trend": "Upward" if event['total_move_pct'] > 0 else "Downward"
            })

        return final_results

    def _find_earliest_consistent_date(
        self, 
        df: pd.DataFrame, 
        event_start_date: datetime, 
        movement_direction: int
    ) -> datetime:
        """
        Find the earliest date before the event where the price movement
        is consistent with the event's direction.
        
        Args:
            df: DataFrame with price data and pct_change column
            event_start_date: The detected event start date
            movement_direction: 1 for upward, -1 for downward
            
        Returns:
            The earliest date with consistent movement direction
        """
        # Find the index of the event start date
        event_idx = df[df['Date'] == event_start_date].index
        if len(event_idx) == 0:
            return event_start_date
        
        event_idx = event_idx[0]
        earliest_idx = event_idx
        
        # Walk backwards to find consecutive days with same direction
        for i in range(event_idx - 1, -1, -1):
            current_direction = np.sign(df.loc[i, 'pct_change'])
            
            # Skip NaN values (first day has no pct_change)
            if pd.isna(current_direction):
                break
                
            # If direction matches, this could be an earlier start
            if current_direction == movement_direction:
                earliest_idx = i
            else:
                # Direction changed, stop looking
                break
        
        return df.loc[earliest_idx, 'Date']

    def _format_article_for_display(
        self,
        article: dict,
        sentiment_score: float,
        relevance_score: float,
        polarization: float
    ) -> dict:
        """
        Format a news article for display with sentiment scores.

        Args:
            article: Raw article data
            sentiment_score: Calculated sentiment score
            relevance_score: Calculated relevance score
            polarization: Calculated polarization score

        Returns:
            Formatted article dictionary
        """
        return {
            "date": article.get("publish_date") or article.get("time_published"),
            "title": article.get("title"),
            "link": article.get("link") or article.get("url"),
            "publisher": article.get("provider") or article.get("source"),
            "sentiment_score": sentiment_score,
            "relevance_score": relevance_score,
            "polarization_score": polarization,
            "url": article.get("url") or article.get("link"),
            "time_published": article.get("time_published") or article.get("publish_date"),
            "source": article.get("source") or article.get("provider"),
            "source_domain": article.get("source_domain"),
            "summary": article.get("summary"),
            "banner_image": article.get("banner_image"),
            "category_within_source": article.get("category_within_source"),
            "authors": article.get("authors", []),
            "overall_sentiment_score": article.get("overall_sentiment_score"),
            "overall_sentiment_label": article.get("overall_sentiment_label"),
            "topics": article.get("topics", []),
            "ticker_sentiment": article.get("ticker_sentiment", [])
        }

    def _score_articles_for_ticker(
        self,
        articles: list[dict],
        ticker: str
    ) -> list[dict]:
        """
        Score articles by polarization for a single ticker.

        Args:
            articles: List of articles to score
            ticker: Target ticker symbol

        Returns:
            List of scored articles sorted by polarization (descending)
        """
        scored_articles = []
        ticker_upper = ticker.upper()

        for article in articles:
            ticker_sentiments = article.get("ticker_sentiment", [])
            sentiment_score = None
            relevance_score = None

            for ts in ticker_sentiments:
                if ts.get("ticker", "").upper() == ticker_upper:
                    sentiment_score = ts.get("ticker_sentiment_score")
                    relevance_score = ts.get("relevance_score")
                    break

            if sentiment_score is None or relevance_score is None:
                continue

            polarization = abs(sentiment_score * relevance_score)
            scored_articles.append({
                "article": article,
                "polarization": polarization,
                "sentiment_score": sentiment_score,
                "relevance_score": relevance_score
            })

        scored_articles.sort(key=lambda x: x["polarization"], reverse=True)
        return scored_articles

    def _score_articles_for_sector(
        self,
        articles: list[dict],
        sector_tickers: list[str]
    ) -> list[dict]:
        """
        Score articles by average polarization across sector constituents.

        Args:
            articles: List of articles to score
            sector_tickers: List of ticker symbols to consider

        Returns:
            List of scored articles sorted by polarization (descending)
        """
        scored_articles = []
        sector_tickers_upper = {t.upper() for t in sector_tickers}

        for article in articles:
            ticker_sentiments = article.get("ticker_sentiment", [])

            # Collect sentiment data for relevant tickers
            relevant_sentiments = [
                ts for ts in ticker_sentiments
                if ts.get("ticker", "").upper() in sector_tickers_upper
            ]

            polarizations = []
            for ts in relevant_sentiments:
                sentiment = ts.get("ticker_sentiment_score")
                relevance = ts.get("relevance_score")
                if sentiment is not None and relevance is not None:
                    polarizations.append(abs(sentiment * relevance))

            if not polarizations:
                continue

            avg_polarization = sum(polarizations) / len(polarizations)
            avg_sentiment = sum(
                ts.get("ticker_sentiment_score", 0) for ts in relevant_sentiments
            ) / len(polarizations)
            avg_relevance = sum(
                ts.get("relevance_score", 0) for ts in relevant_sentiments
            ) / len(polarizations)

            scored_articles.append({
                "article": article,
                "polarization": avg_polarization,
                "sentiment_score": avg_sentiment,
                "relevance_score": avg_relevance
            })

        scored_articles.sort(key=lambda x: x["polarization"], reverse=True)
        return scored_articles

    def _deduplicate_articles_by_url(self, articles: list[dict]) -> list[dict]:
        """Remove duplicate articles based on URL."""
        seen_urls = set()
        unique_articles = []
        for article in articles:
            url = article.get("url") or article.get("link")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_articles.append(article)
        return unique_articles

    def fetch_sector_aggregated_news(
        self,
        ticker: str,
        target_date: datetime
    ) -> list[dict]:
        """
        Fetches aggregated news for a sector by querying top constituents.
        Used when the ticker is a sector ETF (e.g., XLK for Technology).

        Args:
            ticker: Sector ETF ticker symbol (e.g., XLK, XLF)
            target_date: Date to center the search around

        Returns:
            List of news articles aggregated from top constituents
        """
        try:
            sector_ticker = self.ETF_TO_SECTOR_MAP.get(ticker.upper())
            if not sector_ticker:
                return self.fetch_alpha_vantage_news(ticker, target_date)

            constituents = stock_data_service.get_sector_top_constituents(sector_ticker)
            if not constituents:
                logger.debug("No constituents found for sector %s, falling back to ETF news", sector_ticker)
                return self.fetch_alpha_vantage_news(ticker, target_date)

            top_tickers = [c['symbol'] for c in constituents[:5]]

            # Calculate ±1 day window
            start_date = target_date - timedelta(days=1)
            end_date = target_date + timedelta(days=1)
            time_from = start_date.strftime('%Y%m%dT0000')
            time_to = end_date.strftime('%Y%m%dT2359')

            # Fetch news for constituents in parallel
            async def fetch_all_constituent_news():
                session = await http_client.get_session()
                tasks = [
                    self.news_service._fetch_alpha_vantage_news(
                        session=session,
                        ticker=constituent_ticker,
                        time_from=time_from,
                        time_to=time_to,
                        limit=10,
                        preserve_all_tickers=True
                    )
                    for constituent_ticker in top_tickers
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                all_articles = []
                for result in results:
                    if isinstance(result, list):
                        all_articles.extend(result)
                return all_articles

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            articles = loop.run_until_complete(fetch_all_constituent_news())
            loop.close()

            if not articles:
                return []

            unique_articles = self._deduplicate_articles_by_url(articles)
            scored_articles = self._score_articles_for_sector(unique_articles, top_tickers)

            return [
                self._format_article_for_display(
                    item["article"],
                    item["sentiment_score"],
                    item["relevance_score"],
                    item["polarization"]
                )
                for item in scored_articles[:5]
            ]

        except Exception as e:
            logger.error("Error fetching sector aggregated news for %s: %s", ticker, e)
            return self.fetch_alpha_vantage_news(ticker, target_date)

    def fetch_alpha_vantage_news(
        self,
        ticker: str,
        target_date: datetime
    ) -> list[dict]:
        """
        Fetches news from Alpha Vantage API ±1 day around a specific date.

        Args:
            ticker: Stock ticker symbol
            target_date: Date to center the search around

        Returns:
            List of news articles
        """
        start_date = target_date - timedelta(days=1)
        end_date = target_date + timedelta(days=1)
        time_from = start_date.strftime('%Y%m%dT0000')
        time_to = end_date.strftime('%Y%m%dT2359')

        try:
            async def fetch_news():
                session = await http_client.get_session()
                return await self.news_service._fetch_alpha_vantage_news(
                    session=session,
                    ticker=ticker,
                    time_from=time_from,
                    time_to=time_to,
                    limit=50,
                    preserve_all_tickers=True
                )

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            articles = loop.run_until_complete(fetch_news())
            loop.close()

            if not articles:
                return []

            scored_articles = self._score_articles_for_ticker(articles, ticker)

            return [
                self._format_article_for_display(
                    item["article"],
                    item["sentiment_score"],
                    item["relevance_score"],
                    item["polarization"]
                )
                for item in scored_articles[:5]
            ]

        except Exception as e:
            logger.error("Alpha Vantage API error for %s: %s", ticker, e)
            return []

    def calculate_volatility(self, df: pd.DataFrame, window: int = 30) -> float:
        """
        Calculates rolling volatility for a stock.

        Args:
            df: DataFrame with 'Close' prices
            window: Rolling window size in days

        Returns:
            Current volatility (annualized standard deviation)
        """
        if df is None or df.empty:
            return 0.0

        df = df.copy()
        df['returns'] = df['Close'].pct_change()
        volatility = df['returns'].rolling(window=window).std().iloc[-1]

        # Annualize (assuming 252 trading days)
        return float(volatility * np.sqrt(252))


# Create a singleton instance
market_analysis_service = MarketAnalysisService()
