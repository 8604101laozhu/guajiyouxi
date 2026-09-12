@echo off
cd /d "%~dp0"

if not exist drop\mob\minion\walking mkdir drop\mob\minion\walking
if not exist drop\mob\minion\attack mkdir drop\mob\minion\attack
if not exist drop\mob\minion\death mkdir drop\mob\minion\death
if not exist drop\mob\champion\walking mkdir drop\mob\champion\walking
if not exist drop\mob\champion\attack mkdir drop\mob\champion\attack
if not exist drop\mob\champion\death mkdir drop\mob\champion\death
if not exist drop\mob\boss\walking mkdir drop\mob\boss\walking
if not exist drop\mob\boss\attack mkdir drop\mob\boss\attack
if not exist drop\mob\boss\death mkdir drop\mob\boss\death

set KIND=%~1
if "%KIND%"=="" set KIND=minion
set ANIM=%~2
if "%ANIM%"=="" set ANIM=walking

if /I "%KIND%"=="xiaoguai" set KIND=minion
if /I "%KIND%"=="jingying" set KIND=champion
if /I "%KIND%"=="shouling" set KIND=boss

set SRC=drop\mob\%KIND%\%ANIM%
set DST=public\sprites\inbox\monsters\%KIND%\%ANIM%

if not exist "%SRC%" (
  echo Missing folder: %SRC%
  explorer "drop\mob"
  pause
  exit /b 1
)

dir /b "%SRC%\*.png" "%SRC%\*.webp" "%SRC%\*.jpg" >nul 2>nul
if errorlevel 1 (
  echo No images in %SRC%
  echo Put 0.png 1.png ... into that folder
  explorer "%CD%\%SRC%"
  pause
  exit /b 1
)

if not exist "%DST%" mkdir "%DST%"
xcopy /Y /Q "%SRC%\*.png" "%DST%\" >nul 2>nul
xcopy /Y /Q "%SRC%\*.webp" "%DST%\" >nul 2>nul
xcopy /Y /Q "%SRC%\*.jpg" "%DST%\" >nul 2>nul

git add -- "public/sprites/inbox/monsters/%KIND%/%ANIM%"
git status --porcelain -- "public/sprites/inbox/monsters/%KIND%/%ANIM%"
git commit -m "Add %KIND% %ANIM% monster frames from drop/mob."
if errorlevel 1 (
  echo Nothing new to commit, or commit failed.
  pause
  exit /b 1
)
git push
if errorlevel 1 (
  echo git push failed.
  pause
  exit /b 1
)
echo OK. Tell agent: tu fang hao le
pause
