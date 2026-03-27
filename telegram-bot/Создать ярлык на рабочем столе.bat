@echo off
REM Запускает PowerShell-скрипт, который кладёт ярлык на рабочий стол (корректные пути с пробелами и кириллицей).
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-desktop-shortcut.ps1"
if errorlevel 1 (
    echo Ошибка создания ярлыка.
    pause
    exit /b 1
)
echo.
pause
