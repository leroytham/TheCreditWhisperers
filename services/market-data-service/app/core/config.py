# =============================================================================
# Market Data Service Configuration
# =============================================================================

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    """
    Market Data Service settings loaded from environment variables.
    """

    # API Keys
    ALPHA_VANTAGE_API_KEY: Optional[str] = None

    # Redis Cache
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None
    REDIS_PASSWORD: Optional[str] = None

    # Cache TTL (Time To Live in seconds)
    PRICE_CACHE_TTL: int = 300           # 5 minutes
    COMPANY_INFO_CACHE_TTL: int = 86400  # 24 hours
    SECTOR_CACHE_TTL: int = 3600         # 1 hour

    # Server Configuration
    PORT: int = 8002
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Service URLs (for inter-service communication)
    BACKEND_URL: str = "http://backend:8000"

    @field_validator('DEBUG', mode='before')
    @classmethod
    def parse_debug(cls, v):
        """Handle various DEBUG value formats."""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            v_lower = v.lower().strip()
            if v_lower in ('true', '1', 'yes', 'on'):
                return True
            if v_lower in ('false', '0', 'no', 'off', '', 'warn', 'warning'):
                return False
        return False

    def get_redis_url(self) -> str:
        """Get Redis URL, supporting both explicit URL and host/port."""
        if self.REDIS_URL:
            return self.REDIS_URL
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


# Singleton instance
settings = Settings()
