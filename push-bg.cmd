@echo off
cd /d "%~dp0"
setlocal EnableExtensions

if not exist "drop\bg\1\loop.png" (
  echo FAIL: missing drop\bg\1\loop.png
  echo Put loop.png there first.
  if not exist "drop\bg\1" mkdir "drop\bg\1"
  explorer "%CD%\drop\bg\1"
  pause
  exit /b 1
)

if not exist "public\sprites\inbox\backgrounds\chapter-1" mkdir "public\sprites\inbox\backgrounds\chapter-1"
copy /Y "drop\bg\1\loop.png" "public\sprites\inbox\backgrounds\chapter-1\loop.png" >nul
if errorlevel 1 (
  echo FAIL: copy to inbox failed.
  pause
  exit /b 1
)

git add -- "public/sprites/inbox/backgrounds/chapter-1/loop.png"
git diff --cached --quiet -- "public/sprites/inbox/backgrounds/chapter-1/loop.png"
if not errorlevel 1 (
  echo FAIL: no new background to commit.
  echo GitHub already has the same loop.png, or the file did not change.
  echo If you meant monsters, use push-mob.cmd instead.
  pause
  exit /b 1
)

git commit -m "Update chapter-1 side-scroll background loop.png."
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
