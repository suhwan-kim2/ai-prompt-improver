@echo off
REM Scalping report bot launcher. Keep this file ASCII + CRLF.
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo   Scalping Report Bot
echo   ===================
echo.

where node >nul 2>nul
if errorlevel 1 goto NONODE

if exist node_modules goto RUN

echo   First run - installing dependencies. This takes a few minutes...
echo.
call npm install
if errorlevel 1 goto INSTALLFAIL

:RUN
node src\index.js go
if errorlevel 1 goto RUNFAIL
goto END

:NONODE
echo   [!] Node.js is not installed.
echo.
echo       Install the LTS version from https://nodejs.org
echo       then run this file again.
goto END

:INSTALLFAIL
echo.
echo   [!] Install failed. Check your internet connection and try again.
echo       If it keeps failing, open a terminal here and run:  npm install
goto END

:RUNFAIL
echo.
echo   [!] The bot stopped with an error. The message is above.
goto END

:END
echo.
pause
endlocal
