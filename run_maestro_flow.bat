@echo off
set PATH=M:\bin;%LOCALAPPDATA%\Android\Sdk\platform-tools;C:\Program Files\Microsoft\jdk-11.0.12.7-hotspot\bin;C:\Windows\System32;C:\Windows
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set JAVA_HOME=C:\Program Files\Microsoft\jdk-11.0.12.7-hotspot
set MAESTRO_HOME=M:
M:\bin\maestro.bat %*
