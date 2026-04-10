@echo off
title PC02 Case Management - Launcher

echo.
echo  ================================================
echo   PC02 Case Management System
echo   Backend  : http://localhost:3000
echo   Frontend : http://localhost:5173
echo  ================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

:: Kill any process currently using port 3000 (Backend)
echo [0/2] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Kill any process currently using port 5173 (Frontend)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Also close any existing PC02 windows by title
taskkill /FI "WINDOWTITLE eq PC02 - Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq PC02 - Frontend" /F >nul 2>&1

:: Brief pause to let ports release
timeout /t 2 /nobreak >nul

:: Start Backend in a new window
echo [1/2] Starting Backend (NestJS)...
start "PC02 - Backend" cmd /k "cd /d "%~dp0backend" && echo Starting NestJS backend... && npm run start:dev"

:: Wait for backend to be ready before starting frontend
timeout /t 4 /nobreak >nul

:: Start Frontend in a new window
echo [2/2] Starting Frontend (Vite + React)...
start "PC02 - Frontend" cmd /k "cd /d "%~dp0frontend" && echo Starting Vite frontend... && npm run dev"

echo.
echo  Both servers are starting in separate windows.
echo  Backend  : http://localhost:3000
echo  Frontend : http://localhost:5173
echo  Health   : http://localhost:3000/api/v1/health
echo.
echo  Press any key to close this launcher window.
echo  (The Backend and Frontend windows will keep running)
echo.
pause
