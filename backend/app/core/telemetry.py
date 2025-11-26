"""
OpenTelemetry Distributed Tracing

Provides distributed tracing capabilities for:
- Request tracing across services
- Database query tracing
- External API call tracing
- Custom span creation

Configuration:
    Set these environment variables:
    - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint (e.g., http://localhost:4317)
    - OTEL_SERVICE_NAME: Service name for traces (default: creditwhisperers-backend)
    - OTEL_ENABLED: Enable/disable tracing (default: true if endpoint set)

Usage:
    from app.core.telemetry import init_telemetry, get_tracer, trace_external_call

    # Initialize on app startup
    init_telemetry(app)

    # Create custom spans
    tracer = get_tracer()
    with tracer.start_as_current_span("my-operation"):
        do_something()
"""

import os
import logging
from typing import Optional, Callable, Any
from functools import wraps
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Global tracer instance
_tracer = None
_initialized = False


def init_telemetry(
    app=None,
    service_name: str = None,
    otlp_endpoint: str = None,
) -> bool:
    """
    Initialize OpenTelemetry tracing.

    Args:
        app: FastAPI application instance
        service_name: Service name for traces
        otlp_endpoint: OTLP collector endpoint

    Returns:
        bool: True if initialized successfully, False otherwise
    """
    global _tracer, _initialized

    # Get configuration from environment
    service_name = service_name or os.getenv("OTEL_SERVICE_NAME", "creditwhisperers-backend")
    otlp_endpoint = otlp_endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    otel_enabled = os.getenv("OTEL_ENABLED", "true").lower() in ("true", "1", "yes")

    if not otel_enabled:
        logger.info("OpenTelemetry tracing disabled via OTEL_ENABLED=false")
        _initialized = True
        return False

    if not otlp_endpoint:
        logger.info("OpenTelemetry tracing disabled: OTEL_EXPORTER_OTLP_ENDPOINT not set")
        _initialized = True
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.requests import RequestsInstrumentor
        from opentelemetry.instrumentation.logging import LoggingInstrumentor

        # Create resource with service info
        resource = Resource(attributes={
            SERVICE_NAME: service_name,
            "service.version": os.getenv("APP_VERSION", "1.0.0"),
            "deployment.environment": os.getenv("ENVIRONMENT", "development"),
        })

        # Create tracer provider
        provider = TracerProvider(resource=resource)

        # Configure OTLP exporter
        otlp_exporter = OTLPSpanExporter(
            endpoint=otlp_endpoint,
            insecure=otlp_endpoint.startswith("http://"),
        )

        # Add span processor
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

        # Set global tracer provider
        trace.set_tracer_provider(provider)

        # Get tracer
        _tracer = trace.get_tracer(__name__)

        # Instrument FastAPI
        if app:
            FastAPIInstrumentor.instrument_app(app)
            logger.info("FastAPI instrumentation enabled")

        # Instrument requests library (for external API calls)
        RequestsInstrumentor().instrument()
        logger.info("Requests library instrumentation enabled")

        # Instrument logging (adds trace context to logs)
        LoggingInstrumentor().instrument(set_logging_format=True)
        logger.info("Logging instrumentation enabled")

        _initialized = True
        logger.info(f"OpenTelemetry tracing initialized: service={service_name}, endpoint={otlp_endpoint}")
        return True

    except ImportError as e:
        logger.warning(f"OpenTelemetry packages not installed: {e}")
        logger.warning("Install with: pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp")
        _initialized = True
        return False

    except Exception as e:
        logger.error(f"Failed to initialize OpenTelemetry: {e}")
        _initialized = True
        return False


def get_tracer():
    """
    Get the global tracer instance.

    Returns:
        Tracer or NoOpTracer if not initialized
    """
    global _tracer

    if _tracer is not None:
        return _tracer

    # Return a no-op tracer if not initialized
    try:
        from opentelemetry import trace
        return trace.get_tracer(__name__)
    except ImportError:
        return NoOpTracer()


