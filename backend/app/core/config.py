# app/core/config.py

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Uses pydantic-settings for validation and type conversion.
    """

    # API Keys
    FINNHUB_API_TOKEN: Optional[str] = None
    APPLICATION_ID: Optional[str] = None
    DIRECTORY_ID: Optional[str] = None
    CLIENT_SECRET: Optional[str] = None

    # Database
    MONGO_URI: str = "mongodb://localhost:27017"

    # Redis Cache
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None
    REDIS_PASSWORD: Optional[str] = None

    # Cache TTL (Time To Live in seconds)
    PRICE_CACHE_TTL: int = 300      # 5 minutes
    NEWS_CACHE_TTL: int = 600       # 10 minutes
    SENTIMENT_CACHE_TTL: int = 900  # 15 minutes
    COMPANY_INFO_CACHE_TTL: int = 86400  # 24 hours
    SECTOR_CACHE_TTL: int = 3600    # 1 hour

    # Server Configuration
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # News Configuration
    RSS_URLS: str = "https://feeds.reuters.com/reuters/businessNews"
    DAYS_BACK: int = 2

    # Sentiment Analysis Configuration
    SENTIMENT_DECAY_CONSTANT: float = 0.0289  # 24-hour half-life for news recency weighting

    # Sentiment Momentum Configuration (MACD-Style Fast vs. Slow)
    SENTIMENT_HALF_LIFE_FAST_HOURS: float = 7     # Fast score: 7-hour half-life (intraday)
    SENTIMENT_HALF_LIFE_SLOW_HOURS: float = 24    # Slow score: 24-hour half-life (daily trend)
    MOMENTUM_THRESHOLD_WEAK: float = 0.10          # Weak momentum threshold
    MOMENTUM_THRESHOLD_STRONG: float = 0.20        # Strong momentum threshold

    # Frontend URL (for CORS and redirects)
    FRONTEND_URL: str = "http://localhost:3000"

    # API Base URL (where the backend is hosted)
    # Supports both API_BASE_URL (new) and API_BASE (legacy for backward compatibility)
    API_BASE_URL: Optional[str] = None
    API_BASE: Optional[str] = None  # Legacy variable name for backward compatibility

    # Azure OAuth
    AZURE_AUTHORITY: str = "https://login.microsoftonline.com/common"
    AZURE_REDIRECT_URI: Optional[str] = None  # Auto-generated if not provided

    def get_api_base_url(self) -> str:
        """
        Get the API base URL, supporting both new (API_BASE_URL) and legacy (API_BASE) variable names.
        Prefers API_BASE_URL if set, falls back to API_BASE, then to default localhost.
        """
        return self.API_BASE_URL or self.API_BASE or "http://localhost:8000"

    def get_redirect_uri(self) -> str:
        """
        Get the OAuth redirect URI. Auto-generates from API_BASE_URL if not explicitly set.
        This allows seamless switching between localhost and production.
        """
        if self.AZURE_REDIRECT_URI:
            return self.AZURE_REDIRECT_URI
        # Auto-generate: {API_BASE_URL}/auth/callback
        # Note: The /api prefix is handled by frontend proxy in dev, not needed here
        return f"{self.get_api_base_url()}/auth/callback"

    class Config:
        env_file = ".env"
        case_sensitive = False  # Case-insensitive for better compatibility
        extra = "ignore"  # Ignore extra fields in .env


# Create a singleton instance
settings = Settings()
