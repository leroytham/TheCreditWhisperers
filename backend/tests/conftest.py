# tests/conftest.py

import pytest
import sys
import os
from unittest.mock import MagicMock, patch

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
