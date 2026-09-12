@echo off
REM Import ONE studio character pack into public/sprites/inbox.
REM There is no default character. Pass a name, or drag that character folder here.
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
  echo No character name given.
  echo Example: import-char.cmd 法师1新
  echo Or drag a character folder onto this file.
  echo.
  node scripts\import-char.mjs
  pause
  exit /b 1
)

node scripts\import-char.mjs %*
if errorlevel 1 (
  echo.
  echo FAIL. Check the path above.
  pause
  exit /b 1
)

echo.
pause
exit /b 0
