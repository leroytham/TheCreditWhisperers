import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import requests

class SignificantEventAnalyzer:
    """
    A class to analyze stock price movements, identify significant events,
    and fetch related news from the Finnhub API.
    """
    def __init__(self, ticker, api_token, history_period="1y", std_threshold=2.0, event_count=5, news_window=3, news_count=5):
        """Initializes the analyzer with given parameters."""
        self.ticker = ticker
        self.api_token = api_token
        self.history_period = history_period
        self.std_threshold = std_threshold
        self.final_event_count = event_count
        self.news_window_days = news_window
        self.news_article_count = news_count
        self.df = None
        self.top_events = None

    def _fetch_stock_data(self):
        """Fetches historical stock data using yfinance."""
        print(f"Fetching {self.history_period} of historical data for {self.ticker}...")
        self.df = yf.Ticker(self.ticker).history(period=self.history_period, interval="1d")
        if self.df.empty:
            print(f"Could not retrieve data for {self.ticker}. Exiting.")
            return False
        # Moves the date from the Index into a column and cleans it up.
        self.df = self.df.reset_index()
        self.df['Date'] = pd.to_datetime(self.df['Date']).dt.tz_localize(None)
        return True

    def _calculate_metrics(self):
        """Calculates percentage change, standard deviation, and identifies big moves."""
        self.df['pct_change'] = self.df['Close'].pct_change()
        daily_return_std = self.df['pct_change'].std()
        print(f"Daily Return Std. Dev: {daily_return_std:.4f}")

        self.df['is_big_move'] = self.df['pct_change'].abs() > (self.std_threshold * daily_return_std)
        self.df['direction'] = np.sign(self.df['pct_change'])

    def _find_significant_events(self):
        """Finds and groups streaks of significant price moves."""
        streaks_broken = (self.df['is_big_move'] != self.df['is_big_move'].shift()) | \
                         (self.df['direction'] != self.df['direction'].shift())
        self.df['streak_id'] = streaks_broken.cumsum()

        big_move_streaks = self.df[self.df['is_big_move'] == True]

        grouped_streaks = big_move_streaks.groupby('streak_id').agg(
            start_date=('Date', 'min'),
            end_date=('Date', 'max'),
            streak_days=('Date', 'count'),
            direction=('direction', 'first'),
            total_move_pct=('pct_change', 'sum')
        )
        return grouped_streaks

    def _fetch_news_for_event(self, target_date_str):
        """Fetches news for a specific date window using the Finnhub API."""
        if self.api_token == "YOUR_API_TOKEN_HERE" or not self.api_token:
            print("ERROR: Finnhub API token not set. Please get a free token from finnhub.io and add it to the script.", file=sys.stderr)
            return []
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
            start_date = target_date - timedelta(days=self.news_window_days)
            end_date = target_date + timedelta(days=self.news_window_days)

            url = "https://finnhub.io/api/v1/company-news"
            params = {
                "token": self.api_token,
                "symbol": self.ticker,
                "from": start_date.strftime('%Y-%m-%d'),
                "to": end_date.strftime('%Y-%m-%d'),
            }
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            news_list = []
            for article in data:
                unix_timestamp = article.get("datetime")
                if not unix_timestamp: continue
                
                news_list.append({
                    "date": datetime.fromtimestamp(unix_timestamp).date(),
                    "title": article.get("headline", "No Title"),
                    "publisher": article.get("source", "N/A"),
                    "link": article.get("url", "#")
                })
            
            news_list.sort(key=lambda x: abs((x['date'] - target_date).days))
            return news_list
        except requests.exceptions.RequestException as e:
            print(f"Error fetching news from Finnhub for {self.ticker}: {e}", file=sys.stderr)
            return []
        except Exception as e:
            print(f"An unexpected error occurred while fetching news: {e}", file=sys.stderr)
            return []

    def _display_results(self):
        """Prints the final analysis results, including correlated news."""
        if self.top_events is None or self.top_events.empty:
            print("No significant events found matching the criteria.")
            return

        direction_map = {1.0: "UP", -1.0: "DOWN"}
        self.top_events['trend'] = self.top_events['direction'].map(direction_map)

        for event in self.top_events.itertuples():
            event_start_str = event.start_date.strftime('%Y-%m-%d')
            print("-" * 70)
            print(f"Event Start: {event_start_str}, "
                  f"End: {event.end_date.strftime('%Y-%m-%d')}, "
                  f"Days: {event.streak_days}, "
                  f"Trend: {event.trend}, "
                  f"Total Move: {event.total_move_pct:+.2%}")
            
            news_items = self._fetch_news_for_event(event_start_str)
            
            if news_items:
                print(f"  News around {event_start_str}:")
                for i, news in enumerate(news_items):
                    if i >= self.news_article_count: break
                    print(f"    - [{news['date'].strftime('%Y-%m-%d')}] {news['title']} ({news['publisher']})")
            else:
                print(f"  No relevant news found for this event around {event_start_str}.")
        print("-" * 70)

    def run_analysis(self):
        """Executes the full analysis workflow, dynamically adjusting threshold."""
        if not self._fetch_stock_data():
            return # Exit if data fetching fails

        # Initial calculation
        self._calculate_metrics()
        all_events = self._find_significant_events()

        # Dynamically lower threshold if not enough events are found
        # We add a safety break to prevent an infinite loop.
        min_threshold = 0.5
        while len(all_events) < self.final_event_count and self.std_threshold > min_threshold:
            print(f"-> Found only {len(all_events)} events with threshold {self.std_threshold:.2f}. Lowering threshold and re-analyzing...")
            self.std_threshold -= 0.1
            self._calculate_metrics() # Recalculate 'is_big_move' with new threshold
            all_events = self._find_significant_events()

        print(f"\nFound {len(all_events)} total significant move events. Displaying Top {self.final_event_count}:")

        # Rank and select the top events after the loop is finished
        if not all_events.empty:
            all_events['importance_rank'] = all_events['total_move_pct'].abs()
            all_events_ranked = all_events.sort_values(by='importance_rank', ascending=False)
            self.top_events = all_events_ranked.head(self.final_event_count).copy()
        else:
            self.top_events = all_events # Ensure top_events is empty if no events found
        
        self._display_results()


# --- Main Execution Block ---
if __name__ == "__main__":
    # --- 1. Define Parameters ---
    TICKER = "AAPL"
    HISTORY_PERIOD = "1y"
    
    # --- IMPORTANT: Get a free API token from https://finnhub.io/ and replace the placeholder below ---
    FINNHUB_API_TOKEN = "d3gcqrhr01qqbh56but0d3gcqrhr01qqbh56butg"

    # --- 2. Create an analyzer instance and run it ---
    analyzer = SignificantEventAnalyzer(ticker=TICKER, history_period=HISTORY_PERIOD, api_token=FINNHUB_API_TOKEN)
    analyzer.run_analysis()
