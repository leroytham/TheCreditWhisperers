# tests/api/test_routes.py

from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

# This import will now work because app/main.py exists
from app.main import app

# Patch the new modular services
news_service_patch = patch('app.api.routes.news_service_instance', new_callable=MagicMock)
sentiment_service_patch = patch('app.api.routes.sentiment_service', new_callable=MagicMock)
market_analysis_service_patch = patch('app.api.routes.market_analysis_service', new_callable=MagicMock)

# The client will make requests to our FastAPI app
client = TestClient(app)

def test_get_sentiment_success():
    """Tests the happy path for the /sentiment endpoint."""
    with news_service_patch as mock_news_service, sentiment_service_patch as mock_sentiment_service:
        # Arrange: Configure the mocks to return specific data
        mock_news_service.get_ticker_news.return_value = [{"title": "Good News!"}]
        mock_sentiment_service.analyze_sentiment_with_weights.return_value = {
            "overall_weighted_score": 0.75,
            "articles_with_sentiment": [{"title": "Good News!", "sentiment_label": "positive"}],
            "news_objects": []
        }

        # Act: Make a fake HTTP GET request
        response = client.get("/api/stocks/AAPL/sentiment")

        # Assert: Check the HTTP status code and the JSON response
        assert response.status_code == 200
        response_json = response.json()
        assert response_json["ticker"] == "AAPL"
        assert response_json["overall_weighted_score"] == 0.75

def test_get_significant_events_error():
    """Tests an error case for the /significant-events endpoint."""
    with market_analysis_service_patch as mock_market_service:
        # Arrange: Configure the mock to raise an exception
        mock_market_service.analyze_significant_events.side_effect = Exception("Finnhub API limit reached")

        # Act
        response = client.get("/api/stocks/NVDA/significant-events")

        # Assert
        assert response.status_code == 500
        assert "An internal error occurred" in response.json()["detail"]

def test_get_categorized_news_success():
    """Tests the happy path for the /news/{ticker}/categorized endpoint."""
    with news_service_patch as mock_news_service:
        # Arrange: Mock the return value of the news service
        # Note: We return mock objects with attributes, not just dicts
        mock_sentiment = MagicMock()
        mock_sentiment.value = 0.88
        mock_sentiment.label = "Positive"
        mock_sentiment.source = "ArticleCategorizer"
        mock_sentiment.timestamp = "2025-10-15T12:00:00"

        mock_news_item = MagicMock()
        mock_news_item.headline = "New Product Launch"
        mock_news_item.source = "Tech Weekly"
        mock_news_item.sentiment_score = mock_sentiment
        
        mock_news_service.get_categorized_news.return_value = [mock_news_item]
        
        # Act
        response = client.get("/api/news/MSFT/categorized?start_date=2025-01-01&end_date=2025-10-15")

        # Assert
        assert response.status_code == 200
        response_json = response.json()
        assert len(response_json) == 1
        assert response_json[0]["headline"] == "New Product Launch"
        assert response_json[0]["sentiment"]["label"] == "Positive"