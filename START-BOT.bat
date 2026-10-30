@echo off
chcp 65001 >nul
cd /d "%~dp0"
if "%BALE_TOKEN%"=="" (
  set /p BALE_TOKEN=توکن بازوی بله را وارد کنید: 
)
if "%RAMAK_API%"=="" set RAMAK_API=http://127.0.0.1:3780
echo اجرای بازو — API=%RAMAK_API%
node bot.js
pause
