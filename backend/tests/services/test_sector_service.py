# tests/services/test_sector_service.py

import pytest
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.sector_service import SectorService


class TestSectorService:
    """Test suite for SectorService"""

    @pytest.fixture
    def service(self):
        """Create a service instance for testing"""
        return SectorService()

    @pytest.fixture
    def mock_etf_holdings_data(self):
        """Mock ETF holdings data from yahooquery"""
        return {
            "XLK": {
                "holdings": [
                    {"symbol": "AAPL", "holdingPercent": 0.25},
                    {"symbol": "MSFT", "holdingPercent": 0.20},
                    {"symbol": "NVDA", "holdingPercent": 0.15},
                    {"symbol": "GOOGL", "holdingPercent": 0.10},
                    {"symbol": "META", "holdingPercent": 0.08},
                    {"symbol": "AVGO", "holdingPercent": 0.05},
                    {"symbol": "CSCO", "holdingPercent": 0.04},
                    {"symbol": "ADBE", "holdingPercent": 0.03},
                ]
            }
        }

    def test_singleton_pattern(self):
        """Test that SectorService implements singleton pattern"""
        service1 = SectorService()
        service2 = SectorService()
        assert service1 is service2

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_success(self, mock_is_valid, mock_yq_ticker, service, mock_etf_holdings_data):
        """Test successful retrieval of sector tickers"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = mock_etf_holdings_data

        tickers, total_weight = service.get_sector_tickers("XLK", limit=5)

        # Should return top 5 tickers sorted by weight
        assert len(tickers) == 5
        assert tickers[0] == "AAPL"  # Highest weight
        assert tickers[1] == "MSFT"  # Second highest
        # Total weight should be sum of top 5
        expected_weight = 0.25 + 0.20 + 0.15 + 0.10 + 0.08
        assert abs(total_weight - expected_weight) < 0.01

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_no_limit(self, mock_is_valid, mock_yq_ticker, service, mock_etf_holdings_data):
        """Test retrieval of all sector tickers without limit"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = mock_etf_holdings_data

        tickers, total_weight = service.get_sector_tickers("XLK", limit=None)

        # Should return all 8 tickers
        assert len(tickers) == 8
        # Total weight should be sum of all holdings
        expected_weight = 0.25 + 0.20 + 0.15 + 0.10 + 0.08 + 0.05 + 0.04 + 0.03
        assert abs(total_weight - expected_weight) < 0.01

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_sorted_by_weight(self, mock_is_valid, mock_yq_ticker, service):
        """Test that tickers are sorted by holding weight descending"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = {
            "XLK": {
                "holdings": [
                    {"symbol": "LOW", "holdingPercent": 0.05},
                    {"symbol": "HIGH", "holdingPercent": 0.30},
                    {"symbol": "MED", "holdingPercent": 0.15},
                ]
            }
        }

        tickers, _ = service.get_sector_tickers("XLK", limit=None)

        # Should be sorted: HIGH, MED, LOW
        assert tickers[0] == "HIGH"
        assert tickers[1] == "MED"
        assert tickers[2] == "LOW"

    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_invalid_etf(self, mock_is_valid, service):
        """Test handling of invalid ETF ticker"""
        mock_is_valid.return_value = False

        with pytest.raises(ValueError, match="Invalid or unsupported ETF ticker"):
            service.get_sector_tickers("INVALID")

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_no_holdings_data(self, mock_is_valid, mock_yq_ticker, service):
        """Test handling when no holdings data is available"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = {}

        with pytest.raises(ValueError, match="No holdings data found"):
            service.get_sector_tickers("XLK")

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_empty_holdings(self, mock_is_valid, mock_yq_ticker, service):
        """Test handling when holdings array is empty"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = {
            "XLK": {"holdings": []}
        }

        with pytest.raises(ValueError, match="No valid holdings found"):
            service.get_sector_tickers("XLK")

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_filters_invalid_holdings(self, mock_is_valid, mock_yq_ticker, service):
        """Test that holdings without symbol or holdingPercent are filtered out"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = {
            "XLK": {
                "holdings": [
                    {"symbol": "AAPL", "holdingPercent": 0.25},
                    {"symbol": None, "holdingPercent": 0.10},  # Invalid - no symbol
                    {"symbol": "MSFT", "holdingPercent": 0},   # Invalid - 0 percent
                    {"symbol": "GOOGL", "holdingPercent": 0.15},
                ]
            }
        }

        tickers, total_weight = service.get_sector_tickers("XLK", limit=None)

        # Should only include AAPL and GOOGL
        assert len(tickers) == 2
        assert "AAPL" in tickers
        assert "GOOGL" in tickers

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_api_exception(self, mock_is_valid, mock_yq_ticker, service):
        """Test handling of API exceptions"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = None
        mock_yq_ticker.side_effect = Exception("API Error")

        with pytest.raises(ValueError, match="Failed to fetch ETF holdings"):
            service.get_sector_tickers("XLK")

    @patch('app.services.sector_service.resolve_sector_identifier')
    def test_resolve_sector_key_success(self, mock_resolve, service):
        """Test successful sector key resolution"""
        mock_resolve.return_value = "XLK"

        result = service.resolve_sector_key("XLK")

        assert result == "XLK"
        mock_resolve.assert_called_once_with("XLK")

    @patch('app.services.sector_service.resolve_sector_identifier')
    def test_resolve_sector_key_raises_error(self, mock_resolve, service):
        """Test that resolve_sector_key propagates errors from resolve_sector_identifier"""
        mock_resolve.side_effect = ValueError("Invalid sector")

        with pytest.raises(ValueError, match="Invalid sector"):
            service.resolve_sector_key("INVALID")

    @patch('app.services.sector_service.resolve_sector_identifier')
    @patch('app.services.sector_service.get_etf_display_name')
    def test_get_sector_metadata(self, mock_get_name, mock_resolve, service):
        """Test sector metadata retrieval"""
        mock_resolve.return_value = "XLK"
        mock_get_name.return_value = "Technology"

        metadata = service.get_sector_metadata("XLK")

        assert metadata["etf_ticker"] == "XLK"
        assert metadata["display_name"] == "Technology"

    @patch('app.services.sector_service.get_all_etf_tickers')
    def test_get_all_sectors(self, mock_get_all, service):
        """Test retrieval of all sectors"""
        mock_get_all.return_value = ["XLK", "XLF", "XLE", "XLV"]

        sectors = service.get_all_sectors()

        assert len(sectors) == 4
        assert "XLK" in sectors
        assert "XLF" in sectors

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_limit_negative(self, mock_is_valid, mock_yq_ticker, service, mock_etf_holdings_data):
        """Test that negative limit returns all tickers"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = mock_etf_holdings_data

        tickers, _ = service.get_sector_tickers("XLK", limit=-1)

        # Should return all 8 tickers
        assert len(tickers) == 8

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    @patch('app.services.sector_service.resolve_sector_identifier')
    def test_get_sector_tickers_resolves_identifier(self, mock_resolve, mock_is_valid, mock_yq_ticker, service, mock_etf_holdings_data):
        """Test that get_sector_tickers resolves sector identifier"""
        mock_resolve.return_value = "XLK"
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = mock_etf_holdings_data

        service.get_sector_tickers("technology", limit=5)

        # Should call resolve_sector_identifier
        mock_resolve.assert_called_once_with("technology")

    @patch('app.services.sector_service.YQTicker')
    @patch('app.services.sector_service.is_valid_etf_ticker')
    def test_get_sector_tickers_weight_coverage(self, mock_is_valid, mock_yq_ticker, service):
        """Test that weight coverage is correctly calculated"""
        mock_is_valid.return_value = True
        mock_yq_ticker.return_value.fund_holding_info = {
            "SPY": {
                "holdings": [
                    {"symbol": "AAPL", "holdingPercent": 0.07},
                    {"symbol": "MSFT", "holdingPercent": 0.06},
                    {"symbol": "NVDA", "holdingPercent": 0.05},
                ]
            }
        }

        tickers, total_weight = service.get_sector_tickers("SPY", limit=2)

        # Should return top 2 with combined weight of 0.13
        assert len(tickers) == 2
        assert abs(total_weight - 0.13) < 0.01


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
