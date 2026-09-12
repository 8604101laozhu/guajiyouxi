@echo off
cd /d "%~dp0"
if not exist drop\bg\1 mkdir drop\bg\1
explorer "%CD%\drop\bg\1"
echo Put loop.png into: %CD%\drop\bg\1\
pause
