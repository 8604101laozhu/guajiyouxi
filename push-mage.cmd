@echo off
REM Update female mage (hero) frames from studio pack.
REM Window stays open. Errors also go to mage-push-log.txt
cd /d "%~dp0"
setlocal EnableExtensions

set LOG=%CD%\mage-push-log.txt
echo ==== %DATE% %TIME% ==== > "%LOG%"

set CHAR=%~1
if "%CHAR%"=="" set CHAR=法师1新

set SRC=D:\ai炼丹\香草社\人物生成图\%CHAR%
set DST=public\sprites\inbox\base_animations

echo Character: %CHAR%
echo Source:    %SRC%
echo Dest:      %CD%\%DST%
echo.

if not exist "%SRC%" (
  echo FAIL: source folder missing: %SRC%
  echo FAIL: source folder missing: %SRC% >> "%LOG%"
  echo Edit SRC path or pass the folder name: push-mage.cmd 你的角色名
  echo.
  echo Log: %LOG%
  pause
  exit /b 1
)

if not exist "%SRC%\走路" (
  echo FAIL: missing %SRC%\走路
  echo FAIL: missing walking folder >> "%LOG%"
  dir /b "%SRC%" >> "%LOG%"
  dir /b "%SRC%"
  echo.
  echo Log: %LOG%
  pause
  exit /b 1
)

mkdir "%DST%\walking" 2>nul
mkdir "%DST%\attack" 2>nul
mkdir "%DST%\death" 2>nul
mkdir "%DST%\idle" 2>nul

echo Copying frames...
xcopy /Y /Q "%SRC%\走路\*.png" "%DST%\walking\" >> "%LOG%" 2>&1
if exist "%SRC%\攻击" xcopy /Y /Q "%SRC%\攻击\*.png" "%DST%\attack\" >> "%LOG%" 2>&1
if exist "%SRC%\死亡" xcopy /Y /Q "%SRC%\死亡\*.png" "%DST%\death\" >> "%LOG%" 2>&1
if exist "%SRC%\待机" xcopy /Y /Q "%SRC%\待机\*.png" "%DST%\idle\" >> "%LOG%" 2>&1

echo.
echo Files now in walking:
dir /b "%DST%\walking\*.png" 2>nul
dir /b "%DST%\walking\*.png" >> "%LOG%" 2>&1
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo FAIL: git not found in PATH
  echo FAIL: git not found >> "%LOG%"
  echo Log: %LOG%
  pause
  exit /b 1
)

git add -- "public/sprites/inbox/base_animations"
echo --- git status ---
git status --porcelain -- "public/sprites/inbox/base_animations"
git status --porcelain -- "public/sprites/inbox/base_animations" >> "%LOG%"

git diff --cached --quiet -- "public/sprites/inbox/base_animations"
if not errorlevel 1 (
  echo FAIL: nothing new to commit. Copy may have failed, or files identical.
  echo FAIL: nothing staged >> "%LOG%"
  echo Check: %SRC%\走路 has png files
  echo Log: %LOG%
  pause
  exit /b 1
)

git commit -m "Update female mage base animations from %CHAR%."
if errorlevel 1 (
  echo FAIL: git commit failed
  echo FAIL: git commit failed >> "%LOG%"
  git config user.name >> "%LOG%" 2>&1
  git config user.email >> "%LOG%" 2>&1
  echo Log: %LOG%
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo FAIL: git push failed  ^(red text above^)
  echo FAIL: git push failed >> "%LOG%"
  echo Log: %LOG%
  pause
  exit /b 1
)

echo.
echo OK. Tell agent: 图放好了
echo OK >> "%LOG%"
echo Log: %LOG%
pause
exit /b 0
