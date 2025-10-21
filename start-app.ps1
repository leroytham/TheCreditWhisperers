# TheCreditWhisperers - Windows Startup Script

Write-Host "🚀 Starting TheCreditWhisperers Application..." -ForegroundColor Green

# Note: Redis/Docker not required for basic functionality but recommended for caching
Write-Host "📡 Note: Redis is optional for caching. App will work without it." -ForegroundColor Yellow

# Start backend in a new terminal
Write-Host "🔧 Starting Backend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# Wait a bit for backend to start
Start-Sleep -Seconds 5

# Start frontend in a new terminal
Write-Host "🎨 Starting Frontend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm start"

Write-Host "🎉 Application is starting up!" -ForegroundColor Green
Write-Host "Backend will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API Documentation: http://localhost:8000/docs" -ForegroundColor Cyan

# Wait for user input
Write-Host "`nPress any key to open the application in your browser..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Open browser
Start-Process "http://localhost:3000"