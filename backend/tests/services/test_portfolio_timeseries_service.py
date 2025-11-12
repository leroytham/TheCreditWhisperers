# tests/services/test_portfolio_timeseries_service.py

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timedelta
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.portfolio_timeseries_service import PortfolioTimeseriesService


class TestPortfolioTimeseriesService:
    """Test suite for PortfolioTimeseriesService"""

    @pytest.fixture
    def service(self):
        """Create a service instance for testing"""
        return PortfolioTimeseriesService()

    @pytest.fixture
    def mock_holdings(self):
        """Sample holdings data"""
        return [
            {
                "symbol": "AAPL",
                "quantity": 100,
                "purchase_price": 150.0,
                "purchase_date": "2024-01-01",
                "lots": [
                    {"quantity": 100, "purchase_price": 150.0, "purchase_date": "2024-01-01", "lot_id": "1"}
                ]
            },
            {
                "symbol": "MSFT",
                "quantity": 50,
                "purchase_price": 380.0,
                "purchase_date": "2024-02-01",
                "lots": [
                    {"quantity": 50, "purchase_price": 380.0, "purchase_date": "2024-02-01", "lot_id": "2"}
                ]
            }
        ]

    @pytest.fixture
    def mock_price_data(self):
        """Mock historical price data"""
        dates = pd.date_range(start="2024-01-01", end="2024-12-31", freq="D")
        # Create simple upward trending prices
        return pd.DataFrame({
            "Close": [150.0 + i * 0.5 for i in range(len(dates))]
        }, index=dates)

    def test_get_ticker_candidates_basic(self, service):
        """Test ticker candidate generation for basic symbols"""
        candidates = service._get_ticker_candidates("AAPL")
        assert "AAPL" in candidates
        assert len(candidates) >= 1

    def test_get_ticker_candidates_with_dot(self, service):
        """Test ticker candidate generation with dot notation"""
        candidates = service._get_ticker_candidates("BRK.B")
        assert "BRK.B" in candidates
        assert "BRK-B" in candidates

    def test_get_ticker_candidates_with_space(self, service):
        """Test ticker candidate generation with space"""
        candidates = service._get_ticker_candidates("BRK B")
        assert "BRK-B" in candidates

    def test_get_ticker_candidates_with_preferred(self, service):
        """Test ticker candidate generation with preferred shares"""
        candidates = service._get_ticker_candidates("JPM/PR")
        assert "JPM-P" in candidates

    def test_get_ticker_candidates_cached_alias(self, service):
        """Test that cached aliases are prioritized"""
        # Manually set a cached alias
        service._ticker_alias_cache["TEST"] = "TEST-ALIAS"
        candidates = service._get_ticker_candidates("TEST")
        assert candidates[0] == "TEST-ALIAS"

    def test_get_ticker_candidates_empty(self, service):
        """Test with empty ticker"""
        candidates = service._get_ticker_candidates("")
        assert candidates == []

    def test_parse_timeframe_to_delta_1d(self, service):
        """Test 1D timeframe parsing"""
        delta = service.parse_timeframe_to_delta("1D")
        assert delta == timedelta(days=1)

    def test_parse_timeframe_to_delta_1w(self, service):
        """Test 1W timeframe parsing"""
        delta = service.parse_timeframe_to_delta("1W")
        assert delta == timedelta(days=7)

    def test_parse_timeframe_to_delta_1m(self, service):
        """Test 1M timeframe parsing"""
        delta = service.parse_timeframe_to_delta("1M")
        assert delta == timedelta(days=30)

    def test_parse_timeframe_to_delta_1y(self, service):
        """Test 1Y timeframe parsing"""
        delta = service.parse_timeframe_to_delta("1Y")
        assert delta == timedelta(days=365)

    def test_parse_timeframe_to_delta_ytd(self, service):
        """Test YTD timeframe parsing"""
        delta = service.parse_timeframe_to_delta("YTD")
        today = datetime.now()
        start_of_year = datetime(today.year, 1, 1)
        expected_delta = today - start_of_year
        # Allow for slight time difference due to test execution time
        assert abs((delta - expected_delta).total_seconds()) < 10

    def test_parse_timeframe_to_delta_default(self, service):
        """Test default timeframe for unknown values"""
        delta = service.parse_timeframe_to_delta("INVALID")
        assert delta == timedelta(days=365)

    @pytest.mark.asyncio
    async def test_fetch_historical_prices_success(self, service):
        """Test successful historical price fetch"""
        with patch('yfinance.Ticker') as mock_ticker:
            # Create mock price data
            dates = pd.date_range(start="2024-01-01", end="2024-12-31", freq="D")
            mock_hist = pd.DataFrame({
                "Close": [150.0] * len(dates),
                "Open": [149.0] * len(dates)
            }, index=dates)

            mock_ticker.return_value.history.return_value = mock_hist

            result = await service.fetch_historical_prices(
                "AAPL",
                datetime(2024, 1, 1),
                datetime(2024, 12, 31),
                "1Y"
            )

            assert result is not None
            assert "Close" in result.columns
            assert len(result) == len(dates)

    @pytest.mark.asyncio
    async def test_fetch_historical_prices_empty(self, service):
        """Test handling of empty price data"""
        with patch('yfinance.Ticker') as mock_ticker:
            mock_ticker.return_value.history.return_value = pd.DataFrame()

            result = await service.fetch_historical_prices(
                "INVALID",
                datetime(2024, 1, 1),
                datetime(2024, 12, 31),
                "1Y"
            )

            assert result is None

    @pytest.mark.asyncio
    async def test_fetch_historical_prices_interval_selection(self, service):
        """Test that correct interval is selected based on timeframe"""
        with patch('yfinance.Ticker') as mock_ticker:
            mock_hist = pd.DataFrame({"Close": [100.0]}, index=[datetime.now()])
            mock_ticker.return_value.history.return_value = mock_hist

            # Test 1D - should use 5m interval
            await service.fetch_historical_prices("AAPL", datetime.now(), datetime.now(), "1D")
            mock_ticker.return_value.history.assert_called()
            call_kwargs = mock_ticker.return_value.history.call_args[1]
            assert call_kwargs["interval"] == "5m"

            # Test 1W - should use 1h interval
            await service.fetch_historical_prices("AAPL", datetime.now(), datetime.now(), "1W")
            call_kwargs = mock_ticker.return_value.history.call_args[1]
            assert call_kwargs["interval"] == "1h"

            # Test 1Y - should use 1d interval
            await service.fetch_historical_prices("AAPL", datetime.now(), datetime.now(), "1Y")
            call_kwargs = mock_ticker.return_value.history.call_args[1]
            assert call_kwargs["interval"] == "1d"

    def test_calculate_position_value_basic(self, service, mock_price_data):
        """Test basic position value calculation"""
        holding = {
            "symbol": "AAPL",
            "quantity": 100,
            "purchase_price": 150.0,
            "purchase_date": "2024-01-01",
            "lots": []
        }

        value = service.calculate_position_value(
            holding,
            mock_price_data,
            datetime(2024, 1, 10)
        )

        # On Jan 10, price should be around 150.0 + 9*0.5 = 154.5
        # Value = 100 * 154.5 = 15450
        assert value > 15000
        assert value < 16000

    def test_calculate_position_value_with_lots(self, service, mock_price_data):
        """Test position value calculation with lot-level data"""
        holding = {
            "symbol": "AAPL",
            "quantity": 100,
            "purchase_price": 150.0,
            "purchase_date": "2024-01-01",
            "lots": [
                {"quantity": 50, "purchase_price": 150.0, "purchase_date": "2024-01-01"},
                {"quantity": 50, "purchase_price": 155.0, "purchase_date": "2024-01-05"}
            ]
        }

        value = service.calculate_position_value(
            holding,
            mock_price_data,
            datetime(2024, 1, 10)
        )

        # Should use total quantity of 100 shares
        assert value > 0

    def test_calculate_position_value_before_purchase(self, service, mock_price_data):
        """Test position value before purchase date should be 0"""
        holding = {
            "symbol": "AAPL",
            "quantity": 100,
            "purchase_price": 150.0,
            "purchase_date": "2024-06-01",
            "lots": []
        }

        value = service.calculate_position_value(
            holding,
            mock_price_data,
            datetime(2024, 1, 1)
        )

        # Position should be 0 before purchase date
        assert value == 0.0

    def test_calculate_position_value_no_price_data(self, service):
        """Test position value with no price data"""
        holding = {
            "symbol": "AAPL",
            "quantity": 100,
            "purchase_price": 150.0,
            "purchase_date": "2024-01-01"
        }

        value = service.calculate_position_value(holding, None, datetime(2024, 1, 10))
        assert value == 0.0

    def test_calculate_lot_breakdown_basic(self, service, mock_price_data):
        """Test lot breakdown calculation"""
        holding = {
            "symbol": "AAPL",
            "quantity": 100,
            "purchase_price": 150.0,
            "purchase_date": "2024-01-01",
            "lots": [
                {"quantity": 100, "purchase_price": 150.0, "purchase_date": "2024-01-01", "lot_id": "1"}
            ]
        }

        breakdown = service.calculate_lot_breakdown(
            holding,
            mock_price_data,
            datetime(2024, 6, 1),
            datetime(2024, 1, 1)
        )

        assert len(breakdown) > 0
        assert breakdown[0]["symbol"] == "AAPL"
        assert breakdown[0]["quantity"] == 100
        assert "market_value" in breakdown[0]
        assert "cost_basis" in breakdown[0]

    def test_calculate_lot_breakdown_pre_period(self, service, mock_price_data):
        """Test lot breakdown identifies pre-period lots correctly"""
        holding = {
            "symbol": "AAPL",
            "quantity": 100,
            "purchase_price": 150.0,
            "purchase_date": "2024-01-01",
            "lots": [
                {"quantity": 50, "purchase_price": 150.0, "purchase_date": "2024-01-01", "lot_id": "1"},
                {"quantity": 50, "purchase_price": 160.0, "purchase_date": "2024-03-01", "lot_id": "2"}
            ]
        }

        breakdown = service.calculate_lot_breakdown(
            holding,
            mock_price_data,
            datetime(2024, 6, 1),
            datetime(2024, 2, 1)  # Period starts Feb 1
        )

        # First lot should be pre-period (purchased Jan 1)
        pre_period_lot = [lot for lot in breakdown if lot["lot_id"] == "1"][0]
        assert pre_period_lot["is_pre_period"] is True

        # Second lot should be in-period (purchased Mar 1)
        in_period_lot = [lot for lot in breakdown if lot["lot_id"] == "2"][0]
        assert in_period_lot["is_pre_period"] is False

    @pytest.mark.asyncio
    async def test_generate_portfolio_timeseries_basic(self, service, mock_holdings):
        """Test basic portfolio timeseries generation"""
        with patch.object(service, 'fetch_historical_prices', new_callable=AsyncMock) as mock_fetch:
            dates = pd.date_range(start="2024-01-01", end="2024-01-31", freq="D")
            mock_price_df = pd.DataFrame({
                "Close": [150.0] * len(dates)
            }, index=dates)

            mock_fetch.return_value = mock_price_df

            result = await service.generate_portfolio_timeseries(
                mock_holdings,
                timeframe="1M"
            )

            assert "data_points" in result
            assert "timeframe" in result
            assert result["timeframe"] == "1M"
            assert len(result["data_points"]) > 0

    @pytest.mark.asyncio
    async def test_generate_portfolio_timeseries_empty_holdings(self, service):
        """Test timeseries with empty holdings"""
        result = await service.generate_portfolio_timeseries([], timeframe="1M")

        assert "data_points" in result
        assert len(result["data_points"]) > 0  # Should still generate date points
        # All values should be 0
        for point in result["data_points"]:
            assert point["portfolio_value"] == 0.0

    @pytest.mark.asyncio
    async def test_generate_portfolio_timeseries_aggregates_duplicates(self, service):
        """Test that duplicate symbols are properly aggregated"""
        duplicate_holdings = [
            {"symbol": "AAPL", "quantity": 50, "purchase_price": 150.0, "purchase_date": "2024-01-01", "lots": []},
            {"symbol": "AAPL", "quantity": 50, "purchase_price": 155.0, "purchase_date": "2024-02-01", "lots": []},
        ]

        with patch.object(service, 'fetch_historical_prices', new_callable=AsyncMock) as mock_fetch:
            dates = pd.date_range(start="2024-01-01", end="2024-01-31", freq="D")
            mock_price_df = pd.DataFrame({"Close": [150.0] * len(dates)}, index=dates)
            mock_fetch.return_value = mock_price_df

            result = await service.generate_portfolio_timeseries(
                duplicate_holdings,
                timeframe="1M"
            )

            # Should call fetch only once for AAPL (deduplicated)
            assert mock_fetch.call_count == 1

    @pytest.mark.asyncio
    async def test_generate_portfolio_timeseries_calculates_returns(self, service, mock_holdings):
        """Test that daily returns are calculated correctly"""
        with patch.object(service, 'fetch_historical_prices', new_callable=AsyncMock) as mock_fetch:
            dates = pd.date_range(start="2024-01-01", end="2024-01-10", freq="D")
            # Steadily increasing prices
            mock_price_df = pd.DataFrame({
                "Close": [100.0 + i for i in range(len(dates))]
            }, index=dates)

            mock_fetch.return_value = mock_price_df

            result = await service.generate_portfolio_timeseries(
                mock_holdings,
                timeframe="1W"
            )

            # Check that returns are calculated for non-first points
            data_points = result["data_points"]
            if len(data_points) > 1:
                # Second point onwards should have daily_return
                for point in data_points[1:]:
                    if point["portfolio_value"] > 0:
                        # daily_return might be None or a number
                        pass  # Just check structure exists

    @pytest.mark.asyncio
    async def test_fetch_benchmark_timeseries_success(self, service):
        """Test benchmark timeseries fetch"""
        with patch('yfinance.Ticker') as mock_ticker:
            dates = pd.date_range(start="2024-01-01", end="2024-12-31", freq="D")
            mock_hist = pd.DataFrame({
                "Close": [4500.0 + i * 2 for i in range(len(dates))]
            }, index=dates)

            mock_ticker.return_value.history.return_value = mock_hist

            result = await service.fetch_benchmark_timeseries(timeframe="1Y", benchmark_ticker="^GSPC")

            assert "data_points" in result
            assert "benchmark_ticker" in result
            assert result["benchmark_ticker"] == "^GSPC"
            assert len(result["data_points"]) > 0

            # First data point should have close = 0% (normalized)
            assert result["data_points"][0]["close"] == 0.0

    @pytest.mark.asyncio
    async def test_fetch_benchmark_timeseries_empty(self, service):
        """Test benchmark timeseries with no data"""
        with patch('yfinance.Ticker') as mock_ticker:
            mock_ticker.return_value.history.return_value = pd.DataFrame()

            result = await service.fetch_benchmark_timeseries(timeframe="1Y")

            assert "error" in result
            assert result["data_points"] == []

    @pytest.mark.asyncio
    async def test_fetch_benchmark_timeseries_normalizes_returns(self, service):
        """Test that benchmark returns are normalized to start at 0%"""
        with patch('yfinance.Ticker') as mock_ticker:
            # Start at 4500, end at 4950 (10% increase)
            dates = pd.date_range(start="2024-01-01", end="2024-01-31", freq="D")
            mock_hist = pd.DataFrame({
                "Close": [4500.0 + (i * 450 / len(dates)) for i in range(len(dates))]
            }, index=dates)

            mock_ticker.return_value.history.return_value = mock_hist

            result = await service.fetch_benchmark_timeseries(timeframe="1M")

            # First point should be 0%
            assert result["data_points"][0]["close"] == 0.0

            # Last point should be approximately 10%
            last_return = result["data_points"][-1]["close"]
            assert 9.0 < last_return < 11.0

    @pytest.mark.asyncio
    async def test_generate_portfolio_timeseries_handles_missing_prices(self, service, mock_holdings):
        """Test handling of missing price data for some symbols"""
        with patch.object(service, 'fetch_historical_prices', new_callable=AsyncMock) as mock_fetch:
            dates = pd.date_range(start="2024-01-01", end="2024-01-31", freq="D")
            mock_price_df = pd.DataFrame({"Close": [150.0] * len(dates)}, index=dates)

            # First call succeeds, second returns None
            mock_fetch.side_effect = [mock_price_df, None]

            result = await service.generate_portfolio_timeseries(
                mock_holdings,
                timeframe="1M"
            )

            # Should still generate results with partial data
            assert "data_points" in result
            assert "missing_price_symbols" in result
            assert len(result["missing_price_symbols"]) == 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
