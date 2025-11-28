# tests/conftest.py
"""
Pytest configuration and fixtures for backend tests.

This module provides:
1. Module-level mocks for ML libraries and database (must run before imports)
2. Service mock factories for dependency injection
3. Dependency override fixtures for clean test mocking
"""

import pytest
import sys
import os
from unittest.mock import MagicMock, AsyncMock, patch

# Add the backend directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

# Mock transformers/ML models BEFORE any imports
sys.modules['transformers'] = MagicMock()
sys.modules['sentence_transformers'] = MagicMock()
sys.modules['torch'] = MagicMock()

# Mock database module BEFORE it's imported
mock_db_module = MagicMock()
mock_client_instance = MagicMock()
mock_client_instance.server_info.return_value = {}
mock_db_module.get_client.return_value = mock_client_instance
mock_db_module.get_database.return_value = MagicMock()
mock_db_module.get_collection.return_value = MagicMock()
mock_db_module.get_sector_news_cache_collection.return_value = MagicMock()
sys.modules['app.database'] = mock_db_module

# Mock Redis
mock_redis = MagicMock()
sys.modules['redis'] = MagicMock()


@pytest.fixture(scope="session", autouse=True)
def setup_mocks():
    """Setup mocks before tests run"""
    yield


# =============================================================================
# SERVICE MOCK FACTORIES
# =============================================================================
# These fixtures create mock service instances that can be used with
# FastAPI's dependency_overrides for clean, isolated testing.

@pytest.fixture
def mock_news_service():
    """
    Create a mock NewsService.

    Usage:
        def test_news_endpoint(mock_news_service, client_with_mocks):
            mock_news_service.get_ticker_news.return_value = [{"title": "Test"}]
            response = client_with_mocks.get("/news?ticker=AAPL")
            assert response.status_code == 200
    """
    mock = MagicMock()
    mock.get_ticker_news = AsyncMock(return_value=[])
    mock.get_ticker_news_for_timeframe = AsyncMock(return_value=[])
    mock.get_aggregated_headlines = AsyncMock(return_value=[])
    mock.get_sector_news = AsyncMock(return_value={"articles": []})
    return mock


@pytest.fixture
def mock_sentiment_service():
    """Create a mock SentimentService."""
    mock = MagicMock()
    mock.analyze_headlines = AsyncMock(return_value={"sentiment": 0.5})
    mock.analyze_sentiment_with_weights = MagicMock(return_value={
        "overall_weighted_score": 0.5,
        "articles_with_sentiment": [],
        "sentiment_counts": {"positive": 0, "negative": 0, "neutral": 0},
        "news_objects": []
    })
    mock.analyze_sentiment_with_momentum = MagicMock(return_value={
        "overall_weighted_score": 0.5,
        "fast_score": 0.5,
        "slow_score": 0.5,
        "sentiment_momentum": 0,
        "momentum_label": "Neutral",
        "articles_with_sentiment": []
    })
    mock.get_daily_sentiment = AsyncMock(return_value=[])
    mock.get_rolling_sentiment = AsyncMock(return_value=[])
    return mock


@pytest.fixture
def mock_sector_service():
    """Create a mock SectorService."""
    mock = MagicMock()
    mock.get_sector_info = AsyncMock(return_value={})
    mock.get_top_constituents = AsyncMock(return_value=[])
    mock.resolve_sector_key = MagicMock(return_value="technology")
    mock.get_sector_metadata = MagicMock(return_value={"display_name": "Technology"})
    mock.get_sector_tickers = MagicMock(return_value=(["AAPL", "MSFT"], {}))
    return mock


@pytest.fixture
def mock_sector_sentiment_service():
    """Create a mock SectorSentimentService."""
    mock = MagicMock()
    mock.calculate_daily_sector_sentiment = MagicMock(return_value={})
    mock.calculate_rolling_sector_sentiment = MagicMock(return_value=[])
    return mock


@pytest.fixture
def mock_stock_data_service():
    """Create a mock StockDataService."""
    mock = MagicMock()
    mock.get_stock_data = MagicMock(return_value=None)
    mock.filter_data_by_timeframe = MagicMock(return_value=MagicMock())
    mock.get_company_info = MagicMock(return_value={"name": "Test Company"})
    mock.get_company_overview = AsyncMock(return_value={})
    mock.get_sector_top_constituents = MagicMock(return_value=[])
    return mock


@pytest.fixture
def mock_market_analysis_service():
    """Create a mock MarketAnalysisService."""
    mock = MagicMock()
    mock.analyze_significant_events = MagicMock(return_value=[])
    return mock


@pytest.fixture
def mock_earnings_service():
    """Create a mock EarningsService."""
    mock = MagicMock()
    mock.fetch_earnings_transcript = AsyncMock(return_value={})
    mock.get_available_quarters = AsyncMock(return_value=[])
    mock.fetch_earnings_calendar = AsyncMock(return_value={})
    return mock


@pytest.fixture
def mock_twr_calculator_service():
    """Create a mock TWRCalculatorService."""
    mock = MagicMock()
    mock.calculate_twr = AsyncMock(return_value={
        "twr_return": 5.0,
        "has_data": True,
        "start_value": 100000,
        "end_value": 105000,
        "total_cash_flow": 0,
        "sub_periods": [],
        "data_quality": {},
        "has_cash_flows": False,
        "cash_flow_count": 0
    })
    return mock


@pytest.fixture
def mock_portfolio_sentiment_service():
    """Create a mock PortfolioSentimentService."""
    mock = MagicMock()
    mock.get_portfolio_sentiment = AsyncMock(return_value={})
    mock.get_portfolio_daily_sentiment = AsyncMock(return_value={})
    mock.get_portfolio_rolling_sentiment = AsyncMock(return_value=[])
    return mock


