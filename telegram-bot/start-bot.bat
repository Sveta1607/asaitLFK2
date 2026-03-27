@echo off
REM Этот файл создан, чтобы запускать бота двойным щелчком из проводника (папка на рабочем столе или где угодно).
chcp 65001 >nul
cd /d "%~dp0"

title Telegram-бот записи ЛФК

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js не найден в PATH.
    echo Установите LTS с https://nodejs.org/ и перезапустите компьютер.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Первый запуск: устанавливаю зависимости ^(npm install^)...
    call npm install
    if errorlevel 1 (
        echo Ошибка npm install.
        pause
        exit /b 1
    )
    echo.
)

REM Частая ошибка Windows: файл называется .env.txt — «Блокнот» добавляет .txt, а .env не виден.
if not exist ".env" (
    if exist ".env.txt" (
        echo Найден файл .env.txt — копирую в .env ^(так Node.js сможет его прочитать^)...
        copy /Y ".env.txt" ".env" >nul
    )
)
if not exist ".env" (
    echo Файл .env не найден в папке:
    echo   %CD%
    echo.
    echo Создайте здесь файл с именем именно .env ^(не env.txt^).
    echo Скопируйте .env.example в .env и впишите TELEGRAM_BOT_TOKEN=ваш_токен
    echo.
    echo Если уже создавали файл: в Проводнике включите «Расширения имён файлов»
    echo ^(Вид - Показать - Расширения имён файлов^) и проверьте, что нет лишнего .txt в конце.
    pause
    exit /b 1
)

echo Запуск бота... ^(закройте окно или Ctrl+C, чтобы остановить^)
echo.
call npm start
echo.
echo Бот остановлен.
pause
