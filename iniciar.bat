@echo off
title Tienda Alexander - Iniciando Sistema
color 0A
cls

echo ==========================================================
echo        TIENDA ALEXANDER - SISTEMA DE GESTION
echo ==========================================================
echo.
echo [1/3] Verificando entorno de ejecucion Python...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] No se encontro Python instalado en el sistema.
    echo Por favor instala Python 3.10 o superior desde https://www.python.org/
    echo y asegurate de marcar la casilla "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

echo [OK] Python detectado.
echo.
echo [2/3] Verificando dependencias...
pip install -r requirements.txt --quiet >nul 2>&1

echo.
echo [3/3] Iniciando aplicacion y reproduciendo base de datos SQLite...
echo El navegador web se abrira automaticamente en http://127.0.0.1:5000/
echo.
echo Para cerrar el sistema, simplemente cierra esta ventana.
echo ==========================================================
echo.

python app.py

pause

