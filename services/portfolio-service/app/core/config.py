# =============================================================================
# Portfolio Service Configuration
# =============================================================================

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    """Portfolio Service settings loaded from environment variables."""

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "creditwhisperers"

    # Redis Cache
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None
    REDIS_PASSWORD: Optional[str] = None

    # Cache TTL
    PORTFOLIO_CACHE_TTL: int = 300       # 5 minutes
    TIMESERIES_CACHE_TTL: int = 300      # 5 minutes
    BENCHMARK_CACHE_TTL: int = 600       # 10 minutes

    # Server Configuration
    PORT: int = 8004
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Service URLs for inter-service communication
    MARKET_DATA_SERVICE_URL: str = "http://market-data:8002"
    SENTIMENT_SERVICE_URL: str = "http://sentiment-service:8003"

    # Request timeouts
    SERVICE_TIMEOUT_SECONDS: int = 30

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

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
