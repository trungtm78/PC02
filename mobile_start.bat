@echo off
title PC02 Mobile Launcher
setlocal EnableDelayedExpansion

echo.
echo ================================================
echo  PC02 Mobile App Launcher
echo  Backend  : http://localhost:3000
echo  Emulator : Medium_Phone_API_36.1
echo ================================================
echo.

set "ANDROID_SDK=%LOCALAPPDATA%\Android\Sdk"
set "ADB=%ANDROID_SDK%\platform-tools\adb.exe"
set "EMULATOR_EXE=%ANDROID_SDK%\emulator\emulator.exe"
set "ROOT=%~dp0"

:: 1. Kill old backend on port 3000
echo [1/4] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

:: 2. Start emulator FIRST (takes longest)
echo [2/4] Checking emulator...
"%ADB%" devices 2>nul | findstr "emulator-5554" >nul
if %errorlevel% equ 0 (
    echo      Emulator already running.
) else (
    echo      Starting emulator Medium_Phone_API_36.1...
    start "" "%EMULATOR_EXE%" -avd Medium_Phone_API_36.1 -no-snapshot-save
    echo      Waiting for emulator to boot (45s)...
    timeout /t 45 /nobreak >nul
    :wait_boot
    "%ADB%" shell getprop sys.boot_completed 2>nul | findstr "1" >nul
    if errorlevel 1 (
        echo      Still booting, please wait...
        timeout /t 5 /nobreak >nul
        goto wait_boot
    )
    echo      Emulator ready!
    timeout /t 3 /nobreak >nul
)

:: 3. Start backend in new window
echo [3/4] Starting backend...
start "PC02 Backend" cmd /k "cd /d "%ROOT%backend" && set NODE_ENV=development && npm run start:dev"
echo      Waiting 12s for backend to start...
timeout /t 12 /nobreak >nul

:: 4. Run Flutter on emulator
echo [4/4] Launching Flutter app...
echo.
echo ================================================
echo  Flutter controls (in Flutter window):
echo    r = hot reload
echo    R = hot restart
echo    q = quit
echo ================================================
echo.
start "PC02 Flutter" cmd /k "cd /d "%ROOT%mobile" && flutter run -d emulator-5554"

echo.
echo  All done! Check the Flutter and Backend windows.
echo.
pause