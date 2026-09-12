@echo off
cd /d "%~dp0"
if not exist drop\bg\1 mkdir drop\bg\1
explorer "%CD%\drop\bg"
echo Put loop.png into drop\bg\1\
pause
