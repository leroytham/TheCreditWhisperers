# gunicorn_config.py
"""
Gunicorn configuration file for handling multi-worker deployments.
This file is used in production to ensure proper MongoDB connection handling
after Gunicorn forks worker processes.
"""

import os


def post_fork(server, worker):
    """
    Called after a worker has been forked.

    This hook is critical for fixing MongoDB connection issues in multi-worker
    deployments. MongoDB connections are not fork-safe, so we need to reset
    them after each worker process is created.

    Args:
        server: The Arbiter which forked the worker
        worker: The worker that was just forked
    """
    # Import here to avoid circular dependencies
    from app.database import reset_connections

    # Reset MongoDB connections for this worker
    print(f"[Worker {worker.pid}] Initializing MongoDB connections after fork...")
    reset_connections()
    print(f"[Worker {worker.pid}] MongoDB connections initialized successfully")

    # Also reset any other connection pools if needed
    # For example, if you have Redis connections:
    try:
        from app.core.cache import redis_cache
        if redis_cache and hasattr(redis_cache, 'reset'):
            redis_cache.reset()
            print(f"[Worker {worker.pid}] Redis cache reset")
    except ImportError:
        pass  # Redis cache not available
    except Exception as e:
        print(f"[Worker {worker.pid}] Warning: Failed to reset Redis cache: {e}")


def worker_int(worker):
    """
    Called just after a worker exited on SIGINT or SIGQUIT.

    Args:
        worker: The worker that is being shut down
    """
    print(f"[Worker {worker.pid}] Shutting down...")

    # Clean up MongoDB connections
    try:
        from app.database import close_database_connection
        close_database_connection()
        print(f"[Worker {worker.pid}] MongoDB connections closed")
    except Exception as e:
        print(f"[Worker {worker.pid}] Warning: Error closing MongoDB connections: {e}")


def pre_fork(server, worker):
    """
    Called just before a worker is forked.

    Args:
        server: The Arbiter which will fork the worker
        worker: The worker that will be forked
    """
    print(f"[Master] Forking worker {worker}...")


def pre_exec(server):
    """
    Called just before a new master process is forked.

    Args:
        server: The Arbiter
    """
    print("[Master] Forking new master process...")


def when_ready(server):
    """
    Called just after the server is started.

    Args:
        server: The Arbiter
    """
    print(f"[Master] Gunicorn server is ready. Listening at: {server.address}")
    print(f"[Master] Using {server.num_workers} worker processes")


# Additional Gunicorn settings (these can also be set via command line)
# bind = "0.0.0.0:8000"
# workers = 4  # Set via command line -w flag
# worker_class = "uvicorn.workers.UvicornWorker"  # Set via command line -k flag
# timeout = 120  # Set via command line
# keepalive = 5  # Set via command line
# max_requests = 1000  # Set via command line
# max_requests_jitter = 50  # Set via command line

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"

# Process naming
proc_name = "credit-fyp-backend"

# Server mechanics
daemon = False  # Don't daemonize (important for Azure App Service)
pidfile = None  # No pid file needed for Azure