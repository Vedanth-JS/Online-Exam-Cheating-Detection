@echo off
title ExamGuard - Full Stack Startup
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║      ExamGuard - Starting Services       ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Change to project root
cd /d "%~dp0"

:: ── 1. Docker services (FastAPI, Postgres, Redis, Nginx, Celery) ─────────────
echo [1/3] Starting Docker services...
docker-compose up -d --no-build >nul 2>&1
if errorlevel 1 (
  echo      Building images first (first run)...
  docker-compose up -d >nul 2>&1
)
echo      Docker services started.

:: ── 2. Node.js backend (port 3000) ───────────────────────────────────────────
echo [2/3] Starting Node.js backend on port 3000...
:: Kill any existing node process on 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
start "" /B /MIN cmd /c "cd /d "%~dp0backend" && node server.js > server.log 2> server-err.log"
timeout /t 3 /nobreak >nul
echo      Node.js backend started.

:: ── 3. React frontend (port 5173) ────────────────────────────────────────────
echo [3/3] Starting React frontend on port 5173...
:: Kill any existing vite process on 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
start "" /MIN cmd /c "cd /d "%~dp0frontend" && npm run dev > vite.log 2>&1"
timeout /t 5 /nobreak >nul
echo      React frontend started.

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║            All Services Ready!           ║
echo  ╠══════════════════════════════════════════╣
echo  ║  React Frontend  →  http://localhost:5173 ║
echo  ║  Node.js API     →  http://localhost:3000 ║
echo  ║  FastAPI (AI)    →  http://localhost:8000 ║
echo  ║  API Docs        →  http://localhost:8000/docs
echo  ╚══════════════════════════════════════════╝
echo.

:: Open browser
start http://localhost:5173

pause
