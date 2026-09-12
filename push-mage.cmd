@echo off
REM ASCII-only. Do NOT put Chinese paths inside this file (cmd.exe GBK breaks them).
REM Usage:
REM   1) Drag the character folder onto this file
REM   2) Or: push-mage.cmd
REM      then it reads one line from mage-src.txt
cd /d "%~dp0"
setlocal EnableExtensions

set LOG=%CD%\mage-push-log.txt
echo ==== %DATE% %TIME% ==== > "%LOG%"

set SRC=%~1
if "%SRC%"=="" (
  if exist "mage-src.txt" (
    set /p SRC=<mage-src.txt
  )
)

if "%SRC%"=="" (
  echo FAIL: no source folder.
  echo.
  echo Fix A: drag folder onto push-mage.cmd
  echo   example folder:  ...\人物生成图\法师1新
  echo.
  echo Fix B: create mage-src.txt in this project root,
  echo   one line = full path of the character folder.
  echo.
  echo FAIL: no SRC >> "%LOG%"
  pause
  exit /b 1
)

REM strip quotes if any
set SRC=%SRC:"=%

echo Source: %SRC%
echo Source: %SRC% >> "%LOG%"

if not exist "%SRC%" (
  echo FAIL: folder not found:
  echo   %SRC%
  echo FAIL: missing folder >> "%LOG%"
  pause
  exit /b 1
)

set WALK=
set ATK=
set DIE=
set IDLE=
if exist "%SRC%\walking" set WALK=%SRC%\walking
if exist "%SRC%\走路" set WALK=%SRC%\走路
if exist "%SRC%\attack" set ATK=%SRC%\attack
if exist "%SRC%\攻击" set ATK=%SRC%\攻击
if exist "%SRC%\death" set DIE=%SRC%\death
if exist "%SRC%\死亡" set DIE=%SRC%\死亡
if exist "%SRC%\idle" set IDLE=%SRC%\idle
if exist "%SRC%\待机" set IDLE=%SRC%\待机

if "%WALK%"=="" (
  echo FAIL: no walking / 走路 folder under source.
  echo Subfolders:
  dir /b "%SRC%"
  dir /b "%SRC%" >> "%LOG%"
  pause
  exit /b 1
)

set DST=public\sprites\inbox\base_animations
mkdir "%DST%\walking" 2>nul
mkdir "%DST%\attack" 2>nul
mkdir "%DST%\death" 2>nul
mkdir "%DST%\idle" 2>nul

echo Copy walking from:
echo   %WALK%
xcopy /Y /Q "%WALK%\*.png" "%DST%\walking\" >> "%LOG%" 2>&1
if not "%ATK%"=="" xcopy /Y /Q "%ATK%\*.png" "%DST%\attack\" >> "%LOG%" 2>&1
if not "%DIE%"=="" xcopy /Y /Q "%DIE%\*.png" "%DST%\death\" >> "%LOG%" 2>&1
if not "%IDLE%"=="" xcopy /Y /Q "%IDLE%\*.png" "%DST%\idle\" >> "%LOG%" 2>&1

echo.
echo walking files:
dir /b "%DST%\walking\*.png"
dir /b "%DST%\walking\*.png" >> "%LOG%" 2>&1
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo FAIL: git not in PATH
  echo FAIL: no git >> "%LOG%"
  pause
  exit /b 1
)

git add -- "public/sprites/inbox/base_animations"
echo --- git status ---
git status --porcelain -- "public/sprites/inbox/base_animations"
git status --porcelain -- "public/sprites/inbox/base_animations" >> "%LOG%"

git diff --cached --quiet -- "public/sprites/inbox/base_animations"
if not errorlevel 1 (
  echo FAIL: nothing new to commit
  echo FAIL: nothing staged >> "%LOG%"
  pause
  exit /b 1
)

git commit -m "Update female mage base animations from studio pack."
if errorlevel 1 (
  echo FAIL: git commit
  echo FAIL: commit >> "%LOG%"
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo FAIL: git push
  echo FAIL: push >> "%LOG%"
  pause
  exit /b 1
)

echo.
echo OK. Tell agent: tu fang hao le
echo OK >> "%LOG%"
pause
exit /b 0
