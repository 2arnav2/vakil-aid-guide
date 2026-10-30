@echo off
setlocal
title Margavidi - Legal Aid Guide
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo Node.js was not found on this computer.
    echo Please install it from https://nodejs.org/ and then run this file again.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo First run detected - installing dependencies. This may take a few minutes...
    call npm install
    if errorlevel 1 (
        echo.
        echo Dependency installation failed. Please check the error above.
        echo.
        pause
        exit /b 1
    )
)

if /i not "%~1"=="--no-open" (
    start "" cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:8080"
)

echo.
echo Starting Margavidi at http://localhost:8080
echo Keep this window open while using the app. Press Ctrl+C to stop.
echo.
call npm run dev
pause
