@echo off
echo 🌟 Starting ConnectGlobal Development Environment...
echo.

echo 🔍 Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker not found. Please install Docker Desktop first.
    echo Download: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo ✅ Docker found

echo.
echo 🚀 Starting open source services...
docker-compose up -d

echo.
echo ⏳ Waiting for services to initialize...
timeout /t 30 /nobreak >nul

echo.
echo 🎉 Services ready! Opening Supabase Studio...
start http://localhost:3001

echo.
echo 📋 Development URLs:
echo Supabase Studio: http://localhost:3001
echo MinIO Console:   http://localhost:9001
echo Grafana:         http://localhost:3002
echo PostgREST API:   http://localhost:8000
echo Jitsi Meet:      http://localhost:8080
echo.

echo 🛠️ To start backend API: npm run backend:dev
echo 📱 To start React Native: npm start
echo.
pause