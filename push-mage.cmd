@echo off
REM ASCII launcher only. Window stays open (-NoExit).
REM Drag a character folder onto THIS file.
cd /d "%~dp0"

echo.
echo push-mage launcher
echo arg1=%~1
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo FAIL: powershell not found
  pause
  exit /b 1
)

if not exist "%~dp0push-mage.ps1" (
  echo FAIL: missing push-mage.ps1 in
  echo   %~dp0
  pause
  exit /b 1
)

REM -NoExit keeps the window open so errors are visible
powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0push-mage.ps1" %*
