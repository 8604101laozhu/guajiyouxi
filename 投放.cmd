@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist drop\走路 mkdir drop\走路
explorer "%CD%\drop"
echo 投放文件夹已打开。把 0.png 丢进 走路 / 攻击 / 死亡。
echo 正在监视，拷进仓库并 git push …
call npm run drop:watch -- --push
pause
