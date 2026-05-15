@echo off
set ANDROID_HOME=C:\Users\Than Minh Trung\AppData\Local\Android\Sdk
set PATH=%ANDROID_HOME%\platform-tools;C:\Windows\System32;C:\Windows;C:\Program Files\Microsoft\jdk-11.0.12.7-hotspot\bin
cd /d C:\PC02\pc02-case-management
if "%TEST_PASSWORD%"=="" (
  echo ERROR: set TEST_PASSWORD env var before running this script.
  exit /b 1
)
if "%TEST_USERNAME%"=="" set TEST_USERNAME=admin@pc02.local
"%USERPROFILE%\.maestro\v1\maestro\bin\maestro.bat" test -e APP_ID=vn.gov.pc02.mobile -e TEST_USERNAME=%TEST_USERNAME% -e TEST_PASSWORD=%TEST_PASSWORD% maestro\flows\01_login_success.yaml
