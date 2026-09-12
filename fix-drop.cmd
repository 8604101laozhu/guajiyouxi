@echo off
REM Overwrite the broken Chinese launcher with the ASCII drop.cmd
cd /d "%~dp0"
if not exist drop.cmd (
  echo drop.cmd missing.
  pause
  exit /b 1
)
copy /Y drop.cmd "投放.cmd" >nul
echo Replaced 投放.cmd with ASCII drop.cmd
call drop.cmd
