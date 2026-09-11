@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist drop\走路 mkdir drop\走路
explorer "%CD%\drop"
echo.
echo 已打开 drop 文件夹。
echo 把生成的 png 复制进「走路」。攻击、死亡同理。
echo 这个黑窗口不要关。复制进去就会自动上传。
echo.
call npm run drop:watch -- --push
pause
