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
echo OK. Tell the agent: 图放好了
pause
