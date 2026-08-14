@echo off
chcp 65001 >nul 2>&1
title Claude Code Hook - Test

REM Chay theo thu muc hien tai
set "P=%CD%"
set "OK=0"
set "FAIL=0"
set "SZ="

echo.
echo ==========================================================
echo   KIEM TRA CAU HINH HOOK
echo   Project: %P%
echo ==========================================================
echo.

REM ---------- 1. FILE TON TAI ----------
call :chk "settings.json"    "%P%\.claude\settings.json"
call :chk "stop-guard.bat"   "%P%\.claude\hooks\stop-guard.bat"
call :chk "PROGRESS.md"      "%P%\PROGRESS.md"
call :chk "CLAUDE.md"        "%P%\CLAUDE.md"
echo.

REM ---------- 2. JSON HOP LE ----------
powershell -NoProfile -Command "Get-Content '%P%\.claude\settings.json' -Raw | ConvertFrom-Json | Out-Null" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] settings.json - JSON loi cu phap
  set /a FAIL+=1
) else (
  echo [ OK ] settings.json - JSON hop le
  set /a OK+=1
)

REM ---------- 3. CO HOOK STOP ----------
findstr /C:"\"Stop\"" "%P%\.claude\settings.json" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] settings.json - thieu hook "Stop"
  set /a FAIL+=1
) else (
  echo [ OK ] settings.json - co hook "Stop"
  set /a OK+=1
)

REM ---------- 4. PROGRESS.MD CO SENTINEL ----------
findstr /R /C:"^STATUS:" "%P%\PROGRESS.md" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] PROGRESS.md - thieu dong STATUS:
  set /a FAIL+=1
) else (
  echo [ OK ] PROGRESS.md - co dong STATUS:
  set /a OK+=1
)
echo.

REM ---------- 5. TEST LOGIC HOOK: PHAI CHAN ----------
echo --- Test 1: STATUS: IN_PROGRESS  -^>  hook phai CHAN ---
copy /y "%P%\PROGRESS.md" "%P%\PROGRESS.bak" >nul
powershell -NoProfile -Command "(Get-Content '%P%\PROGRESS.md') -replace '^STATUS:.*','STATUS: IN_PROGRESS' | Set-Content '%P%\PROGRESS.md'"
call "%P%\.claude\hooks\stop-guard.bat" > "%TEMP%\ccx1.txt" 2>&1
findstr /C:"block" "%TEMP%\ccx1.txt" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] hook KHONG chan - sai
  set /a FAIL+=1
) else (
  echo [ OK ] hook da chan dung
  set /a OK+=1
)

REM ---------- 6. TEST LOGIC HOOK: PHAI CHO QUA ----------
echo --- Test 2: STATUS: BLOCKED  -^>  hook phai CHO DUNG ---
powershell -NoProfile -Command "(Get-Content '%P%\PROGRESS.md') -replace '^STATUS:.*','STATUS: BLOCKED' | Set-Content '%P%\PROGRESS.md'"
call "%P%\.claude\hooks\stop-guard.bat" > "%TEMP%\ccx2.txt" 2>&1
for %%A in ("%TEMP%\ccx2.txt") do set "SZ=%%~zA"
if "%SZ%"=="0" (
  echo [ OK ] hook cho dung dung
  set /a OK+=1
) else (
  echo [FAIL] hook van chan - sai
  set /a FAIL+=1
)

REM ---------- KHOI PHUC ----------
move /y "%P%\PROGRESS.bak" "%P%\PROGRESS.md" >nul
del "%TEMP%\ccx1.txt" "%TEMP%\ccx2.txt" >nul 2>&1
echo.

REM ---------- 7. HOOK GLOBAL TRUNG ----------
if exist "%USERPROFILE%\.claude\settings.json" (
  findstr /C:"\"Stop\"" "%USERPROFILE%\.claude\settings.json" >nul 2>&1
  if not errorlevel 1 echo [ !  ] Co hook Stop o ~\.claude - se chay TRUNG, nen xoa
)

REM ---------- 8. PHIEN BAN ----------
for /f "delims=" %%V in ('claude --version 2^>nul') do set "VER=%%V"
if defined VER (echo [INFO] Claude Code: %VER%) else (echo [ !  ] Khong tim thay lenh claude trong PATH)

echo.
echo ==========================================================
echo   KET QUA:  %OK% dat  /  %FAIL% loi
echo ==========================================================
if "%FAIL%"=="0" (
  echo.
  echo Cau hinh chuan. Gio mo Claude Code va giao 1 task nho de
  echo xac nhan hook thuc su duoc goi trong VS Code extension.
) else (
  echo.
  echo Co loi o tren - chay lai setup-claude-autonomous.bat
)
echo.
pause
exit /b

:chk
if exist %2 (
  echo [ OK ] %~1
  set /a OK+=1
) else (
  echo [FAIL] %~1 - khong ton tai
  set /a FAIL+=1
)
exit /b
