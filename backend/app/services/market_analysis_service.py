# app/services/market_analysis_service.py

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


class MarketAnalysisService:
    """
    Service for analyzing market data and detecting significant events.
    Identifies large price moves, streaks, and correlates them with news.
    """

    def __init__(self):
        # Initialize NewsService for Alpha Vantage news fetching
        self.news_service = NewsService()

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

    @cache_result(ttl=3600, key_prefix="significant_events")  # Cache for 1 hour
    def analyze_significant_events(
        self,
        ticker: str,
        timeframe: str = "1Y",
        std_threshold: float = 2.0,
        event_count: int = None
    ) -> list[dict]:
        """
        Identifies significant price moves for a ticker and finds correlated news.
        Results are cached in Redis for 1 hour.

        This method:
        1. Fetches historical data for the specified timeframe
        2. Identifies price moves exceeding std_threshold * daily_std
        3. Groups consecutive moves in the same direction into "streaks"
        4. Ranks streaks by total magnitude
        5. Fetches news for the top events

        Args:
            ticker: Stock ticker symbol
            timeframe: Timeframe for analysis (1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y)
            std_threshold: Standard deviation multiplier for significance
            event_count: Number of top events to return (auto-determined if None)

        Returns:
            List of events with dates, move percentages, and related news
        """
        # Determine event count based on timeframe if not specified
        if event_count is None:
            event_count = 1 if timeframe == "1D" else 5
        
        # Map timeframe to yfinance period
        period_map = {
            "1D": "1d",
            "1W": "5d",
            "1M": "1mo",
            "3M": "3mo",
            "6M": "6mo",
            "YTD": "ytd",
            "1Y": "1y",
            "5Y": "5y"
        }
        period = period_map.get(timeframe, "1y")
        
        # 1. Fetch Data
        df = stock_data_service.get_stock_data(ticker, period=period)
        if df is None or df.empty:
            return []
        df = df.reset_index()

        # 2. Calculate Metrics
        df['pct_change'] = df['Close'].pct_change()
        daily_return_std = df['pct_change'].std()

        # 3. Find events with adaptive threshold to ensure we get the required count of non-overlapping events
        # For non-1D timeframes, we ensure we always get 5 non-overlapping events
        current_threshold = std_threshold
        selected_events = []
        
        # Try progressively lower thresholds until we get enough non-overlapping events
        while current_threshold > 0.5 and len(selected_events) < event_count:
            df['is_big_move'] = df['pct_change'].abs() > (current_threshold * daily_return_std)
            df['direction'] = np.sign(df['pct_change'])

            # Find and Group Events (Streaks)
            # A streak breaks when either the big_move status changes or direction changes
            streaks_broken = (df['is_big_move'] != df['is_big_move'].shift()) | \
                             (df['direction'] != df['direction'].shift())
            df['streak_id'] = streaks_broken.cumsum()

            # Filter to only big move streaks
            big_move_streaks = df[df['is_big_move'] == True]
            
            if not big_move_streaks.empty:
                # Group by streak and calculate total move
                grouped_streaks = big_move_streaks.groupby('streak_id').agg(
                    start_date=('Date', 'min'),
                    end_date=('Date', 'max'),
                    total_move_pct=('pct_change', 'sum')
                ).reset_index()
                
                # Rank by importance
                grouped_streaks['importance'] = grouped_streaks['total_move_pct'].abs()
                sorted_streaks = grouped_streaks.sort_values(by='importance', ascending=False)
                
                # Select non-overlapping events
                selected_events = []
                used_date_ranges = []
                
                for _, event in sorted_streaks.iterrows():
                    event_start = event['start_date']
                    event_end = event['end_date']
                    
                    # Check if this event overlaps with any already selected event
                    is_overlapping = False
                    for used_start, used_end in used_date_ranges:
                        # Check for any overlap
                        if not (event_end < used_start or event_start > used_end):
                            is_overlapping = True
                            break
                    
                    # If no overlap, add this event
                    if not is_overlapping:
                        selected_events.append(event)
                        used_date_ranges.append((event_start, event_end))
                        
                        # Stop if we have enough events
                        if len(selected_events) >= event_count:
                            break
                
                # Check if we have enough non-overlapping events
                if len(selected_events) >= event_count:
                    break
            
            # Lower threshold and try again
            current_threshold -= 0.25
        
        # If still no events found, return empty
        if not selected_events:
            return []
        
        # Convert to dataframe for consistency
        top_events = pd.DataFrame(selected_events)

        # 5. For each event, find the earliest date with consistent movement direction
        final_results = []
        for event in top_events.itertuples():
            # Determine the movement direction
            movement_direction = 1 if event.total_move_pct > 0 else -1
            
            # Find the earliest consecutive date with the same direction
            earliest_date = self._find_earliest_consistent_date(
                df, 
                event.start_date, 
                movement_direction
            )
            
            # Fetch news for the earliest date (±1 day window)
            news = self.fetch_alpha_vantage_news(ticker, earliest_date)
            
            final_results.append({
                "start_date": earliest_date.strftime('%Y-%m-%d'),
                "total_move_pct": event.total_move_pct,
                "news": news,
                "trend": "Upward" if event.total_move_pct > 0 else "Downward"
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
        # Calculate ±1 day window
        start_date = target_date - timedelta(days=1)
        end_date = target_date + timedelta(days=1)

        # Format dates for Alpha Vantage (YYYYMMDDTHHMM)
        time_from = start_date.strftime('%Y%m%dT0000')
        time_to = end_date.strftime('%Y%m%dT2359')

        try:
            # Use asyncio to run the async news fetching method
            async def fetch_news():
                async with aiohttp.ClientSession() as session:
                    articles = await self.news_service._fetch_alpha_vantage_news(
                        session=session,
                        ticker=ticker,
                        time_from=time_from,
                        time_to=time_to,
                        limit=50,  # Fetch up to 50 articles for the 3-day window
                        preserve_all_tickers=True  # Get full article data for modal display
                    )
                    return articles

            # Run the async function
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            articles = loop.run_until_complete(fetch_news())
            loop.close()

            if not articles:
                return []

            # Calculate polarization score (absolute product of sentiment and relevance)
            # and filter out articles with missing scores
            scored_articles = []
            for article in articles:
                # With preserve_all_tickers=True, sentiment is in ticker_sentiment array
                sentiment_score = None
                relevance_score = None
                
                # Extract sentiment for the queried ticker from ticker_sentiment array
                ticker_sentiments = article.get("ticker_sentiment", [])
                for ts in ticker_sentiments:
                    if ts.get("ticker", "").upper() == ticker.upper():
                        sentiment_score = ts.get("ticker_sentiment_score")
                        relevance_score = ts.get("relevance_score")
                        break
                
                # Skip articles without both scores for this ticker
                if sentiment_score is None or relevance_score is None:
                    continue
                
                # Calculate polarization: absolute product of sentiment and relevance
                polarization = abs(sentiment_score * relevance_score)
                
                scored_articles.append({
                    "article": article,
                    "polarization": polarization,
                    "sentiment_score": sentiment_score,
                    "relevance_score": relevance_score
                })
            
            # Sort by polarization (most polarizing first)
            scored_articles.sort(key=lambda x: x["polarization"], reverse=True)
            
            # Format the top 5 most polarizing articles for the response
            # Include all article data for the modal display
            formatted_news = []
            for item in scored_articles[:5]:  # Return top 5 most polarizing news items
                article = item["article"]
                formatted_article = {
                    # Basic fields for list display
                    "date": article.get("publish_date") or article.get("time_published"),
                    "title": article.get("title"),
                    "link": article.get("link") or article.get("url"),
                    "publisher": article.get("provider") or article.get("source"),
                    "sentiment_score": item["sentiment_score"],
                    "relevance_score": item["relevance_score"],
                    "polarization_score": item["polarization"],
                    
                    # Additional fields for modal display
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
                formatted_news.append(formatted_article)

            return formatted_news

        except Exception as e:
            print(f"Alpha Vantage API error for {ticker}: {e}")
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
