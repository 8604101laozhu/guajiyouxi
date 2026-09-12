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

Write-Host ""
Write-Host "OK. Created:"
Write-Host "  $root\open-bg.cmd"
Write-Host "  $root\push-bg.cmd"
Write-Host "  $root\drop.cmd"
Write-Host "  $root\投放.cmd  (ASCII replacement)"
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Put loop.png into drop\bg\1\"
Write-Host "  2. Double-click push-bg.cmd"
Write-Host "  3. Tell agent: 图放好了"
Write-Host ""
explorer "$root\drop\bg\1"
