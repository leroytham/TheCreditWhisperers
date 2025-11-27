# =============================================================================
# Notification Service Configuration
# =============================================================================

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    """
    Notification service settings loaded from environment variables.
    """

    # Service Identity
    SERVICE_NAME: str = "notification-service"
    SERVICE_VERSION: str = "1.0.0"

    # Server Configuration
    PORT: int = 8001
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # MongoDB
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DATABASE: str = "creditwhisperers"

    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None
    REDIS_PASSWORD: Optional[str] = None

    # Redis Pub/Sub Configuration
    PUBSUB_ENABLED: bool = True
    PUBSUB_RECONNECT_DELAY: int = 5
    PUBSUB_MAX_RECONNECT_ATTEMPTS: int = 10
    PUBSUB_MESSAGE_TIMEOUT: float = 5.0

    # Backend Service URL (for inter-service communication)
    BACKEND_SERVICE_URL: str = "http://backend:8000"

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    API_BASE_URL: str = "http://localhost:8000"

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
            if v_lower in ('false', '0', 'no', 'off', ''):
                return False
        return False

    def get_redis_url(self) -> str:
        """Get Redis URL, preferring REDIS_URL if set."""
        if self.REDIS_URL:
            return self.REDIS_URL
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


# Create singleton instance
settings = Settings()
