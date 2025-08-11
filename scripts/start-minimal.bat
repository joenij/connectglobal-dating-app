@echo off
echo Starting ConnectGlobal in Minimal Mode (0€ Budget)...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Docker is running (optional for Redis)
docker version >nul 2>&1
if errorlevel 1 (
    echo WARNING: Docker not found. Will use in-memory storage instead of Redis.
    echo For better performance, install Docker Desktop.
    echo.
    set USE_REDIS=false
) else (
    echo Docker found. Starting minimal services...
    docker-compose -f docker-compose.minimal.yml up -d redis
    set USE_REDIS=true
)

REM Set environment variables for minimal mode
set NODE_ENV=development
set DATABASE_TYPE=sqlite
set USE_SUPABASE=false
set ENABLE_PAYMENTS=false
set BETA_MODE=true

echo.
echo Starting backend server...
cd backend
start "Backend Server" cmd /k "npm run dev"

echo.
echo Waiting for backend to start...
timeout /t 5

echo.
echo Starting React Native Metro...
cd ..
start "Metro Bundler" cmd /k "npm start"

echo.
echo ================================
echo   ConnectGlobal Minimal Mode
echo ================================
echo Backend: http://localhost:3000
echo Metro: http://localhost:8081
echo.
echo Ready for TikTok beta testers!
echo.
pause