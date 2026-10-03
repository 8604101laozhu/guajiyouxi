@echo off
REM Mage shortcut for the sprite alpha gate. ASCII only before chcp.
if /I not "%ALPHA_KEEP%"=="1" (
  set ALPHA_KEEP=1
  cmd /k "%~f0" %*
  exit /b
)

cd /d "%~dp0"
chcp 65001 >nul
setlocal EnableExtensions

REM Mage shortcut for the sprite alpha gate. Checks mage-src.txt, else nv-fashi.

set SRC=%~1
if "%SRC%"=="" (
  if exist "mage-src.txt" set /p SRC=<mage-src.txt
)
if "%SRC%"=="" (
  if exist "public\sprites\inbox\characters\nv-fashi" set SRC=public\sprites\inbox\characters\nv-fashi
)
if "%SRC%"=="" (
  echo 找不到法师目录。把法师文件夹拖到 check-fashi-alpha.cmd 上，
  echo 或把路径写进 mage-src.txt（一行），再双击一次。
  echo.
  exit /b 2
)

set SRC=%SRC:"=%
echo 法师目录: %SRC%
echo.

REM check-alpha.cmd prints its own footer, so no duplicate footer here
call "%~dp0check-alpha.cmd" "%SRC%"

REM Propagate the gate verdict (call sets ERRORLEVEL to the callee's exit code).
exit /b %ERRORLEVEL%
