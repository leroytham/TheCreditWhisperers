# app/core/logging_config.py
"""
Enhanced logging configuration with request tracking and monitoring
"""

import logging
import logging.handlers
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional
import traceback
from pathlib import Path
import asyncio
import uuid


class RequestContextFilter(logging.Filter):
    """
    Add request context to log records
    """
    def filter(self, record):
        # Add request ID if available
        record.request_id = getattr(record, 'request_id', 'no-request')
        record.username = getattr(record, 'username', 'anonymous')
        return True


class StructuredFormatter(logging.Formatter):
    """
    Format logs as structured JSON for better parsing
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, 'request_id', None),
            "username": getattr(record, 'username', None),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info)
            }

        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'created', 'filename', 'funcName',
                          'levelname', 'levelno', 'lineno', 'module', 'msecs',
                          'message', 'pathname', 'process', 'processName', 'relativeCreated',
                          'thread', 'threadName', 'exc_info', 'exc_text', 'stack_info',
                          'request_id', 'username']:
                log_data[key] = value

        return json.dumps(log_data)


class PerformanceLogger:
    """
    Logger for tracking API performance metrics
    """

    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.metrics: Dict[str, list] = {}
        self._lock = asyncio.Lock()

    async def log_request(
        self,
        request_id: str,
        endpoint: str,
        duration_ms: float,
        status_code: int,
        username: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Log request performance metrics"""
        metric = {
            "request_id": request_id,
            "endpoint": endpoint,
            "duration_ms": duration_ms,
            "status_code": status_code,
            "username": username,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }

        async with self._lock:
            if endpoint not in self.metrics:
                self.metrics[endpoint] = []
            self.metrics[endpoint].append(metric)

            # Keep only last 1000 metrics per endpoint
            if len(self.metrics[endpoint]) > 1000:
                self.metrics[endpoint] = self.metrics[endpoint][-1000:]

        # Log to standard logger
        self.logger.info(
            f"[PERF] {endpoint} completed",
            extra={
                "request_id": request_id,
                "duration_ms": duration_ms,
                "status_code": status_code,
                "username": username,
                **metric["metadata"]
            }
        )

    async def get_stats(self, endpoint: Optional[str] = None) -> Dict:
        """Get performance statistics"""
        async with self._lock:
            if endpoint:
                metrics = self.metrics.get(endpoint, [])
            else:
                metrics = []
                for endpoint_metrics in self.metrics.values():
                    metrics.extend(endpoint_metrics)

            if not metrics:
                return {"message": "No metrics available"}

            durations = [m["duration_ms"] for m in metrics]
            status_codes = [m["status_code"] for m in metrics]

            return {
                "endpoint": endpoint,
                "total_requests": len(metrics),
                "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
                "min_duration_ms": min(durations) if durations else 0,
                "max_duration_ms": max(durations) if durations else 0,
                "p50_duration_ms": sorted(durations)[len(durations) // 2] if durations else 0,
                "p95_duration_ms": sorted(durations)[int(len(durations) * 0.95)] if durations else 0,
                "p99_duration_ms": sorted(durations)[int(len(durations) * 0.99)] if durations else 0,
                "success_rate": sum(1 for s in status_codes if 200 <= s < 300) / len(status_codes) if status_codes else 0,
                "error_rate": sum(1 for s in status_codes if s >= 400) / len(status_codes) if status_codes else 0
            }


class APICallLogger:
    """
    Specialized logger for tracking external API calls
    """

    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.api_calls: Dict[str, list] = {}
        self._lock = asyncio.Lock()

    async def log_api_call(
        self,
        api_name: str,
        endpoint: str,
        duration_ms: float,
        success: bool,
        request_id: str,
        error: Optional[str] = None,
        cached: bool = False
    ):
        """Log external API call"""
        call_data = {
            "api_name": api_name,
            "endpoint": endpoint,
            "duration_ms": duration_ms,
            "success": success,
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
            "error": error,
            "cached": cached
        }

        async with self._lock:
            if api_name not in self.api_calls:
                self.api_calls[api_name] = []
            self.api_calls[api_name].append(call_data)

            # Keep only last 1000 calls per API
            if len(self.api_calls[api_name]) > 1000:
                self.api_calls[api_name] = self.api_calls[api_name][-1000:]

        # Log to standard logger
        level = logging.INFO if success else logging.WARNING
        self.logger.log(
            level,
            f"[API-CALL] {api_name} {endpoint} {'SUCCESS' if success else 'FAILED'}",
            extra={
                "request_id": request_id,
                "api_name": api_name,
                "endpoint": endpoint,
                "duration_ms": duration_ms,
                "success": success,
                "error": error,
                "cached": cached
            }
        )

    async def get_api_stats(self, api_name: Optional[str] = None) -> Dict:
        """Get API call statistics"""
        async with self._lock:
            if api_name:
                calls = self.api_calls.get(api_name, [])
            else:
                calls = []
                for api_calls in self.api_calls.values():
                    calls.extend(api_calls)

            if not calls:
                return {"message": "No API calls logged"}

            durations = [c["duration_ms"] for c in calls]
            success_count = sum(1 for c in calls if c["success"])
            cache_count = sum(1 for c in calls if c.get("cached", False))

            return {
                "api_name": api_name,
                "total_calls": len(calls),
                "success_count": success_count,
                "failure_count": len(calls) - success_count,
                "cache_hits": cache_count,
                "cache_hit_rate": cache_count / len(calls) if calls else 0,
                "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
                "min_duration_ms": min(durations) if durations else 0,
                "max_duration_ms": max(durations) if durations else 0,
                "success_rate": success_count / len(calls) if calls else 0
            }


def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    enable_structured: bool = True
) -> Dict[str, Any]:
    """
    Setup comprehensive logging configuration

    Returns:
        Dictionary with logger instances and utilities
    """
    # Create logs directory if needed
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))

    # Remove existing handlers
    root_logger.handlers = []

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    if enable_structured:
        console_handler.setFormatter(StructuredFormatter())
    else:
        console_handler.setFormatter(
            logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s'
            )
        )

    # Add request context filter
    console_handler.addFilter(RequestContextFilter())
    root_logger.addHandler(console_handler)

    # File handler if specified
    if log_file:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        if enable_structured:
            file_handler.setFormatter(StructuredFormatter())
        else:
            file_handler.setFormatter(
                logging.Formatter(
                    '%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s'
                )
            )
        file_handler.addFilter(RequestContextFilter())
        root_logger.addHandler(file_handler)

    # Create specialized loggers
    app_logger = logging.getLogger("app")
    api_logger = logging.getLogger("app.api")
    service_logger = logging.getLogger("app.services")

    # Create utility instances
    perf_logger = PerformanceLogger(api_logger)
    api_call_logger = APICallLogger(service_logger)

    return {
        "app": app_logger,
        "api": api_logger,
        "services": service_logger,
        "performance": perf_logger,
        "api_calls": api_call_logger
    }


# Global logger instances
loggers = setup_logging(
    log_level="INFO",
    log_file="logs/app.log" if Path("logs").exists() else None,
    enable_structured=True
)