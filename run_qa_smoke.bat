@echo off
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%
cd /d C:\PC02\pc02-case-management
if "%TEST_PASSWORD%"=="" (
  echo ERROR: set TEST_PASSWORD env var before running this script.
  exit /b 1
)
if "%TEST_USERNAME%"=="" set TEST_USERNAME=admin@pc02.local
"%USERPROFILE%\.maestro\v1\maestro\bin\maestro.bat" test --include-tags=smoke -e APP_ID=vn.gov.pc02.mobile -e TEST_USERNAME=%TEST_USERNAME% -e TEST_PASSWORD=%TEST_PASSWORD% maestro\flows\
