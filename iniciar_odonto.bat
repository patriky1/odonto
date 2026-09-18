@echo off
title Sistema Odonto

echo ==========================================
echo       INICIANDO SISTEMA ODONTO
echo ==========================================
echo.

echo [1/3] Iniciando FRONTEND...
start "ODONTO - FRONTEND" cmd /k "cd /d C:\Users\Lindairis\Desktop\odonto\frontend && npm run dev"

timeout /t 4 /nobreak >nul

echo [2/3] Iniciando BACKEND...
start "ODONTO - BACKEND" cmd /k "cd /d C:\Users\Lindairis\Desktop\odonto\backend && npm run dev"

timeout /t 4 /nobreak >nul

echo [3/3] Iniciando NGROK...
start "ODONTO - NGROK" cmd /k "ngrok http --host-header=rewrite 5173"

echo.
echo Aguardando o sistema iniciar...
timeout /t 8 /nobreak >nul

echo Abrindo sistema no Google Chrome...

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "https://banter-payable-lumber.ngrok-free.dev"

echo.
echo ==========================================
echo       SISTEMA ODONTO INICIADO
echo ==========================================
echo.
echo Link:
echo https://banter-payable-lumber.ngrok-free.dev
echo.
pause