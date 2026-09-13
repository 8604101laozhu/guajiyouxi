@echo off
REM Create local player character folders only. No git push.
if /I not "%CHAR_KEEP%"=="1" (
  set CHAR_KEEP=1
  cmd /k "%~f0" %*
  exit /b
)

cd /d "%~dp0"
echo Project: %CD%
echo.

set ROOT=public\sprites\inbox\characters

REM 女法师
mkdir "%ROOT%\nv-fashi\walking" 2>nul
mkdir "%ROOT%\nv-fashi\attack" 2>nul
mkdir "%ROOT%\nv-fashi\death" 2>nul
mkdir "%ROOT%\nv-fashi\idle" 2>nul

echo. > "%ROOT%\nv-fashi\walking\PUT_FRAMES_HERE.txt"
echo. > "%ROOT%\nv-fashi\attack\PUT_FRAMES_HERE.txt"
echo. > "%ROOT%\nv-fashi\death\PUT_FRAMES_HERE.txt"
echo. > "%ROOT%\nv-fashi\idle\PUT_FRAMES_HERE.txt"

echo OK folders:
echo   %CD%\%ROOT%\nv-fashi\walking
echo   %CD%\%ROOT%\nv-fashi\attack
echo   %CD%\%ROOT%\nv-fashi\death
echo   %CD%\%ROOT%\nv-fashi\idle
echo.
echo 女法师 = nv-fashi
echo Put 0.png 1.png ... into those folders, then backup.cmd when ready.
echo.
explorer "%CD%\%ROOT%\nv-fashi"
echo Window stays open. Close manually when done.
echo.
