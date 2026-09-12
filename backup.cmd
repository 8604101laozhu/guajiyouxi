@echo off
REM Keep window open. Backup local project to GitHub.
if /I not "%BACKUP_KEEP%"=="1" (
  set BACKUP_KEEP=1
  cmd /k "%~f0" %*
  exit /b
)

cd /d "%~dp0"
echo ========================================
echo  Local backup -^> GitHub
echo  %CD%
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo FAIL: git not found. Install Git for Windows first.
  goto END
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo FAIL: this folder is not a git repo.
  goto END
)

echo --- current remote ---
git remote -v
echo.
echo --- changes ---
git status -sb
echo.

set MSG=%*
if "%MSG%"=="" set MSG=Backup local project changes.

git add -A
git status --short
echo.

git diff --cached --quiet
if not errorlevel 1 (
  echo Nothing new to commit. Working tree clean.
  goto END
)

git commit -m "%MSG%"
if errorlevel 1 (
  echo FAIL: commit failed. Check git user.name / user.email
  goto END
)

git push -u origin HEAD
if errorlevel 1 (
  echo FAIL: push failed. Check login / remote URL.
  goto END
)

echo.
echo OK. Backup uploaded.
echo Tell agent: 备份好了

:END
echo.
echo Window stays open. Close it manually when done.
echo.
