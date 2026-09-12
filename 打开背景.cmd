@echo off
cd /d "%~dp0"
node -e "const fs=require('fs');const p='drop/bg/1';fs.mkdirSync(p,{recursive:true});fs.writeFileSync(p+'/PUT_LOOP_HERE.txt','Save loop.png in this folder.\n');console.log('OK: '+p);"
explorer "%CD%\drop\bg\1"
echo.
echo Put loop.png into: %CD%\drop\bg\1\
echo Then keep 投放.cmd watching, or run: npm run drop:watch -- --push
echo.
pause