# =============================================================================
# DEPENDENCY OVERRIDE FIXTURES
# =============================================================================
# These fixtures use FastAPI's dependency_overrides to swap out real
# services with mocks during testing.

@pytest.fixture
def app():
    """
    Get the FastAPI app instance for testing.

    Import here to avoid module-level import issues with mocks.
    """
    from app.main import app
    return app


@pytest.fixture
def client_with_mocks(
    app,
    mock_news_service,
    mock_sentiment_service,
    mock_sector_service,
    mock_sector_sentiment_service,
    mock_stock_data_service,
    mock_market_analysis_service,
    mock_earnings_service,
    mock_twr_calculator_service,
    mock_portfolio_sentiment_service,
):
    """
    Test client with all services mocked via dependency_overrides.

    This is the recommended fixture for most API tests. It provides
    a clean, isolated testing environment with all services mocked.

    Usage:
        def test_news_endpoint(client_with_mocks, mock_news_service):
            mock_news_service.get_ticker_news.return_value = [{"title": "Test"}]
            response = client_with_mocks.get("/news?ticker=AAPL")
            assert response.status_code == 200
            mock_news_service.get_ticker_news.assert_called_once()
    """
    from fastapi.testclient import TestClient
    from app.core.dependencies import (
        get_news_service,
        get_sentiment_service,
        get_sector_service,
        get_sector_sentiment_service,
        get_stock_data_service,
        get_market_analysis_service,
        get_earnings_service,
        get_twr_calculator_service,
        get_portfolio_sentiment_service,
        clear_dependency_caches,
    )

    # Override all service dependencies
    app.dependency_overrides[get_news_service] = lambda: mock_news_service
    app.dependency_overrides[get_sentiment_service] = lambda: mock_sentiment_service
    app.dependency_overrides[get_sector_service] = lambda: mock_sector_service
    app.dependency_overrides[get_sector_sentiment_service] = lambda: mock_sector_sentiment_service
    app.dependency_overrides[get_stock_data_service] = lambda: mock_stock_data_service
    app.dependency_overrides[get_market_analysis_service] = lambda: mock_market_analysis_service
    app.dependency_overrides[get_earnings_service] = lambda: mock_earnings_service
    app.dependency_overrides[get_twr_calculator_service] = lambda: mock_twr_calculator_service
    app.dependency_overrides[get_portfolio_sentiment_service] = lambda: mock_portfolio_sentiment_service

    with TestClient(app) as client:
        yield client

    # Cleanup
    app.dependency_overrides.clear()
    clear_dependency_caches()


@pytest.fixture
def override_news_service(app, mock_news_service):
    """
    Override just the news service.

    Useful when testing endpoints that only need the news service mocked.
    """
    from app.core.dependencies import get_news_service, clear_dependency_caches

    app.dependency_overrides[get_news_service] = lambda: mock_news_service
    yield mock_news_service
    app.dependency_overrides.pop(get_news_service, None)
    clear_dependency_caches()


@pytest.fixture
def override_sentiment_service(app, mock_sentiment_service):
    """Override just the sentiment service."""
    from app.core.dependencies import get_sentiment_service, clear_dependency_caches

    app.dependency_overrides[get_sentiment_service] = lambda: mock_sentiment_service
    yield mock_sentiment_service
    app.dependency_overrides.pop(get_sentiment_service, None)
    clear_dependency_caches()


@pytest.fixture(autouse=True)
def reset_overrides(app):
    """
    Auto-reset dependency overrides after each test.

    This fixture runs automatically for every test to ensure clean state.
    """
    yield
    app.dependency_overrides.clear()
    try:
        from app.core.dependencies import clear_dependency_caches
        clear_dependency_caches()
    except ImportError:
        pass


@pytest.fixture(autouse=True)
def reset_global_state():
    """
    Auto-reset global state variables after each test.

    This fixture ensures clean state for:
    - Database connections (sync and async)
    - Azure AD MSAL client
    - OpenTelemetry telemetry

    Note: This runs after each test to prevent state leakage between tests.
    """
    yield

    # Reset database globals
    try:
        import app.database as db_module
        db_module._client = None
        db_module._database = None
        db_module._motor_client = None
        db_module._motor_database = None
    except (ImportError, AttributeError):
        pass

    # Reset Azure AD MSAL client
    try:
        from app.core.azure_auth import reset_msal_client
        reset_msal_client()
    except (ImportError, AttributeError):
        pass

    # Reset OpenTelemetry telemetry
    try:
        from app.core.telemetry import reset_telemetry
        reset_telemetry()
    except (ImportError, AttributeError):
        pass


@pytest.fixture
def clean_global_state():
    """
    Explicitly reset all globals BEFORE and AFTER a test.

    Use this fixture for tests that need guaranteed clean state at the start.
    Unlike the autouse fixture, this also resets state before the test runs.

    Usage:
        def test_database_init(clean_global_state):
            # Globals are reset before this test runs
            client = get_client()
            assert client is not None
    """
    _reset_all_globals()
    yield
    _reset_all_globals()


def _reset_all_globals():
    """Helper to reset all module globals."""
    # Reset database globals
    try:
        import app.database as db_module
        db_module._client = None
        db_module._database = None
        db_module._motor_client = None
        db_module._motor_database = None
    except (ImportError, AttributeError):
        pass

    # Reset Azure AD MSAL client
    try:
        from app.core.azure_auth import reset_msal_client
        reset_msal_client()
    except (ImportError, AttributeError):
        pass

    # Reset OpenTelemetry telemetry
    try:
        from app.core.telemetry import reset_telemetry
        reset_telemetry()
    except (ImportError, AttributeError):
        pass
