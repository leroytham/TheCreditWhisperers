# tests/core/test_pubsub.py
"""
Unit tests for Redis Pub/Sub Manager.

Tests cover:
- PubSubMessage serialization/deserialization
- PubSubManager singleton pattern
- Channel subscription/unsubscription
- Message publishing
- Message handling and routing
- Reconnection logic
- Status reporting
"""

import pytest
import asyncio
import json
import sys
import os
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

# Mock redis.asyncio before importing pubsub module
mock_redis_asyncio = MagicMock()
mock_redis_asyncio.Redis = MagicMock
mock_redis_asyncio.from_url = MagicMock
sys.modules['redis'] = MagicMock()
sys.modules['redis.asyncio'] = mock_redis_asyncio
sys.modules['redis.asyncio.client'] = MagicMock()

from app.core.pubsub import (
    PubSubMessage,
    MessageType,
    PubSubManager,
)


class TestPubSubMessage:
    """Tests for PubSubMessage dataclass."""

    def test_message_creation(self):
        """Test creating a PubSubMessage."""
        msg = PubSubMessage(
            type=MessageType.PERSONAL,
            target="user123",
            data={"key": "value"},
            timestamp="2024-01-15T10:30:00",
            source_instance="abc12345"
        )

        assert msg.type == MessageType.PERSONAL
        assert msg.target == "user123"
        assert msg.data == {"key": "value"}
        assert msg.timestamp == "2024-01-15T10:30:00"
        assert msg.source_instance == "abc12345"

    def test_message_to_json(self):
        """Test serializing PubSubMessage to JSON."""
        msg = PubSubMessage(
            type=MessageType.TICKER,
            target="AAPL",
            data={"price": 150.25},
            timestamp="2024-01-15T10:30:00",
            source_instance="abc12345"
        )

        json_str = msg.to_json()
        parsed = json.loads(json_str)

        assert parsed["type"] == "ticker"
        assert parsed["target"] == "AAPL"
        assert parsed["data"] == {"price": 150.25}
        assert parsed["timestamp"] == "2024-01-15T10:30:00"
        assert parsed["source_instance"] == "abc12345"

    def test_message_from_json(self):
        """Test deserializing PubSubMessage from JSON."""
        json_str = json.dumps({
            "type": "broadcast",
            "target": "all",
            "data": {"message": "Hello"},
            "timestamp": "2024-01-15T10:30:00",
            "source_instance": "xyz67890"
        })

        msg = PubSubMessage.from_json(json_str)

        assert msg.type == MessageType.BROADCAST
        assert msg.target == "all"
        assert msg.data == {"message": "Hello"}
        assert msg.timestamp == "2024-01-15T10:30:00"
        assert msg.source_instance == "xyz67890"

    def test_message_roundtrip(self):
        """Test serialization roundtrip preserves data."""
        original = PubSubMessage(
            type=MessageType.PERSONAL,
            target="user456",
            data={"nested": {"key": [1, 2, 3]}},
            timestamp="2024-01-15T10:30:00",
            source_instance="def00000"
        )

        json_str = original.to_json()
        restored = PubSubMessage.from_json(json_str)

        assert restored.type == original.type
        assert restored.target == original.target
        assert restored.data == original.data
        assert restored.timestamp == original.timestamp
        assert restored.source_instance == original.source_instance


class TestMessageType:
    """Tests for MessageType enum."""

    def test_message_types(self):
        """Test all message types exist."""
        assert MessageType.PERSONAL.value == "personal"
        assert MessageType.TICKER.value == "ticker"
        assert MessageType.BROADCAST.value == "broadcast"

    def test_message_type_from_string(self):
        """Test creating MessageType from string value."""
        assert MessageType("personal") == MessageType.PERSONAL
        assert MessageType("ticker") == MessageType.TICKER
        assert MessageType("broadcast") == MessageType.BROADCAST


class TestPubSubManagerSingleton:
    """Tests for PubSubManager singleton pattern."""

    def test_singleton_instance(self):
        """Test that PubSubManager maintains state across instances."""
        manager1 = PubSubManager()
        manager1._reset_for_testing()
        manager1.__init__()  # Re-initialize after reset

        manager2 = PubSubManager()

        # Both variables reference the same module-level instance
        assert manager1.instance_id == manager2.instance_id

    def test_instance_id_generated(self):
        """Test that instance ID is generated."""
        manager = PubSubManager()
        manager._reset_for_testing()
        manager.__init__()  # Re-initialize after reset

        assert manager.instance_id is not None
        assert len(manager.instance_id) == 8


class TestPubSubManagerProperties:
    """Tests for PubSubManager properties."""

    def setup_method(self):
        """Reset singleton before each test."""
        self.manager = PubSubManager()
        self.manager._reset_for_testing()
        self.manager.__init__()  # Re-initialize after reset

    def test_is_available_false_initially(self):
        """Test is_available returns False when not connected."""
        assert self.manager.is_available is False

    def test_is_available_true_when_running(self):
        """Test is_available returns True when connected and running."""
        self.manager._redis_client = MagicMock()
        self.manager._is_running = True

        assert self.manager.is_available is True

    def test_set_message_handler(self):
        """Test setting message handler."""
        async def handler(msg_type, target, data):
            pass

        self.manager.set_message_handler(handler)

        assert self.manager._message_handler is handler


