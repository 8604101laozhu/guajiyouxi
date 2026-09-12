@echo off
REM One-shot: push chapter-1 bg and/or any monster frames found under drop\mob
cd /d "%~dp0"
setlocal EnableExtensions
set DID=0

if exist "drop\bg\1\loop.png" (
  if not exist "public\sprites\inbox\backgrounds\chapter-1" mkdir "public\sprites\inbox\backgrounds\chapter-1"
  copy /Y "drop\bg\1\loop.png" "public\sprites\inbox\backgrounds\chapter-1\loop.png" >nul
  git add -- "public/sprites/inbox/backgrounds/chapter-1/loop.png"
  echo staged bg if changed
)

for %%K in (minion champion boss) do (
  for %%A in (walking attack death) do (
    if exist "drop\mob\%%K\%%A\*.png" (
      if not exist "public\sprites\inbox\monsters\%%K\%%A" mkdir "public\sprites\inbox\monsters\%%K\%%A"
      xcopy /Y /Q "drop\mob\%%K\%%A\*.png" "public\sprites\inbox\monsters\%%K\%%A\" >nul 2>nul
      git add -- "public/sprites/inbox/monsters/%%K/%%A"
      echo staged mob %%K %%A
    )
  )
)

git diff --cached --quiet -- "public/sprites/inbox"
if not errorlevel 1 (
  echo FAIL: nothing new under public\sprites\inbox
  echo.
  echo Background: put loop.png in drop\bg\1\
  echo Monsters:   put 0.png in drop\mob\minion\walking\
  echo.
  echo Your last run only had tool file changes, not images.
  pause
  exit /b 1
)

git status --porcelain -- "public/sprites/inbox"
git commit -m "Add sprite frames from local drop folders."
if errorlevel 1 (
  echo FAIL: git commit failed.
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
