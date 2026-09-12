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

echo minion walking frames here > "drop\mob\minion\walking\PUT_FRAMES_HERE.txt"
echo minion attack frames here > "drop\mob\minion\attack\PUT_FRAMES_HERE.txt"
echo minion death frames here > "drop\mob\minion\death\PUT_FRAMES_HERE.txt"
echo champion walking frames here > "drop\mob\champion\walking\PUT_FRAMES_HERE.txt"
echo champion attack frames here > "drop\mob\champion\attack\PUT_FRAMES_HERE.txt"
echo champion death frames here > "drop\mob\champion\death\PUT_FRAMES_HERE.txt"
echo boss walking frames here > "drop\mob\boss\walking\PUT_FRAMES_HERE.txt"
echo boss attack frames here > "drop\mob\boss\attack\PUT_FRAMES_HERE.txt"
echo boss death frames here > "drop\mob\boss\death\PUT_FRAMES_HERE.txt"

echo.
echo Monster folders ready:
echo   drop\mob\minion\walking   = small mob walk  (0.png 1.png ...)
echo   drop\mob\minion\attack
echo   drop\mob\minion\death
echo   drop\mob\champion\...     = elite
echo   drop\mob\boss\...         = boss
echo.
echo Face LEFT. Transparent PNG.
echo Then run: push-mob.cmd
explorer "%CD%\drop\mob\minion\walking"
pause
