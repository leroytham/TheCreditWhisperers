# =============================================================================
# Sentiment & News Service Configuration
# =============================================================================

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import math


class Settings(BaseSettings):
    """Sentiment Service settings loaded from environment variables."""

    # API Keys
    ALPHA_VANTAGE_API_KEY: Optional[str] = None
    FINNHUB_API_TOKEN: Optional[str] = None
    NEWS_API_KEY: Optional[str] = None
    MARKETAUX_API_KEY: Optional[str] = None

    # Redis Cache
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None
    REDIS_PASSWORD: Optional[str] = None

    # Cache TTL
    NEWS_CACHE_TTL: int = 600        # 10 minutes
    SENTIMENT_CACHE_TTL: int = 900   # 15 minutes

    # Server Configuration
    PORT: int = 8003
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Sentiment Analysis Configuration
    SENTIMENT_DECAY_CONSTANT: float = 0.0289  # 24-hour half-life
    SENTIMENT_HALF_LIFE_FAST_HOURS: float = 7
    SENTIMENT_HALF_LIFE_SLOW_HOURS: float = 24
    MOMENTUM_THRESHOLD_WEAK: float = 0.10
    MOMENTUM_THRESHOLD_STRONG: float = 0.20

    # Service URLs
    MARKET_DATA_URL: str = "http://market-data:8002"

    @field_validator('DEBUG', mode='before')
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            v_lower = v.lower().strip()
            return v_lower in ('true', '1', 'yes', 'on')
        return False

    def get_redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def decay_k_fast(self) -> float:
        return math.log(2) / self.SENTIMENT_HALF_LIFE_FAST_HOURS

    @property
    def decay_k_slow(self) -> float:
        return math.log(2) / self.SENTIMENT_HALF_LIFE_SLOW_HOURS

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