class TestPubSubManagerOperations:
    """Tests for PubSubManager async operations."""

    def setup_method(self):
        """Reset singleton before each test."""
        self.manager = PubSubManager()
        self.manager._reset_for_testing()
        self.manager.__init__()  # Re-initialize after reset

    @pytest.mark.asyncio
    @patch('app.core.pubsub.settings')
    @patch('app.core.pubsub.redis.Redis')
    async def test_get_redis_client_with_host_port(self, mock_redis_class, mock_settings):
        """Test getting Redis client using host/port config."""
        mock_settings.PUBSUB_ENABLED = True
        mock_settings.REDIS_URL = None
        mock_settings.REDIS_HOST = "localhost"
        mock_settings.REDIS_PORT = 6379
        mock_settings.REDIS_DB = 0
        mock_settings.REDIS_PASSWORD = None

        mock_client = AsyncMock()
        mock_redis_class.return_value = mock_client

        client = await self.manager._get_redis_client()

        assert client is mock_client
        mock_client.ping.assert_called_once()

    @pytest.mark.asyncio
    async def test_publish_personal_when_unavailable(self):
        """Test publish_personal returns False when not available."""
        self.manager._is_running = False
        self.manager._redis_client = None

        result = await self.manager.publish_personal("user123", {"msg": "test"})

        assert result is False

    @pytest.mark.asyncio
    async def test_publish_ticker_when_unavailable(self):
        """Test publish_ticker returns False when not available."""
        self.manager._is_running = False
        self.manager._redis_client = None

        result = await self.manager.publish_ticker("AAPL", {"price": 150})

        assert result is False

    @pytest.mark.asyncio
    async def test_publish_broadcast_when_unavailable(self):
        """Test publish_broadcast returns False when not available."""
        self.manager._is_running = False
        self.manager._redis_client = None

        result = await self.manager.publish_broadcast({"msg": "broadcast"})

        assert result is False

    @pytest.mark.asyncio
    async def test_publish_personal_success(self):
        """Test successful personal message publishing."""
        mock_client = AsyncMock()
        self.manager._redis_client = mock_client
        self.manager._is_running = True

        result = await self.manager.publish_personal("user123", {"msg": "test"})

        assert result is True
        mock_client.publish.assert_called_once()
        call_args = mock_client.publish.call_args
        assert call_args[0][0] == "notifications:user:user123"

    @pytest.mark.asyncio
    async def test_publish_ticker_uppercases_symbol(self):
        """Test that ticker symbol is uppercased."""
        mock_client = AsyncMock()
        self.manager._redis_client = mock_client
        self.manager._is_running = True

        await self.manager.publish_ticker("aapl", {"price": 150})

        call_args = mock_client.publish.call_args
        assert call_args[0][0] == "notifications:ticker:AAPL"

    @pytest.mark.asyncio
    async def test_subscribe_user_when_unavailable(self):
        """Test subscribe_user does nothing when unavailable."""
        self.manager._is_running = False
        self.manager._redis_client = None

        await self.manager.subscribe_user("user123")

        # Should not raise or add to subscribed channels
        assert "notifications:user:user123" not in self.manager._subscribed_channels

    @pytest.mark.asyncio
    async def test_subscribe_user_success(self):
        """Test successful user subscription."""
        mock_pubsub = AsyncMock()
        self.manager._pubsub = mock_pubsub
        self.manager._redis_client = MagicMock()
        self.manager._is_running = True

        await self.manager.subscribe_user("user123")

        assert "notifications:user:user123" in self.manager._subscribed_channels
        mock_pubsub.subscribe.assert_called_once_with("notifications:user:user123")

    @pytest.mark.asyncio
    async def test_subscribe_user_idempotent(self):
        """Test subscribing to same user twice only subscribes once."""
        mock_pubsub = AsyncMock()
        self.manager._pubsub = mock_pubsub
        self.manager._redis_client = MagicMock()
        self.manager._is_running = True

        await self.manager.subscribe_user("user123")
        await self.manager.subscribe_user("user123")

        assert mock_pubsub.subscribe.call_count == 1

    @pytest.mark.asyncio
    async def test_unsubscribe_user_success(self):
        """Test successful user unsubscription."""
        mock_pubsub = AsyncMock()
        self.manager._pubsub = mock_pubsub
        self.manager._redis_client = MagicMock()
        self.manager._is_running = True
        self.manager._subscribed_channels.add("notifications:user:user123")

        await self.manager.unsubscribe_user("user123")

        assert "notifications:user:user123" not in self.manager._subscribed_channels
        mock_pubsub.unsubscribe.assert_called_once_with("notifications:user:user123")

    @pytest.mark.asyncio
    async def test_subscribe_ticker_uppercases(self):
        """Test ticker subscription uppercases symbol."""
        mock_pubsub = AsyncMock()
        self.manager._pubsub = mock_pubsub
        self.manager._redis_client = MagicMock()
        self.manager._is_running = True

        await self.manager.subscribe_ticker("aapl")

        assert "notifications:ticker:AAPL" in self.manager._subscribed_channels

    @pytest.mark.asyncio
    async def test_unsubscribe_ticker_uppercases(self):
        """Test ticker unsubscription uppercases symbol."""
        mock_pubsub = AsyncMock()
        self.manager._pubsub = mock_pubsub
        self.manager._redis_client = MagicMock()
        self.manager._is_running = True
        self.manager._subscribed_channels.add("notifications:ticker:AAPL")

        await self.manager.unsubscribe_ticker("aapl")

        assert "notifications:ticker:AAPL" not in self.manager._subscribed_channels


