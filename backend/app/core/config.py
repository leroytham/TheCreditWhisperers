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

    # Frontend URL (for CORS)
    FRONTEND_URL: str = "http://localhost:3000"

    # Azure OAuth
    AZURE_AUTHORITY: str = "https://login.microsoftonline.com/common"
    AZURE_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback"

    class Config:
        env_file = ".env"
        case_sensitive = False  # Case-insensitive for better compatibility
        extra = "ignore"  # Ignore extra fields in .env


# Create a singleton instance
settings = Settings()
