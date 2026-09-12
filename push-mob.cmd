@echo off
cd /d "%~dp0"
setlocal EnableExtensions
set COPIED=0

call :push_kind minion
call :push_kind champion
call :push_kind boss

if "%COPIED%"=="0" (
  echo No frames found. Example: drop\mob\minion\walking\0.png
  echo Kinds: minion, champion, boss. Anims: walking, attack, death
  pause
  exit /b 1
)

git add -- "public/sprites/inbox/monsters"
git status --porcelain -- "public/sprites/inbox/monsters"
git commit -m "Update monster sprite frames from drop/mob."
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
exit /b 0

:push_kind
set KIND=%~1
for %%A in (walking attack death) do (
  if exist "drop\mob\%KIND%\%%A\*.png" (
    if not exist "public\sprites\inbox\monsters\%KIND%\%%A" mkdir "public\sprites\inbox\monsters\%KIND%\%%A"
    copy /Y "drop\mob\%KIND%\%%A\*.png" "public\sprites\inbox\monsters\%KIND%\%%A\" >nul
    echo copied drop\mob\%KIND%\%%A
    set COPIED=1
  )
  if exist "drop\mob\%KIND%\%%A\*.webp" (
    if not exist "public\sprites\inbox\monsters\%KIND%\%%A" mkdir "public\sprites\inbox\monsters\%KIND%\%%A"
    copy /Y "drop\mob\%KIND%\%%A\*.webp" "public\sprites\inbox\monsters\%KIND%\%%A\" >nul
    echo copied drop\mob\%KIND%\%%A webp
    set COPIED=1
  )
)
exit /b 0
