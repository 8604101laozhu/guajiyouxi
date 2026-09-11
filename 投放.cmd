@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist drop mkdir drop
explorer "%CD%\drop"
echo.
echo 已打开 drop 文件夹。png 直接扔进来。
echo 这个黑窗口不要关。
echo 如果出现「没有 git」，先关掉，去双击 接通仓库.cmd。
echo 不要把图拖进 Cursor 对话。
echo.
call npm run drop:watch -- --push
pause
