@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist drop mkdir drop
explorer "%CD%\drop"
echo.
echo 已打开 drop 文件夹。生成的 png 直接扔进来就行，不用分类。
echo 这个黑窗口不要关。
echo.
call npm run drop:watch -- --push
pause
