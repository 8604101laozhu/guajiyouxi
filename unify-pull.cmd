@echo off
REM After Agent pushes to GitHub: pull everything onto this PC.
if /I not "%UNIFY_KEEP%"=="1" (
  set UNIFY_KEEP=1
  cmd /k "%~f0" %*
  exit /b
)

cd /d "%~dp0"
echo Project: %CD%
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo FAIL: git not found
  goto END
)

git remote -v
echo.

git fetch origin
if errorlevel 1 (
  echo FAIL: git fetch
  goto END
)

git status -sb
echo.
git pull origin main
if errorlevel 1 (
  echo FAIL: git pull
  echo If conflicts, tell the agent.
  goto END
)

echo.
echo Checking character folders:
if exist "public\sprites\inbox\characters\nv-fashi\walking" (
  echo OK: characters\nv-fashi\walking
) else (
  echo MISSING: characters\nv-fashi — tell agent pull did not get new commits
)

echo.
echo Unified. Put 女法师 frames into:
echo   public\sprites\inbox\characters\nv-fashi\walking\
echo then backup with: git add -A ^& git commit -m "update" ^& git push

:END
echo.
echo Window stays open.
echo.
