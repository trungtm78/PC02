@echo off
REM ============================================================
REM Build Flutter APK for production server
REM Usage: build_mobile_prod.bat <SERVER_IP_OR_DOMAIN>
REM Example: build_mobile_prod.bat 192.168.1.100
REM          build_mobile_prod.bat myserver.example.com
REM ============================================================

set SERVER=%1
if "%SERVER%"=="" (
    echo ERROR: Server IP or domain required.
    echo Usage: build_mobile_prod.bat ^<SERVER_IP_OR_DOMAIN^>
    exit /b 1
)

set API_URL=http://%SERVER%/api/v1
echo Building production APK...
echo API_BASE_URL=%API_URL%
echo.

cd /d C:\PC02\pc02-case-management\mobile

flutter build apk --release --dart-define=API_BASE_URL=%API_URL%

echo.
echo APK built at: mobile\build\app\outputs\flutter-apk\app-release.apk
