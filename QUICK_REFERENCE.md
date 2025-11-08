# Quick Reference - Localhost vs Azure Configuration

## 🏠 Localhost Configuration

### Backend (.env)
```bash
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:8000
AZURE_REDIRECT_URI=                    # Auto-generates to http://localhost:8000/auth/callback

APPLICATION_ID=<your-azure-app-id>
DIRECTORY_ID=<your-azure-tenant-id>
CLIENT_SECRET=<your-azure-client-secret>
MONGO_URI=<your-mongodb-uri>
```

### Frontend (.env.development) - Already configured ✓
```bash
REACT_APP_API_URL=/api
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

### Azure AD Redirect URI
```
http://localhost:8000/auth/callback
```

### Start Commands
```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm start
```

### Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## ☁️ Azure Production Configuration

### Backend (Azure Portal > Configuration)
```bash
FRONTEND_URL=https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net
API_BASE_URL=https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net
AZURE_REDIRECT_URI=                    # Auto-generates

APPLICATION_ID=<your-azure-app-id>
DIRECTORY_ID=<your-azure-tenant-id>
CLIENT_SECRET=<your-azure-client-secret>
MONGO_URI=<your-production-mongodb-uri>
REDIS_URL=<your-production-redis-uri>
```

### Frontend (.env.production) - Already configured ✓
```bash
REACT_APP_API_URL=/api
REACT_APP_WS_URL=wss://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net
```

### Azure AD Redirect URI
```
https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net/auth/callback
```

### Deploy
```bash
git push origin dev
# Auto-deploys via GitHub Actions
```

### Access
- Production: https://credit-gtfhduenc9h4a4bp.japanwest-01.azurewebsites.net

---

## 🔑 Files Modified

✅ Backend:
- `backend/app/core/config.py` - Environment-aware settings
- `backend/app/api/routes.py` - Dynamic OAuth redirects
- `backend/app/main.py` - Auto-detecting CORS
- `backend/.env.example` - Documentation

✅ Frontend:
- `frontend/.env.example` - Documentation
- `frontend/.env.development` - Localhost config (new)
- `frontend/.env.production` - Azure config (new)

✅ Deployment:
- `.github/workflows/dev_credit.yml` - Updated docs

---

## 🎯 Key Features

✨ **Auto-Detection**: Code automatically adapts to environment
✨ **No Code Changes**: Same codebase for local and production
✨ **Auto-Generated URIs**: OAuth redirect URIs generate automatically
✨ **CORS Auto-Config**: Supports both localhost and production origins
✨ **Environment Files**: Separate configs for dev and prod

---

## 🚨 Common Issues

| Problem | Solution |
|---------|----------|
| Login redirects to wrong URL | Check `FRONTEND_URL` in backend config |
| CORS error | Verify `API_BASE_URL` and `FRONTEND_URL` match |
| Redirect URI mismatch | Add URI to Azure AD app registration |
| Azure login fails | Check `APPLICATION_ID`, `DIRECTORY_ID`, `CLIENT_SECRET` |

---

## 📞 Help

- **Full Guide**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Backend Config**: See [backend/.env.example](backend/.env.example)
- **Frontend Config**: See [frontend/.env.example](frontend/.env.example)
