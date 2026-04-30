@echo off
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%
cd /d C:\PC02\pc02-case-management
"%USERPROFILE%\.maestro\v1\maestro\bin\maestro.bat" test --include-tags=smoke -e APP_ID=vn.gov.pc02.mobile -e TEST_USERNAME=admin@pc02.local -e TEST_PASSWORD=8buYJnZqMFUv3jWsdMaGvd5b maestro\flows\
