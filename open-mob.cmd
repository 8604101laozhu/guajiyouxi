@echo off
cd /d "%~dp0"
if not exist "drop\mob\minion\walking" mkdir "drop\mob\minion\walking"
if not exist "drop\mob\champion\walking" mkdir "drop\mob\champion\walking"
if not exist "drop\mob\boss\walking" mkdir "drop\mob\boss\walking"
explorer "drop\mob\minion\walking"
