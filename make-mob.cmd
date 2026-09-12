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

echo. > "drop\mob\minion\walking\PUT_FRAMES_HERE.txt"
echo. > "drop\mob\minion\attack\PUT_FRAMES_HERE.txt"
echo. > "drop\mob\minion\death\PUT_FRAMES_HERE.txt"
echo. > "drop\mob\champion\walking\PUT_FRAMES_HERE.txt"
echo. > "drop\mob\champion\attack\PUT_FRAMES_HERE.txt"
echo. > "drop\mob\champion\death\PUT_FRAMES_HERE.txt"
echo. > "drop\mob\boss\walking\PUT_FRAMES_HERE.txt"
echo. > "drop\mob\boss\attack\PUT_FRAMES_HERE.txt"
echo. > "drop\mob\boss\death\PUT_FRAMES_HERE.txt"

echo OK folders ready:
echo   %CD%\drop\mob\minion\walking
echo   %CD%\drop\mob\champion\walking
echo   %CD%\drop\mob\boss\walking
echo.
echo Put 0.png 1.png ... into minion\walking then run push-mob.cmd
explorer "%CD%\drop\mob\minion\walking"
pause
