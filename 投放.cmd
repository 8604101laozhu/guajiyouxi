@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist drop mkdir drop
if not exist "drop\背景" mkdir "drop\背景"
for /L %%i in (1,1,12) do (
  if not exist "drop\背景\%%i" mkdir "drop\背景\%%i"
)

echo 横板背景扔这里： > "drop\背景\放到这里.txt"
echo   drop\背景\1\loop.png >> "drop\背景\放到这里.txt"
echo 3840x720 PNG，左右无缝，地面约 78%%，香草社风，不要画人。 >> "drop\背景\放到这里.txt"

echo 第1章横板背景：loop.png > "drop\背景\1\放到这里.txt"
echo 规格 3840x720 PNG，左右无缝。 >> "drop\背景\1\放到这里.txt"

echo.
echo 投放目录：%CD%\drop
echo 角色走路：%CD%\drop\走路
echo 第1章背景：%CD%\drop\背景\1\loop.png
echo.
echo 先打开「背景」文件夹。这个黑窗口不要关。
echo 不要把图拖进 Cursor 对话。
echo.

explorer "%CD%\drop\背景"
call npm run drop:watch -- --push
pause
