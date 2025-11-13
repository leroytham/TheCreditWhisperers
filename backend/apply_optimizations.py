#!/usr/bin/env python3
"""
Script to apply portfolio API optimizations
Run this script to automatically integrate the optimizations into your application
"""

import os
import sys
import shutil
from pathlib import Path
import re

def backup_file(filepath):
    """Create a backup of the file"""
    backup_path = f"{filepath}.backup"
    if not Path(backup_path).exists():
        shutil.copy2(filepath, backup_path)
        print(f"✅ Created backup: {backup_path}")
    else:
        print(f"⚠️  Backup already exists: {backup_path}")

def update_routes_file():
    """Update the routes.py file to use optimized version"""
    routes_file = Path("app/api/routes.py")

    if not routes_file.exists():
        print("❌ routes.py not found!")
        return False

    # Backup original
    backup_file(routes_file)

    with open(routes_file, 'r') as f:
        content = f.read()

    # Check if already updated
    if "routes_optimized" in content:
        print("✅ Routes already optimized")
        return True

    # Add import at the top
    import_line = "from app.api.routes_optimized import get_portfolio_holdings_optimized, RequestContextCache\n"

    # Find the imports section
    import_pattern = r"(from app\.services\.portfolio_sentiment_service import.*\n)"
    content = re.sub(import_pattern, r"\1" + import_line, content)

    # Comment out old function and add reference to new one
    old_function_pattern = r'(@router\.get\("/portfolio/holdings/\{username\}/\{account_name\}"\)\nasync def get_portfolio_holdings.*?)(?=@router|\Z)'

    if re.search(old_function_pattern, content, re.DOTALL):
        # Add comment and routing to optimized version
        replacement = '''# Original function moved to routes_backup.py
# Using optimized version from routes_optimized.py
router.get("/portfolio/holdings/{username}/{account_name}")(get_portfolio_holdings_optimized)

'''
        content = re.sub(old_function_pattern, replacement, content, flags=re.DOTALL)

        with open(routes_file, 'w') as f:
            f.write(content)
        print("✅ Updated routes.py to use optimized endpoint")
        return True
    else:
        print("⚠️  Could not find portfolio holdings endpoint to replace")
        print("   Please manually update routes.py")
        return False

def update_main_app():
    """Update the main application file to add middleware"""

    # Try to find main app file
    main_files = ["main.py", "app.py", "app/main.py", "app/app.py"]
    main_file = None

    for file in main_files:
        if Path(file).exists():
            main_file = Path(file)
            break

    if not main_file:
        print("⚠️  Could not find main application file (main.py or app.py)")
        print("   Please manually add middleware to your FastAPI app")
        return False

    backup_file(main_file)

    with open(main_file, 'r') as f:
        content = f.read()

    # Check if already updated
    if "RateLimitMiddleware" in content:
        print("✅ Middleware already added")
        return True

    # Add imports
    middleware_imports = """
# Optimization imports
from app.middleware.rate_limiter import RateLimitMiddleware
from app.core.logging_config import setup_logging, loggers
import uuid
import time
"""

    # Add after FastAPI import
    content = content.replace("from fastapi import FastAPI",
                             "from fastapi import FastAPI" + middleware_imports)

    # Add middleware after app creation
    app_creation_pattern = r'(app = FastAPI\([^)]*\))'
    middleware_code = r'''\1

# Add rate limiting middleware
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=60,
    burst_size=10
)

# Add request tracking middleware
@app.middleware("http")
async def add_request_tracking(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id

    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration:.0f}ms"

    return response
'''

    content = re.sub(app_creation_pattern, middleware_code, content)

    with open(main_file, 'w') as f:
        f.write(content)

    print(f"✅ Updated {main_file} with middleware")
    return True

def update_news_service():
    """Update news service to use circuit breaker"""
    news_service_file = Path("app/services/news_service.py")

    if not news_service_file.exists():
        print("⚠️  news_service.py not found")
        return False

    backup_file(news_service_file)

    with open(news_service_file, 'r') as f:
        content = f.read()

    if "circuit_breaker" in content:
        print("✅ Circuit breaker already integrated")
        return True

    # Add import
    import_line = "from app.services.circuit_breaker import alpha_vantage_circuit_breaker\n"
    content = import_line + content

    print("✅ Added circuit breaker import to news_service.py")
    print("   Please manually wrap AlphaVantage calls with circuit breaker")

    with open(news_service_file, 'w') as f:
        f.write(content)

    return True

def create_env_template():
    """Create .env template with optimization settings"""
    env_template = """
# === OPTIMIZATION SETTINGS ===

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_BURST_SIZE=10

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=3
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=120
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
ENABLE_STRUCTURED_LOGGING=true

# Performance
MAX_CONCURRENT_API_CALLS=5
REQUEST_CACHE_TTL_SECONDS=5
"""

    env_file = Path(".env")
    if env_file.exists():
        with open(env_file, 'a') as f:
            f.write(env_template)
        print("✅ Added optimization settings to .env")
    else:
        with open(".env.template", 'w') as f:
            f.write(env_template)
        print("✅ Created .env.template with optimization settings")

def main():
    """Run all optimization steps"""
    print("\n🚀 Applying Portfolio API Optimizations\n")
    print("=" * 50)

    # Check if we're in the right directory
    if not Path("app/api/routes.py").exists():
        print("❌ Error: Please run this script from the backend directory")
        sys.exit(1)

    # Verify optimization files exist
    required_files = [
        "app/api/routes_optimized.py",
        "app/middleware/rate_limiter.py",
        "app/services/circuit_breaker.py",
        "app/core/logging_config.py"
    ]

    missing_files = [f for f in required_files if not Path(f).exists()]
    if missing_files:
        print("❌ Missing optimization files:")
        for f in missing_files:
            print(f"   - {f}")
        print("\nPlease ensure all optimization files are in place")
        sys.exit(1)

    print("✅ All optimization files found\n")

    # Apply optimizations
    steps = [
        ("Updating routes.py...", update_routes_file),
        ("Updating main application...", update_main_app),
        ("Updating news service...", update_news_service),
        ("Creating environment template...", create_env_template)
    ]

    success = True
    for description, func in steps:
        print(f"\n{description}")
        if not func():
            success = False

    print("\n" + "=" * 50)

    if success:
        print("\n✅ Optimizations applied successfully!")
        print("\nNext steps:")
        print("1. Review the changes in your IDE")
        print("2. Update your .env file with the new settings")
        print("3. Test the optimized endpoints")
        print("4. Monitor performance using /api/admin/performance")
    else:
        print("\n⚠️  Some optimizations require manual intervention")
        print("   Please check the messages above and INTEGRATION_INSTRUCTIONS.md")

    print("\n📝 Rollback instructions:")
    print("   - Restore backups: *.backup files")
    print("   - Or run: git checkout -- .")

if __name__ == "__main__":
    main()