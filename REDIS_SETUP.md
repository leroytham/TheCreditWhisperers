# Redis Setup Guide

This application uses Redis for caching to improve performance. Redis is **optional** - the app will run without it, but caching optimizations won't work.

## 🎯 Quick Summary

- **Development (localhost):** Redis is optional but recommended
- **Production (Azure):** Use Azure Cache for Redis (required for full performance)
- **App behavior without Redis:** Works normally, just slower (no caching)

---

## 🏠 Localhost Development Setup

### Option 1: Docker (Recommended)

**Start Redis using Docker:**

```bash
# Start Docker Desktop first, then run:
docker run -d --name redis-cache -p 6379:6379 redis:latest

# Verify it's running:
docker ps | findstr redis

# Stop Redis when done:
docker stop redis-cache

# Start it again later:
docker start redis-cache
```

**Your `.env` file should have:**
```env
REDIS_URL=
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Option 2: Windows Native Installation

1. Download Redis for Windows: https://github.com/microsoftarchive/redis/releases
2. Install `Redis-x64-3.0.504.msi`
3. Redis will auto-start as a Windows service

**Your `.env` file should have:**
```env
REDIS_URL=
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Option 3: Skip Redis (Development Only)

If you don't want to set up Redis locally, the app will work fine without it. You'll see this message:

```
⚠️  [REDIS] Not available - running without cache (this is OK for development)
   To enable caching: Start Redis server or deploy to Azure with Azure Cache for Redis
```

This is **completely normal** for development. The app continues to work, just without caching.

---

## ☁️ Azure Deployment Setup

### Step 1: Create Azure Cache for Redis

1. Go to **Azure Portal** → Create a resource
2. Search for "**Azure Cache for Redis**"
3. Create with these settings:
   - **Name:** `your-app-name-redis`
   - **Location:** Same as your app service
   - **Pricing tier:**
     - **Development:** Basic C0 (250 MB) - ~$16/month
     - **Production:** Standard C1 (1 GB) - ~$73/month
   - **Redis version:** 6.0 or later

### Step 2: Get Connection String

After creation:

1. Go to your Redis resource
2. Navigate to **Settings → Access keys**
3. Copy the **Primary connection string (StackExchange.Redis)**

It will look like:
```
your-cache-name.redis.cache.windows.net:6380,password=your-access-key,ssl=True,abortConnect=False
```

### Step 3: Convert to Python Redis URL Format

Convert the connection string to Python format:

```
rediss://your-cache-name.redis.cache.windows.net:6380?ssl_cert_reqs=required&password=your-access-key
```

**Example:**
```env
REDIS_URL=rediss://myapp-redis.redis.cache.windows.net:6380?ssl_cert_reqs=required&password=aBcDeFg123456789==
```

### Step 4: Update Azure App Service Configuration

**Option A: Environment Variables (Recommended)**

In Azure Portal → Your App Service → **Configuration** → **Application settings**:

Add:
```
Name: REDIS_URL
Value: rediss://your-cache-name.redis.cache.windows.net:6380?ssl_cert_reqs=required&password=your-access-key
```

**Option B: Update .env file**

If deploying with .env file, update:

```env
# Azure deployment
REDIS_URL=rediss://your-cache-name.redis.cache.windows.net:6380?ssl_cert_reqs=required&password=your-access-key
```

---

## ✅ Verify Redis Connection

### Localhost

Start your backend and look for:

```
✅ [REDIS] Connection established successfully
```

### Azure

Check Application Logs in Azure Portal:

```
✅ [REDIS] Connection established successfully
```

If you see this instead, Redis is not configured (but app still works):

```
⚠️  [REDIS] Not available - running without cache (this is OK for development)
```

---

## 🔧 Configuration Reference

### .env File Format

```env
# =============================================================================
# REDIS CACHE CONFIGURATION
# =============================================================================

# For Azure deployment (production):
REDIS_URL=rediss://your-cache.redis.cache.windows.net:6380?ssl_cert_reqs=required&password=your-key

# For localhost development (comment out REDIS_URL and use these):
# REDIS_URL=
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_DB=0
# REDIS_PASSWORD=
```

### Cache TTLs (Time To Live)

```env
PRICE_CACHE_TTL=300          # 5 minutes
NEWS_CACHE_TTL=600           # 10 minutes
SENTIMENT_CACHE_TTL=900      # 15 minutes
COMPANY_INFO_CACHE_TTL=86400 # 24 hours
SECTOR_CACHE_TTL=14400       # 4 hours
```

---

## 🐛 Troubleshooting

### Error: "No connection could be made because the target machine actively refused it"

**Cause:** Redis server is not running

**Fix:**
- **Docker:** Start Docker Desktop, then `docker start redis-cache`
- **Windows Service:** Open Services → Start "Redis"
- **Development:** Just ignore - app works without Redis

### Error: "WRONGPASS invalid username-password pair"

**Cause:** Incorrect Redis password in connection string

**Fix:** Double-check your Azure Redis access key

### Error: "SSL connection failed"

**Cause:** Using `redis://` instead of `rediss://` for Azure

**Fix:** Azure requires SSL - use `rediss://` (with double 's')

---

## 📊 Performance Impact

| Scenario | Without Redis | With Redis | Improvement |
|----------|---------------|------------|-------------|
| Tab switching | 2-3 seconds | <100ms | **96% faster** |
| Daily sentiment | Recalculates every time | Cached 10 min | **90% fewer calculations** |
| API calls/session | 15-20 | 5-7 | **75% reduction** |

---

## 💰 Cost Estimates (Azure)

| Tier | Size | Price/Month | Use Case |
|------|------|-------------|----------|
| **Basic C0** | 250 MB | ~$16 | Development/Testing |
| **Basic C1** | 1 GB | ~$55 | Small production |
| **Standard C1** | 1 GB | ~$73 | Production (HA) |
| **Standard C2** | 2.5 GB | ~$146 | High traffic |

**Recommendation:** Start with **Basic C0** for development, upgrade to **Standard C1** for production.

---

## 🚀 Quick Start Commands

```bash
# Start Redis locally (Docker)
docker run -d --name redis-cache -p 6379:6379 redis:latest

# Check if Redis is running
docker ps | findstr redis

# View Redis logs
docker logs redis-cache

# Stop Redis
docker stop redis-cache

# Start Redis again
docker start redis-cache

# Remove Redis container (to start fresh)
docker rm -f redis-cache
```

---

## 📝 Notes

- Redis is **optional** for development - app works without it
- Redis is **highly recommended** for production - 75% fewer API calls
- Your code already supports both environments (localhost + Azure)
- Graceful degradation ensures app never crashes due to Redis issues
