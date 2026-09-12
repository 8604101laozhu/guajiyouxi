# Run in PowerShell:
#   cd G:\guajiyouxi\guajiyouxi
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   paste this file content, or: iex (script)
# Creates ASCII drop tools without downloading any zip.

$ErrorActionPreference = "Stop"
$root = "G:\guajiyouxi\guajiyouxi"
if (-not (Test-Path $root)) { throw "Project not found: $root" }
Set-Location $root

New-Item -ItemType Directory -Force -Path "drop\bg\1" | Out-Null
New-Item -ItemType Directory -Force -Path "scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "public\sprites\inbox\backgrounds\chapter-1" | Out-Null
foreach ($kind in @("minion","champion","boss")) {
  foreach ($anim in @("walking","attack","death")) {
    New-Item -ItemType Directory -Force -Path "drop\mob\$kind\$anim" | Out-Null
    New-Item -ItemType Directory -Force -Path "public\sprites\inbox\monsters\$kind\$anim" | Out-Null
  }
}

@'
@echo off
cd /d "%~dp0"
if not exist drop\bg\1 mkdir drop\bg\1
explorer "%CD%\drop\bg\1"
echo Put loop.png into: %CD%\drop\bg\1\
echo Then run push-bg.cmd
pause
'@ | Set-Content -Encoding Ascii "open-bg.cmd"

@'
@echo off
cd /d "%~dp0"
if not exist "drop\bg\1\loop.png" (
  echo Missing drop\bg\1\loop.png
  pause
  exit /b 1
)
if not exist "public\sprites\inbox\backgrounds\chapter-1" mkdir "public\sprites\inbox\backgrounds\chapter-1"
copy /Y "drop\bg\1\loop.png" "public\sprites\inbox\backgrounds\chapter-1\loop.png" >nul
git add -- "public/sprites/inbox/backgrounds/chapter-1/loop.png"
git status --porcelain -- "public/sprites/inbox/backgrounds/chapter-1/loop.png"
git commit -m "Update chapter-1 side-scroll background loop.png."
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
echo OK. Tell the agent: tu fang hao le
pause
'@ | Set-Content -Encoding Ascii "push-bg.cmd"

@'
@echo off
cd /d "%~dp0"
if not exist drop\bg\1 mkdir drop\bg\1
explorer "%CD%\drop\bg\1"
echo.
echo 1. Put loop.png into drop\bg\1\
echo 2. Double-click push-bg.cmd
echo.
echo Do NOT use the old Chinese toufang.cmd
pause
'@ | Set-Content -Encoding Ascii "drop.cmd"

# Replace broken Chinese launcher with ASCII copy
Copy-Item -Force "drop.cmd" "投放.cmd"

@'
@echo off
cd /d "%~dp0"
mkdir drop\mob\minion\walking 2>nul
mkdir drop\mob\minion\attack 2>nul
mkdir drop\mob\minion\death 2>nul
mkdir drop\mob\champion\walking 2>nul
mkdir drop\mob\champion\attack 2>nul
mkdir drop\mob\champion\death 2>nul
mkdir drop\mob\boss\walking 2>nul
mkdir drop\mob\boss\attack 2>nul
mkdir drop\mob\boss\death 2>nul
explorer "%CD%\drop\mob\minion\walking"
echo Put 0.png 1.png into drop\mob\minion\walking
echo Then run push-mob.cmd
pause
'@ | Set-Content -Encoding Ascii "open-mob.cmd"
Copy-Item -Force "open-mob.cmd" "make-mob.cmd"

@'
@echo off
cd /d "%~dp0"
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
set SRC=drop\mob\%KIND%\%ANIM%
set DST=public\sprites\inbox\monsters\%KIND%\%ANIM%
dir /b "%SRC%\*.png" "%SRC%\*.webp" "%SRC%\*.jpg" >nul 2>nul
if errorlevel 1 (
  echo No images in %SRC%
  explorer "%CD%\%SRC%"
  pause
  exit /b 1
)
if not exist "%DST%" mkdir "%DST%"
xcopy /Y /Q "%SRC%\*.png" "%DST%\" >nul 2>nul
xcopy /Y /Q "%SRC%\*.webp" "%DST%\" >nul 2>nul
xcopy /Y /Q "%SRC%\*.jpg" "%DST%\" >nul 2>nul
git add -- "public/sprites/inbox/monsters/%KIND%/%ANIM%"
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
'@ | Set-Content -Encoding Ascii "push-mob.cmd"

Write-Host ""
Write-Host "OK. Created:"
Write-Host "  $root\open-bg.cmd"
Write-Host "  $root\push-bg.cmd"
Write-Host "  $root\open-mob.cmd / make-mob.cmd"
Write-Host "  $root\push-mob.cmd"
Write-Host "  $root\drop.cmd"
Write-Host "  $root\投放.cmd  (ASCII replacement)"
Write-Host ""
Write-Host "Background: drop\bg\1\loop.png then push-bg.cmd"
Write-Host "Monster:    drop\mob\minion\walking\0.png then push-mob.cmd"
Write-Host "Then tell agent: 图放好了"
Write-Host ""
explorer "$root\drop\mob\minion\walking"
