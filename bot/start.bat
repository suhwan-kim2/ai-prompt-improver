@echo off
REM 더블클릭으로 실행. 처음이면 필요한 것부터 설치한다.
cd /d "%~dp0"
chcp 65001 >nul

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해주세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 처음 실행이라 필요한 것을 설치합니다. 몇 분 걸립니다...
  call npm install
  if errorlevel 1 ( echo 설치에 실패했습니다. & pause & exit /b 1 )
)

node src/index.js go
echo.
pause