class TestPubSubManagerMessageHandling:
    """Tests for message handling logic."""

    def setup_method(self):
        """Reset singleton before each test."""
        self.manager = PubSubManager()
        self.manager._reset_for_testing()
        self.manager.__init__()  # Re-initialize after reset

    @pytest.mark.asyncio
    async def test_handle_message_skips_own_messages(self):
        """Test that messages from same instance are skipped."""
        handler_called = False

        async def handler(msg_type, target, data):
            nonlocal handler_called
            handler_called = True

        self.manager.set_message_handler(handler)

        # Message from same instance
        message = {
            "channel": "notifications:user:user123",
            "data": json.dumps({
                "type": "personal",
                "target": "user123",
                "data": {"msg": "test"},
                "timestamp": "2024-01-15T10:30:00",
                "source_instance": self.manager._instance_id  # Same instance
            })
        }

        await self.manager._handle_message(message)

        assert handler_called is False

    @pytest.mark.asyncio
    async def test_handle_message_dispatches_to_handler(self):
        """Test that messages from other instances are dispatched."""
        received = {}

        async def handler(msg_type, target, data):
            received["type"] = msg_type
            received["target"] = target
            received["data"] = data

        self.manager.set_message_handler(handler)

        message = {
            "channel": "notifications:user:user123",
            "data": json.dumps({
                "type": "personal",
                "target": "user123",
                "data": {"msg": "test"},
                "timestamp": "2024-01-15T10:30:00",
                "source_instance": "other_instance"
            })
        }

        await self.manager._handle_message(message)

        assert received["type"] == "personal"
        assert received["target"] == "user123"
        assert received["data"] == {"msg": "test"}

    @pytest.mark.asyncio
    async def test_handle_message_invalid_json(self):
        """Test that invalid JSON is handled gracefully."""
        handler_called = False

        async def handler(msg_type, target, data):
            nonlocal handler_called
            handler_called = True

        self.manager.set_message_handler(handler)

        message = {
            "channel": "notifications:user:user123",
            "data": "not valid json {"
        }

        # Should not raise
        await self.manager._handle_message(message)

        assert handler_called is False


class TestPubSubManagerStatus:
    """Tests for status reporting."""

    def setup_method(self):
        """Reset singleton before each test."""
        self.manager = PubSubManager()
        self.manager._reset_for_testing()
        self.manager.__init__()  # Re-initialize after reset

    def test_get_status_initial(self):
        """Test initial status values."""
        status = self.manager.get_status()

        assert "instance_id" in status
        assert status["is_available"] is False
        assert status["is_running"] is False
        assert status["subscribed_channels"] == 0
        assert status["reconnect_attempts"] == 0

    def test_get_status_with_subscriptions(self):
        """Test status with active subscriptions."""
        self.manager._subscribed_channels = {
            "notifications:user:user1",
            "notifications:ticker:AAPL",
            "notifications:global"
        }

        status = self.manager.get_status()

        assert status["subscribed_channels"] == 3

    def test_get_status_with_reconnect_attempts(self):
        """Test status after reconnection attempts."""
        self.manager._reconnect_attempts = 3

        status = self.manager.get_status()

        assert status["reconnect_attempts"] == 3


class TestPubSubManagerLifecycle:
    """Tests for start/stop lifecycle."""

    def setup_method(self):
        """Reset singleton before each test."""
        self.manager = PubSubManager()
        self.manager._reset_for_testing()
        self.manager.__init__()  # Re-initialize after reset

    @pytest.mark.asyncio
    @patch('app.core.pubsub.settings')
    async def test_start_disabled_by_config(self, mock_settings):
        """Test start returns False when disabled."""
        mock_settings.PUBSUB_ENABLED = False

        result = await self.manager.start()

        assert result is False
        assert self.manager._is_running is False

    @pytest.mark.asyncio
    async def test_stop_clears_state(self):
        """Test stop clears all state."""
        self.manager._is_running = True
        self.manager._subscribed_channels = {"channel1", "channel2"}
        self.manager._pubsub = AsyncMock()
        self.manager._redis_client = AsyncMock()

        # Create a proper task mock that can be awaited after cancellation
        async def mock_task():
            await asyncio.sleep(10)

        self.manager._subscriber_task = asyncio.create_task(mock_task())

        await self.manager.stop()

        assert self.manager._is_running is False
        assert len(self.manager._subscribed_channels) == 0
        assert self.manager._pubsub is None
        assert self.manager._redis_client is None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
