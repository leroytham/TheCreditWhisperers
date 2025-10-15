# app/services/market_analysis_service.py

import os
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

from .stock_data_service import stock_data_service


class MarketAnalysisService:
    """
    Service for analyzing market data and detecting significant events.
    Identifies large price moves, streaks, and correlates them with news.
    """

    def __init__(self):
        # Load environment variables
        load_dotenv()
        self.finnhub_api_token = os.getenv("FINNHUB_API_TOKEN")
        if not self.finnhub_api_token:
            print("WARNING: FINNHUB_API_TOKEN not found in .env file. News fetching for events will fail.")

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

    def analyze_significant_events(
        self,
        ticker: str,
        std_threshold: float = 2.0,
        event_count: int = 5
    ) -> list[dict]:
        """
        Identifies significant price moves for a ticker and finds correlated news.

        This method:
        1. Fetches 1 year of historical data
        2. Identifies price moves exceeding std_threshold * daily_std
        3. Groups consecutive moves in the same direction into "streaks"
        4. Ranks streaks by total magnitude
        5. Fetches news for the top events

        Args:
            ticker: Stock ticker symbol
            std_threshold: Standard deviation multiplier for significance
            event_count: Number of top events to return

        Returns:
            List of events with dates, move percentages, and related news
        """
        # 1. Fetch Data
        df = stock_data_service.get_stock_data(ticker, period="1y")
        if df is None or df.empty:
            return []
        df = df.reset_index()

        # 2. Calculate Metrics
        df['pct_change'] = df['Close'].pct_change()
        daily_return_std = df['pct_change'].std()

        df['is_big_move'] = df['pct_change'].abs() > (std_threshold * daily_return_std)
        df['direction'] = np.sign(df['pct_change'])

        # 3. Find and Group Events (Streaks)
        # A streak breaks when either the big_move status changes or direction changes
        streaks_broken = (df['is_big_move'] != df['is_big_move'].shift()) | \
                         (df['direction'] != df['direction'].shift())
        df['streak_id'] = streaks_broken.cumsum()

        # Filter to only big move streaks
        big_move_streaks = df[df['is_big_move'] == True]
        if big_move_streaks.empty:
            return []

        # Group by streak and calculate total move
        grouped_streaks = big_move_streaks.groupby('streak_id').agg(
            start_date=('Date', 'min'),
            total_move_pct=('pct_change', 'sum')
        ).reset_index()

        # 4. Rank and Select Top Events
        grouped_streaks['importance'] = grouped_streaks['total_move_pct'].abs()
        top_events = grouped_streaks.sort_values(by='importance', ascending=False).head(event_count)

        # 5. Fetch News for Each Top Event
        final_results = []
        for event in top_events.itertuples():
            news = self.fetch_finnhub_news(ticker, event.start_date)
            final_results.append({
                "start_date": event.start_date.strftime('%Y-%m-%d'),
                "total_move_pct": event.total_move_pct,
                "news": news
            })

        return final_results

    def fetch_finnhub_news(
        self,
        ticker: str,
        target_date: datetime,
        window: int = 3
    ) -> list[dict]:
        """
        Fetches news from Finnhub API around a specific date.

        Args:
            ticker: Stock ticker symbol
            target_date: Date to center the search around
            window: Number of days before and after target_date to search

        Returns:
            List of news articles (up to 5)
        """
        if not self.finnhub_api_token:
            return [{"error": "Finnhub API token not configured."}]

        start_date = target_date - timedelta(days=window)
        end_date = target_date + timedelta(days=window)

        try:
            url = (
                f"https://finnhub.io/api/v1/company-news"
                f"?symbol={ticker}"
                f"&from={start_date.strftime('%Y-%m-%d')}"
                f"&to={end_date.strftime('%Y-%m-%d')}"
                f"&token={self.finnhub_api_token}"
            )
            response = requests.get(url)
            response.raise_for_status()
            news_data = response.json()

            return [
                {
                    "date": datetime.fromtimestamp(n.get("datetime")).strftime('%Y-%m-%d'),
                    "title": n.get("headline"),
                    "link": n.get("url"),
                    "publisher": n.get("source")
                } for n in news_data[:5]  # Return top 5 news items
            ]
        except requests.exceptions.RequestException as e:
            print(f"Finnhub API error for {ticker}: {e}")
            return [{"error": f"Failed to fetch news from Finnhub: {e}"}]

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