class NoOpTracer:
    """
    No-op tracer for when OpenTelemetry is not available.
    Provides the same interface but does nothing.
    """

    @contextmanager
    def start_as_current_span(self, name: str, **kwargs):
        yield NoOpSpan()

    def start_span(self, name: str, **kwargs):
        return NoOpSpan()


class NoOpSpan:
    """No-op span that does nothing."""

    def set_attribute(self, key: str, value: Any):
        pass

    def set_status(self, status):
        pass

    def record_exception(self, exception):
        pass

    def add_event(self, name: str, attributes=None):
        pass

    def end(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


# =============================================================================
# Tracing Decorators and Helpers
# =============================================================================

def trace_function(
    name: str = None,
    attributes: dict = None,
):
    """
    Decorator to trace a function execution.

    Args:
        name: Custom span name (defaults to function name)
        attributes: Additional span attributes

    Usage:
        @trace_function("process-payment")
        def process_payment(amount):
            ...
    """
    def decorator(func: Callable) -> Callable:
        span_name = name or func.__name__

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    span.record_exception(e)
                    raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    span.record_exception(e)
                    raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


@contextmanager
def trace_external_call(
    service_name: str,
    operation: str,
    url: str = None,
):
    """
    Context manager for tracing external API calls.

    Args:
        service_name: Name of the external service (e.g., "yahoo-finance")
        operation: Operation being performed (e.g., "get-stock-price")
        url: Request URL

    Usage:
        with trace_external_call("yahoo-finance", "get-price", url):
            response = requests.get(url)
    """
    tracer = get_tracer()
    span_name = f"{service_name}.{operation}"

    with tracer.start_as_current_span(span_name) as span:
        span.set_attribute("external.service", service_name)
        span.set_attribute("external.operation", operation)
        if url:
            span.set_attribute("http.url", url)

        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_attribute("error", True)
            span.set_attribute("error.message", str(e))
            raise


@contextmanager
def trace_database_operation(
    operation: str,
    collection: str = None,
    query: str = None,
):
    """
    Context manager for tracing database operations.

    Args:
        operation: Database operation (e.g., "find", "insert", "update")
        collection: Collection/table name
        query: Query string (be careful not to include sensitive data)

    Usage:
        with trace_database_operation("find", "users"):
            result = db.users.find({"active": True})
    """
    tracer = get_tracer()
    span_name = f"db.{operation}"
    if collection:
        span_name = f"db.{collection}.{operation}"

    with tracer.start_as_current_span(span_name) as span:
        span.set_attribute("db.operation", operation)
        span.set_attribute("db.system", "mongodb")
        if collection:
            span.set_attribute("db.collection", collection)
        if query:
            span.set_attribute("db.statement", query)

        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_attribute("error", True)
            raise


def add_trace_attributes(**attributes):
    """
    Add attributes to the current span.

    Usage:
        add_trace_attributes(user_id="123", symbol="AAPL")
    """
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        for key, value in attributes.items():
            span.set_attribute(key, value)
    except (ImportError, Exception):
        pass  # Silently ignore if tracing not available


def add_trace_event(name: str, attributes: dict = None):
    """
    Add an event to the current span.

    Usage:
        add_trace_event("cache-miss", {"key": "stock:AAPL"})
    """
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        span.add_event(name, attributes=attributes)
    except (ImportError, Exception):
        pass


def get_trace_id() -> Optional[str]:
    """
    Get the current trace ID for correlation.

    Returns:
        str: Trace ID or None if no active trace
    """
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span and span.get_span_context().is_valid:
            return format(span.get_span_context().trace_id, "032x")
    except (ImportError, Exception):
        pass
    return None


def get_span_id() -> Optional[str]:
    """
    Get the current span ID for correlation.

    Returns:
        str: Span ID or None if no active span
    """
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span and span.get_span_context().is_valid:
            return format(span.get_span_context().span_id, "016x")
    except (ImportError, Exception):
        pass
    return None
