@echo off
echo ====================================
echo Starting TheCreditWhisperers App
echo ====================================
echo.

REM Kill any existing Python and Node processes
echo Cleaning up any existing processes...
powershell -Command "Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
timeout /t 2 /nobreak >nul

REM Start Backend Server in new window
echo Starting Backend Server...
start "Backend Server" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

REM Wait for backend to start
echo Waiting for backend to initialize...
timeout /t 8 /nobreak >nul

REM Start Frontend Server in new window
echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d "%~dp0frontend" && npm start"

echo.
echo ====================================
echo Application is starting!
echo ====================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
