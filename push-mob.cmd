@echo off
cd /d "%~dp0"
setlocal EnableExtensions

mkdir drop\mob\minion\walking 2>nul
mkdir drop\mob\minion\attack 2>nul
mkdir drop\mob\minion\death 2>nul
mkdir drop\mob\champion\walking 2>nul
mkdir drop\mob\champion\attack 2>nul
mkdir drop\mob\champion\death 2>nul
mkdir drop\mob\boss\walking 2>nul
mkdir drop\mob\boss\attack 2>nul
mkdir drop\mob\boss\death 2>nul

set KIND=%~1
if "%KIND%"=="" set KIND=minion
set ANIM=%~2
if "%ANIM%"=="" set ANIM=walking

if /I "%KIND%"=="xiaoguai" set KIND=minion
if /I "%KIND%"=="jingying" set KIND=champion
if /I "%KIND%"=="shouling" set KIND=boss

set SRC=drop\mob\%KIND%\%ANIM%
set DST=public\sprites\inbox\monsters\%KIND%\%ANIM%

dir /b "%SRC%\*.png" "%SRC%\*.webp" "%SRC%\*.jpg" >nul 2>nul
if errorlevel 1 (
  echo FAIL: no images in %SRC%
  echo Put 0.png 1.png ... into that folder, then run this again.
  explorer "%CD%\%SRC%"
  pause
  exit /b 1
)

if not exist "%DST%" mkdir "%DST%"
xcopy /Y /Q "%SRC%\*.png" "%DST%\" >nul 2>nul
xcopy /Y /Q "%SRC%\*.webp" "%DST%\" >nul 2>nul
xcopy /Y /Q "%SRC%\*.jpg" "%DST%\" >nul 2>nul

git add -- "public/sprites/inbox/monsters/%KIND%/%ANIM%"
git diff --cached --quiet -- "public/sprites/inbox/monsters/%KIND%/%ANIM%"
if not errorlevel 1 (
  echo FAIL: no new monster frames to commit.
  echo Same files already on GitHub, or copy failed.
  pause
  exit /b 1
)

git commit -m "Add %KIND% %ANIM% monster frames from drop/mob."
if errorlevel 1 (
  echo FAIL: git commit failed. Check git user.name / user.email.
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo FAIL: git push failed.
  pause
  exit /b 1
)

echo OK. Tell agent: 图放好了
pause
exit /b 0
