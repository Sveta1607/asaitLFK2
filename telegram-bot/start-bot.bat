@echo off
REM This block is created to run from script folder.
cd /d "%~dp0"

REM This block is created to ensure Node.js exists.
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found in PATH.
  echo Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

REM This block is created to install dependencies on first run.
if not exist "node_modules\" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

REM This block is created to auto-fix accidental .env.txt filename.
if not exist ".env" if exist ".env.txt" copy /Y ".env.txt" ".env" >nul

REM This block is created to stop if env file is missing.
if not exist ".env" (
  echo Missing .env file in:
  echo %CD%
  echo Copy .env.example to .env and set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_API_SECRET, API_BASE_URL, OPENAI_API_KEY.
  pause
  exit /b 1
)

REM This block is created to start telegram bot process.
echo Starting telegram bot...
call npm start

REM This block is created to keep console open after stop.
echo Bot stopped.
pause
