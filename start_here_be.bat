@echo off
title PC02 Case Management - Backend Only

echo.
echo  ================================================
echo   PC02 Case Management - Backend Only
echo   Backend : http://localhost:3000
echo   Health  : http://localhost:3000/api/v1/health
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
echo [0/1] Cleaning up old backend on port 3000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Also close any existing PC02 backend window by title
taskkill /FI "WINDOWTITLE eq PC02 - Backend" /F >nul 2>&1

:: Brief pause to let port release
timeout /t 2 /nobreak >nul

:: Start Backend in a new window
echo [1/1] Starting Backend (NestJS)...
start "PC02 - Backend" cmd /k "cd /d "%~dp0backend" && echo Starting NestJS backend... && npm run start:dev"

echo.
echo  Backend is starting in a separate window.
echo  Backend : http://localhost:3000
echo  Health  : http://localhost:3000/api/v1/health
echo.
echo  Press any key to close this launcher window.
echo  (The Backend window will keep running)
echo.
pause
