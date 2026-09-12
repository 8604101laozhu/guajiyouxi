@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node LTS first.
  pause
  exit /b 1
)

echo Preparing drop folders...
node scripts\prepare-drop.mjs
if errorlevel 1 (
  echo prepare-drop failed.
  pause
  exit /b 1
)

echo.
echo Drop folder: %CD%\drop
echo Chapter 1 background: drop\bg\1\loop.png
echo Keep this window open. Do not drag PNGs into Cursor chat.
echo.

call npm run drop:watch -- --push
pause
