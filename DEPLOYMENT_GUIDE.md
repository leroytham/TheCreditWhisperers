# Azure Deployment Guide - Login & Authentication

This guide explains how to deploy your application to Azure with Microsoft Azure AD authentication, while maintaining the ability to develop and test locally.

## Overview

Your codebase now supports **both localhost and Azure deployment** using environment variables. The same code runs in both environments - just configure the appropriate `.env` files.

---

## 🔧 Key Changes Made

### Backend Changes

1. **[backend/app/core/config.py](backend/app/core/config.py)**
   - Added `API_BASE_URL` setting for environment detection
   - Added `get_redirect_uri()` method to auto-generate OAuth redirect URI
   - Made `AZURE_REDIRECT_URI` optional (auto-generates if not set)

2. **[backend/app/api/routes.py](backend/app/api/routes.py)**
   - Updated Azure OAuth to use `settings.get_redirect_uri()`
   - Updated callback redirects to use `settings.FRONTEND_URL` (environment-aware)
   - Removed hardcoded `localhost:3000` URLs

3. **[backend/app/main.py](backend/app/main.py)**
   - Enhanced CORS to auto-detect localhost vs production URLs
   - Supports WebSocket connections for both environments

4. **[backend/.env.example](backend/.env.example)**
   - Added detailed documentation for both localhost and production configs
   - Added `FRONTEND_URL` and `API_BASE_URL` settings
   - Includes example configurations for both environments

### Frontend Changes

1. **[frontend/.env.example](frontend/.env.example)**
   - Comprehensive documentation for environment configuration
   - Explains how setupProxy.js works in development
   - Examples for localhost and Azure deployment

2. **[frontend/.env.development](frontend/.env.development)** *(new file)*
   - Localhost-specific configuration
   - Auto-loaded by `npm start`

3. **[frontend/.env.production](frontend/.env.production)** *(new file)*
   - Azure production configuration
   - Auto-loaded by `npm run build`

4. **[.github/workflows/dev_credit.yml](.github/workflows/dev_credit.yml)**
   - Updated documentation for Azure environment variables
   - Clarified which variables are required vs optional

---

## 🏠 Localhost Development Setup

### 1. Backend Configuration

Create or update `backend/.env`:

```bash
# Deployment URLs (Localhost)
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:8000
AZURE_REDIRECT_URI=                    # Leave blank to auto-generate

# Azure AD Credentials (required for login)
APPLICATION_ID=<your-azure-app-client-id>
DIRECTORY_ID=<your-azure-tenant-id>
CLIENT_SECRET=<your-azure-client-secret>
AZURE_AUTHORITY=https://login.microsoftonline.com/common

# Database
MONGO_URI=<your-mongodb-connection-string>
REDIS_URL=redis://localhost:6379/0    # Optional

# Other settings...
ENVIRONMENT=development
DEBUG=True
```

**Auto-generated OAuth redirect:** `http://localhost:8000/auth/callback`

### 2. Frontend Configuration

The file `frontend/.env.development` is already configured for localhost:

```bash
REACT_APP_API_URL=/api
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

### 3. Azure AD App Registration (Localhost)

In your Azure AD app registration, add this redirect URI:
- **Redirect URI:** `http://localhost:8000/auth/callback`

### 4. Run Locally

```bash
# Option 1: Use the start script (Windows)
python start.py

# Option 2: Manual start
# Terminal 1 - Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm start
```

**Access your app:** http://localhost:3000

---

## ☁️ Azure Production Deployment

### 1. Backend Configuration (Azure App Service)

Configure these environment variables in **Azure Portal > App Service > Configuration > Application settings**:

```bash
# Deployment URLs (Production)
FRONTEND_URL=https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net
API_BASE_URL=https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net
AZURE_REDIRECT_URI=                    # Leave blank to auto-generate

# Azure AD Credentials
APPLICATION_ID=<your-azure-app-client-id>
DIRECTORY_ID=<your-azure-tenant-id>
CLIENT_SECRET=<your-azure-client-secret>
AZURE_AUTHORITY=https://login.microsoftonline.com/common

# Database (Production)
MONGO_URI=<your-production-mongodb-connection-string>
REDIS_URL=<your-production-redis-connection-string>

# Optional API Keys
FINNHUB_API_TOKEN=<optional>
ALPHA_VANTAGE_API_KEY=<optional>
NEWS_API_KEY=<optional>
MARKETAUX_API_KEY=<optional>

# Server Settings
ENVIRONMENT=production
DEBUG=False
```

**Auto-generated OAuth redirect:** `https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net/auth/callback`

### 2. Frontend Configuration

The file `frontend/.env.production` is already configured:

```bash
REACT_APP_API_URL=/api
REACT_APP_WS_URL=wss://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net
```

