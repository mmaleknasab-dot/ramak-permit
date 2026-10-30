@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo در حال اجرای سرور پرمیت رامک...
node server.js
pause
