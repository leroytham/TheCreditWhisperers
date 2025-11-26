# app/core/config.py

from pydantic_settings import BaseSettings
from pydantic import field_validator
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

    @field_validator('DEBUG', mode='before')
    @classmethod
    def parse_debug(cls, v):
        """Handle various DEBUG value formats, including Windows system vars."""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            v_lower = v.lower().strip()
            if v_lower in ('true', '1', 'yes', 'on'):
                return True
            if v_lower in ('false', '0', 'no', 'off', '', 'warn', 'warning'):
                return False
        return False

    # API Base URL (where the backend is hosted)
    # Supports both API_BASE_URL (new) and API_BASE (legacy for backward compatibility)
    API_BASE_URL: Optional[str] = None
    API_BASE: Optional[str] = None  # Legacy variable name for backward compatibility

    # Azure OAuth
    AZURE_AUTHORITY: str = "https://login.microsoftonline.com/common"
    AZURE_REDIRECT_URI: Optional[str] = None  # Auto-generated if not provided

    # Error Tracking (Sentry)
    SENTRY_DSN: Optional[str] = None  # Set to enable Sentry error tracking
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1  # 10% of transactions for performance monitoring
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1  # 10% of transactions for profiling

    # OpenTelemetry Distributed Tracing
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = None  # e.g., http://localhost:4317
    OTEL_SERVICE_NAME: str = "creditwhisperers-backend"
    OTEL_ENABLED: bool = True  # Enable/disable OpenTelemetry tracing

    # Prometheus Metrics
    METRICS_ENABLED: bool = True  # Enable/disable Prometheus metrics endpoint

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

        Important: Backend routes are registered TWICE (with and without /api prefix):
        - Localhost: /auth/callback (proxy strips /api)
        - Production: /api/auth/callback (frontend calls /api/* directly)
        """
        if self.AZURE_REDIRECT_URI:
            return self.AZURE_REDIRECT_URI

        # Determine environment based on API_BASE_URL
        api_base = self.get_api_base_url()

        # If localhost, use /auth/callback (proxy strips /api prefix)
        if "localhost" in api_base or "127.0.0.1" in api_base:
            return f"{api_base}/auth/callback"

        # If production (Azure or other), use /api/auth/callback
        return f"{api_base}/api/auth/callback"

    class Config:
        env_file = ".env"
        case_sensitive = False  # Case-insensitive for better compatibility
        extra = "ignore"  # Ignore extra fields in .env


# Create a singleton instance
settings = Settings()
