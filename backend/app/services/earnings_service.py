# app/services/earnings_service.py

import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv
import aiohttp
from typing import List, Dict, Optional
import logging
from app.core.cache import async_cache_result
from app.core.http_client import http_client
from app.core.circuit_breakers import get_circuit_breaker, CircuitBreakerOpenError

logger = logging.getLogger(__name__)


class EarningsService:
    """
    Service to fetch earnings call transcripts from Alpha Vantage API.
    Provides LLM-enriched sentiment signals for each speaker segment.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            print("Creating EarningsService instance...")
            cls._instance = super(EarningsService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize the service and load API keys."""
        load_dotenv()
        self.alpha_vantage_api_key = os.getenv("ALPHA_VANTAGE_API_KEY")

        if not self.alpha_vantage_api_key:
            print("WARNING: ALPHA_VANTAGE_API_KEY not found. Earnings call transcript service will be disabled.")
        else:
            print("Alpha Vantage API key loaded for earnings service.")

    @async_cache_result(ttl=86400)  # Cache for 24 hours - earnings transcripts don't change
    async def fetch_earnings_transcript(
        self,
        ticker: str,
        quarter: str
    ) -> Dict:
        """
        Fetch earnings call transcript for a given company and quarter.
        
        Args:
            ticker: Stock ticker symbol (e.g., 'IBM')
            quarter: Fiscal quarter in YYYYQM format (e.g., '2024Q1')
        
        Returns:
            Dictionary containing:
            - symbol: Ticker symbol
            - quarter: Quarter identifier
            - transcript: List of speaker segments with content and sentiment
            - error: Error message if request fails
        
        Example Response:
        {
            "symbol": "IBM",
            "quarter": "2024Q1",
            "transcript": [
                {
                    "speaker": "Arvind Krishna",
                    "title": "CEO",
                    "content": "Thank you for joining us...",
                    "sentiment": "0.7"
                }
            ]
        }
        """
        if not self.alpha_vantage_api_key:
            return {
                "error": "Alpha Vantage API key not configured",
                "symbol": ticker,
                "quarter": quarter
            }

        # Validate quarter format (YYYYQM where M is 1-4)
        if not self._validate_quarter_format(quarter):
            return {
                "error": f"Invalid quarter format: {quarter}. Expected format: YYYYQM (e.g., 2024Q1)",
                "symbol": ticker,
                "quarter": quarter
            }

        cb = get_circuit_breaker("alpha_vantage")
        session = await http_client.get_session()
        url = (
            f"https://www.alphavantage.co/query?"
            f"function=EARNINGS_CALL_TRANSCRIPT"
            f"&symbol={ticker.upper()}"
            f"&quarter={quarter}"
            f"&apikey={self.alpha_vantage_api_key}"
        )

        async def _make_request():
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                if response.status != 200:
                    raise aiohttp.ClientResponseError(
                        response.request_info,
                        response.history,
                        status=response.status
                    )
                return await response.json()

        try:
            print(f"Fetching earnings transcript for {ticker} - {quarter}...")
            data = await cb.call(_make_request) if cb else await _make_request()

            # Check for API errors
            if "Error Message" in data:
                return {
                    "error": data["Error Message"],
                    "symbol": ticker,
                    "quarter": quarter
                }

            if "Note" in data:
                # Rate limit or other API notice
                return {
                    "error": "API rate limit reached. Please try again later.",
                    "symbol": ticker,
                    "quarter": quarter,
                    "note": data["Note"]
                }

            # Check if transcript data exists
            if "transcript" not in data or not data["transcript"]:
                return {
                    "error": f"No earnings transcript available for {ticker} in {quarter}",
                    "symbol": ticker,
                    "quarter": quarter
                }

            # Process and enrich the transcript data
            processed_transcript = self._process_transcript(data["transcript"])

            return {
                "symbol": data.get("symbol", ticker.upper()),
                "quarter": data.get("quarter", quarter),
                "transcript": processed_transcript,
                "total_segments": len(processed_transcript),
                "fetched_at": datetime.utcnow().isoformat()
            }

        except CircuitBreakerOpenError:
            logger.warning(f"[ALPHA_VANTAGE] Circuit breaker open for earnings transcript {ticker} - {quarter}")
            return {
                "error": "Service temporarily unavailable (circuit breaker open)",
                "symbol": ticker,
                "quarter": quarter
            }
        except asyncio.TimeoutError:
            print(f"Timeout fetching earnings transcript for {ticker} - {quarter}")
            return {
                "error": "Request timeout",
                "symbol": ticker,
                "quarter": quarter
            }
        except aiohttp.ClientError as e:
            print(f"Network error fetching earnings transcript: {str(e)}")
            return {
                "error": f"Network error: {str(e)}",
                "symbol": ticker,
                "quarter": quarter
            }
        except Exception as e:
            print(f"Unexpected error fetching earnings transcript: {str(e)}")
            return {
                "error": f"Unexpected error: {str(e)}",
                "symbol": ticker,
                "quarter": quarter
            }

    def _validate_quarter_format(self, quarter: str) -> bool:
        """
        Validate quarter format is YYYYQM where M is 1-4.
        
        Args:
            quarter: Quarter string to validate
        
        Returns:
            True if valid, False otherwise
        """
        if not quarter or len(quarter) != 6:
            return False
        
        if quarter[4] != 'Q':
            return False
        
        try:
            year = int(quarter[0:4])
            q_num = int(quarter[5])
            
            # Year should be reasonable (between 2010 and current year + 1)
            current_year = datetime.now().year
            if year < 2010 or year > current_year + 1:
                return False
            
            # Quarter should be 1-4
            if q_num < 1 or q_num > 4:
                return False
            
            return True
        except ValueError:
            return False

    def _process_transcript(self, transcript: List[Dict]) -> List[Dict]:
        """
        Process transcript data to ensure consistent format and data types.
        
        Args:
            transcript: Raw transcript list from API
        
        Returns:
            Processed transcript with normalized fields
        """
        processed = []
        
        for segment in transcript:
            processed_segment = {
                "speaker": segment.get("speaker", "Unknown"),
                "title": segment.get("title", ""),
                "content": segment.get("content", ""),
                "sentiment": float(segment.get("sentiment", 0.0)),
                "word_count": len(segment.get("content", "").split())
            }
            processed.append(processed_segment)
        
        return processed

    async def get_available_quarters(
        self,
        ticker: str,
        years_back: int = 5
    ) -> List[str]:
        """
        Generate list of potential quarters to check for transcripts.
        Since API doesn't provide a list endpoint, we generate recent quarters.

        Earnings calls typically happen 2-4 weeks after quarter end, so we exclude:
        - Current quarter (not yet ended)
        - Most recent completed quarter (earnings call may not have happened yet)

        Args:
            ticker: Stock ticker symbol
            years_back: Number of years to go back (default: 5)

        Returns:
            List of quarter strings in YYYYQM format, most recent first
        """
        from datetime import datetime, timedelta

        current_date = datetime.now()
        current_year = current_date.year
        current_month = current_date.month
        current_quarter = (current_month - 1) // 3 + 1

        # Calculate day within quarter (to determine if earnings call likely happened)
        quarter_start_month = (current_quarter - 1) * 3 + 1
        days_into_quarter = (current_date - datetime(current_year, quarter_start_month, 1)).days

        quarters = []

        for year in range(current_year, current_year - years_back - 1, -1):
            for quarter in range(4, 0, -1):
                # Skip current quarter
                if year == current_year and quarter >= current_quarter:
                    continue

                # Skip most recent completed quarter if we're less than 30 days into current quarter
                # (earnings calls typically happen 2-4 weeks after quarter end)
                if year == current_year and quarter == current_quarter - 1 and days_into_quarter < 30:
                    continue

                quarters.append(f"{year}Q{quarter}")

        return quarters

    @async_cache_result(ttl=86400)  # Cache for 24 hours
    async def fetch_earnings_calendar(
        self,
        ticker: str,
        horizon: str = "12month"
    ) -> Dict:
        """
        Fetch upcoming earnings calendar events for a given company.

        Args:
            ticker: Stock ticker symbol (e.g., 'AAPL')
            horizon: Time horizon for earnings events (e.g., '3month', '6month', '12month')

        Returns:
            Dictionary containing:
            - ticker: Ticker symbol
            - earnings_events: List of upcoming earnings events
            - total_events: Count of earnings events
            - error: Error message if request fails

        Example Response:
        {
            "ticker": "AAPL",
            "earnings_events": [
                {
                    "earnings_date": "2025-01-30",
                    "fiscal_period_ending": "2024-12-31",
                    "estimated_eps": "2.35",
                    "reported_eps": None,
                    "currency": "USD",
                    "days_until": 95
                }
            ],
            "total_events": 4
        }
        """
        if not self.alpha_vantage_api_key:
            return {
                "error": "Alpha Vantage API key not configured",
                "ticker": ticker,
                "earnings_events": []
            }

        cb = get_circuit_breaker("alpha_vantage")
        session = await http_client.get_session()
        url = (
            f"https://www.alphavantage.co/query?"
            f"function=EARNINGS_CALENDAR"
            f"&symbol={ticker.upper()}"
            f"&horizon={horizon}"
            f"&apikey={self.alpha_vantage_api_key}"
        )

        async def _make_request():
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                if response.status != 200:
                    raise aiohttp.ClientResponseError(
                        response.request_info,
                        response.history,
                        status=response.status
                    )
                return await response.text()

        try:
            print(f"Fetching earnings calendar for {ticker} with horizon {horizon}...")
            text_data = await cb.call(_make_request) if cb else await _make_request()

            # Check for API errors in text response
            if "Error Message" in text_data:
                return {
                    "error": "API error occurred",
                    "ticker": ticker,
                    "earnings_events": []
                }

            if "Premium Endpoint" in text_data or "higher API tier" in text_data:
                return {
                    "error": "Earnings calendar requires premium Alpha Vantage subscription",
                    "ticker": ticker,
                    "earnings_events": []
                }

            if "Thank you for using Alpha Vantage" in text_data and "rate limit" in text_data.lower():
                return {
                    "error": "API rate limit reached. Please try again later.",
                    "ticker": ticker,
                    "earnings_events": []
                }

            # Parse CSV data
            events = self._parse_earnings_calendar_csv(text_data, ticker)

            if not events:
                return {
                    "error": f"No earnings calendar data available for {ticker}",
                    "ticker": ticker,
                    "earnings_events": []
                }

            return {
                "ticker": ticker.upper(),
                "earnings_events": events,
                "total_events": len(events),
                "fetched_at": datetime.utcnow().isoformat()
            }

        except CircuitBreakerOpenError:
            logger.warning(f"[ALPHA_VANTAGE] Circuit breaker open for earnings calendar {ticker}")
            return {
                "error": "Service temporarily unavailable (circuit breaker open)",
                "ticker": ticker,
                "earnings_events": []
            }
        except asyncio.TimeoutError:
            print(f"Timeout fetching earnings calendar for {ticker}")
            return {
                "error": "Request timeout",
                "ticker": ticker,
                "earnings_events": []
            }
        except aiohttp.ClientError as e:
            print(f"Network error fetching earnings calendar: {str(e)}")
            return {
                "error": f"Network error: {str(e)}",
                "ticker": ticker,
                "earnings_events": []
            }
        except Exception as e:
            print(f"Unexpected error fetching earnings calendar: {str(e)}")
            return {
                "error": f"Unexpected error: {str(e)}",
                "ticker": ticker,
                "earnings_events": []
            }

    def _parse_earnings_calendar_csv(self, csv_text: str, ticker: str) -> List[Dict]:
        """
        Parse CSV earnings calendar data from Alpha Vantage.

        Args:
            csv_text: Raw CSV text from API
            ticker: Ticker symbol for filtering (API may return multiple symbols)

        Returns:
            List of parsed earnings events
        """
        import csv
        from io import StringIO
        from datetime import datetime

        events = []

        try:
            csv_reader = csv.DictReader(StringIO(csv_text))
            current_date = datetime.now().date()

            for row in csv_reader:
                # Filter by ticker (case-insensitive)
                if row.get('symbol', '').upper() != ticker.upper():
                    continue

                earnings_date_str = row.get('reportDate', '').strip()
                if not earnings_date_str:
                    continue

                try:
                    earnings_date = datetime.strptime(earnings_date_str, '%Y-%m-%d').date()
                except ValueError:
                    continue

                # Calculate days until earnings
                days_until = (earnings_date - current_date).days

                event = {
                    "earnings_date": earnings_date_str,
                    "fiscal_period_ending": row.get('fiscalDateEnding', '').strip() or None,
                    "estimated_eps": row.get('estimate', '').strip() or None,
                    "reported_eps": row.get('reportedEPS', '').strip() or None,
                    "currency": row.get('currency', 'USD').strip() or 'USD',
                    "days_until": days_until,
                    "surprise": row.get('surprise', '').strip() or None,
                    "surprise_percentage": row.get('surprisePercentage', '').strip() or None
                }

                events.append(event)

            # Sort by date (earliest first)
            events.sort(key=lambda x: x['earnings_date'])

        except Exception as e:
            print(f"Error parsing earnings calendar CSV: {str(e)}")
            return []

        return events


# Create singleton instance
earnings_service = EarningsService()
