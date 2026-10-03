@echo off
cd /d "%~dp0"
title guajiyouxi - desktop bar

netstat -ano | findstr ":45231" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [1/2] starting Next dev server on 45231 ...
  start "guajiyouxi-dev" cmd /k "cd /d %CD% && node_modules\.bin\next.cmd dev --port 45231 --hostname 127.0.0.1"
  echo       waiting 12s for the server to boot ...
  timeout /t 12 /nobreak >nul
) else (
  echo [1/2] Next dev already running on 45231
)

echo [2/2] opening the desktop bar window ...
echo       Ctrl+Alt+Q = quit   Ctrl+Alt+D = click-through   Ctrl+Alt+T = always on top
call npm run desk

echo.
echo window closed. the dev server keeps running in its own window - close that one too when done.
pause