### 3. Azure AD App Registration (Production)

In your Azure AD app registration, add this redirect URI:
- **Redirect URI:** `https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net/auth/callback`

### 4. Deploy to Azure

Deployment happens automatically via GitHub Actions when you push to the `dev` branch:

```bash
git add .
git commit -m "Configure Azure deployment"
git push origin dev
```

Or trigger manually in GitHub:
- Go to **Actions** tab
- Select "Deploy Fullstack (React + FastAPI) to Azure Web App"
- Click "Run workflow"

**Access your production app:** https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net

---

## 🔐 How Authentication Works

### Localhost Flow
1. User clicks "Sign in with Microsoft" on http://localhost:3000/login
2. Frontend redirects to `/api/login` (proxied to http://localhost:8000/login)
3. Backend redirects to Microsoft login page
4. User authenticates with Microsoft
5. Microsoft redirects to `http://localhost:8000/auth/callback`
6. Backend processes token and redirects to `http://localhost:3000/portfolio?user={username}`

### Production Flow
1. User clicks "Sign in with Microsoft" on production URL
2. Frontend sends request to `/api/login` (same domain)
3. Backend redirects to Microsoft login page
4. User authenticates with Microsoft
5. Microsoft redirects to production `/auth/callback`
6. Backend processes token and redirects to production `/portfolio?user={username}`

---

## 📝 Configuration Files Summary

| File | Purpose | Auto-loaded? |
|------|---------|--------------|
| `backend/.env` | Backend runtime config | Yes (by Pydantic) |
| `backend/.env.example` | Template with documentation | No (reference only) |
| `frontend/.env.development` | Localhost frontend config | Yes (by `npm start`) |
| `frontend/.env.production` | Production frontend config | Yes (by `npm run build`) |
| `frontend/.env.example` | Template with documentation | No (reference only) |

---

## ✅ Testing Checklist

### Local Testing
- [ ] Backend `.env` configured with localhost URLs
- [ ] Azure AD redirect URI includes `http://localhost:8000/auth/callback`
- [ ] Backend starts without errors: `python -m uvicorn app.main:app --reload --port 8000`
- [ ] Frontend starts without errors: `npm start`
- [ ] Login redirects to Microsoft
- [ ] After login, redirects back to `http://localhost:3000/portfolio`

### Production Testing
- [ ] Azure App Service environment variables configured
- [ ] Azure AD redirect URI includes production `/auth/callback`
- [ ] GitHub Actions deployment succeeds
- [ ] Production site loads: https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net
- [ ] Login works on production
- [ ] After login, stays on production domain

---

## 🐛 Troubleshooting

### "Azure AD authentication not configured" error
- **Cause:** Missing Azure AD credentials in `.env`
- **Fix:** Set `APPLICATION_ID`, `DIRECTORY_ID`, and `CLIENT_SECRET`

### Login redirects to localhost instead of production
- **Cause:** `FRONTEND_URL` not set in Azure App Service
- **Fix:** Configure `FRONTEND_URL` in Azure Portal > Configuration

### "Redirect URI mismatch" error from Microsoft
- **Cause:** Redirect URI not registered in Azure AD app
- **Fix:** Add the redirect URI to your Azure AD app registration:
  - Localhost: `http://localhost:8000/auth/callback`
  - Production: `https://your-app.azurewebsites.net/auth/callback`

### CORS errors in browser console
- **Cause:** `FRONTEND_URL` or `API_BASE_URL` not set correctly
- **Fix:** Verify these match your actual URLs in backend `.env` or Azure config

### "Cannot find module 'app.main'" error in Azure
- **Cause:** Startup command path is wrong
- **Fix:** Ensure startup command is: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 app.main:app`

---

## 🔄 Switching Between Environments

### To test locally:
```bash
cd frontend
npm start
# Uses .env.development automatically
```

### To build for production:
```bash
cd frontend
npm run build
# Uses .env.production automatically
# Deploy the build/ folder to Azure via GitHub Actions
```

**No code changes needed** - just different environment files!

---

## 📚 Additional Resources

- **Azure AD App Registration:** https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps
- **Azure App Service:** https://portal.azure.com/#blade/HubsExtension/BrowseResource/resourceType/Microsoft.Web%2Fsites
- **GitHub Actions Logs:** https://github.com/your-repo/actions

---

## 🎯 Next Steps

1. **Configure Azure AD App Registration** with both redirect URIs
2. **Set up Azure App Service environment variables** (see Production section)
3. **Test localhost login** to verify Azure AD integration works
4. **Push to `dev` branch** to trigger automatic deployment
5. **Test production login** once deployed

---

**You're all set!** Your code now seamlessly supports both localhost development and Azure cloud deployment with Microsoft authentication. 🚀
