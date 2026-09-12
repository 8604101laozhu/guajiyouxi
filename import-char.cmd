@echo off
REM Import studio character pack: 待机/走路/攻击/死亡 -> public/sprites/inbox
REM Double-click, or drag a character folder onto this file, or:
REM   import-char.cmd 法师1新
REM   import-char.cmd 史莱姆王 --as=boss
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo FAIL: Node.js not found. Install Node LTS first.
  pause
  exit /b 1
)

if "%~1"=="" (
  node scripts\import-char.mjs
) else (
  node scripts\import-char.mjs %*
)

if errorlevel 1 (
  echo.
  echo FAIL. Check the path above.
  pause
  exit /b 1
)

echo.
pause
exit /b 0
