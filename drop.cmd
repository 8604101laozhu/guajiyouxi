@echo off
REM ASCII-only. Do NOT use the old Chinese 投放.cmd (GBK breaks it).
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node LTS first.
  pause
  exit /b 1
)

if not exist drop\bg\1 mkdir drop\bg\1

echo Preparing drop folders...
node scripts\prepare-drop.mjs
if errorlevel 1 (
  echo FAILED: scripts\prepare-drop.mjs missing.
  echo Copy the new scripts from drop-tools.zip into this project first.
  pause
  exit /b 1
)

echo.
echo Drop root: %CD%\drop
echo Put background here: %CD%\drop\bg\1\loop.png
echo Keep this window open.
echo.

call npm run drop:watch -- --push
pause
