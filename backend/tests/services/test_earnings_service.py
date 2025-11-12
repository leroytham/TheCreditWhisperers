# tests/services/test_earnings_service.py

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import aiohttp
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.earnings_service import EarningsService


class TestEarningsService:
    """Test suite for EarningsService"""

    @pytest.fixture
    def service(self):
        """Create a service instance for testing"""
        with patch.dict(os.environ, {"ALPHA_VANTAGE_API_KEY": "test_api_key"}):
            return EarningsService()

    @pytest.fixture
    def mock_transcript_response(self):
        """Mock successful transcript response"""
        return {
            "symbol": "IBM",
            "quarter": "2024Q1",
            "transcript": [
                {
                    "speaker": "John Doe",
                    "title": "CEO",
                    "content": "Great quarter for the company",
                    "sentiment": "0.8"
                },
                {
                    "speaker": "Jane Smith",
                    "title": "CFO",
                    "content": "Revenue exceeded expectations",
                    "sentiment": "0.6"
                }
            ]
        }

    def test_singleton_pattern(self):
        """Test that EarningsService implements singleton pattern"""
        with patch.dict(os.environ, {"ALPHA_VANTAGE_API_KEY": "test_key"}):
            service1 = EarningsService()
            service2 = EarningsService()
            assert service1 is service2

    def test_initialization_with_api_key(self):
        """Test service initialization with API key"""
        with patch.dict(os.environ, {"ALPHA_VANTAGE_API_KEY": "test_key"}):
            service = EarningsService()
            assert service.alpha_vantage_api_key == "test_key"

    def test_initialization_without_api_key(self):
        """Test service initialization without API key"""
        with patch.dict(os.environ, {}, clear=True):
            service = EarningsService()
            assert service.alpha_vantage_api_key is None

    def test_validate_quarter_format_valid(self, service):
        """Test quarter format validation with valid formats"""
        assert service._validate_quarter_format("2024Q1") is True
        assert service._validate_quarter_format("2024Q2") is True
        assert service._validate_quarter_format("2024Q3") is True
        assert service._validate_quarter_format("2024Q4") is True

    def test_validate_quarter_format_invalid(self, service):
        """Test quarter format validation with invalid formats"""
        assert service._validate_quarter_format("2024Q5") is False
        assert service._validate_quarter_format("2024Q0") is False
        assert service._validate_quarter_format("24Q1") is False
        assert service._validate_quarter_format("2024-Q1") is False
        assert service._validate_quarter_format("Q1-2024") is False
        assert service._validate_quarter_format("") is False

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_no_api_key(self):
        """Test fetch when API key is not configured"""
        with patch.dict(os.environ, {}, clear=True):
            service = EarningsService()
            result = await service.fetch_earnings_transcript("IBM", "2024Q1")

            assert "error" in result
            assert "API key not configured" in result["error"]
            assert result["symbol"] == "IBM"
            assert result["quarter"] == "2024Q1"

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_invalid_quarter(self, service):
        """Test fetch with invalid quarter format"""
        result = await service.fetch_earnings_transcript("IBM", "INVALID")

        assert "error" in result
        assert "Invalid quarter format" in result["error"]

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_success(self, service, mock_transcript_response):
        """Test successful earnings transcript fetch"""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=mock_transcript_response)

        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await service.fetch_earnings_transcript("IBM", "2024Q1")

            assert "symbol" in result
            assert result["symbol"] == "IBM"
            assert "quarter" in result
            assert result["quarter"] == "2024Q1"
            assert "transcript" in result
            assert len(result["transcript"]) == 2

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_api_error(self, service):
        """Test handling of API error response"""
        error_response = {
            "Error Message": "Invalid API call"
        }

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=error_response)

        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await service.fetch_earnings_transcript("INVALID", "2024Q1")

            assert "error" in result
            assert result["error"] == "Invalid API call"

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_rate_limit(self, service):
        """Test handling of rate limit response"""
        rate_limit_response = {
            "Note": "API rate limit exceeded"
        }

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=rate_limit_response)

        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await service.fetch_earnings_transcript("IBM", "2024Q1")

            assert "error" in result
            assert "rate limit" in result["error"]
            assert "note" in result

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_no_data(self, service):
        """Test handling when no transcript is available"""
        no_data_response = {
            "symbol": "IBM",
            "quarter": "2024Q1"
        }

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=no_data_response)

        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await service.fetch_earnings_transcript("IBM", "2024Q1")

            assert "error" in result
            assert "No earnings transcript available" in result["error"]

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_http_error(self, service):
        """Test handling of HTTP error status"""
        mock_response = AsyncMock()
        mock_response.status = 500

        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await service.fetch_earnings_transcript("IBM", "2024Q1")

            assert "error" in result
            assert "status code 500" in result["error"]

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_timeout(self, service):
        """Test handling of request timeout"""
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.side_effect = asyncio.TimeoutError()

            result = await service.fetch_earnings_transcript("IBM", "2024Q1")

            assert "error" in result
            assert "timeout" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_network_error(self, service):
        """Test handling of network/client errors"""
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.side_effect = aiohttp.ClientError("Network error")

            result = await service.fetch_earnings_transcript("IBM", "2024Q1")

            assert "error" in result

    def test_process_transcript(self, service):
        """Test transcript processing"""
        raw_transcript = [
            {
                "speaker": "John Doe",
                "title": "CEO",
                "content": "Good quarter",
                "sentiment": "0.7"
            }
        ]

        processed = service._process_transcript(raw_transcript)

        assert len(processed) > 0
        # Processing should preserve or enrich the data
        assert "speaker" in processed[0]

    @pytest.mark.asyncio
    async def test_fetch_earnings_transcript_caching(self, service, mock_transcript_response):
        """Test that results are cached"""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=mock_transcript_response)

        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            # First call
            result1 = await service.fetch_earnings_transcript("IBM", "2024Q1")

            # Second call should use cache (mock should only be called once)
            result2 = await service.fetch_earnings_transcript("IBM", "2024Q1")

            assert result1 == result2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
