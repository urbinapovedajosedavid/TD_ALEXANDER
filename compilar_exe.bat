@echo off
title Tienda Alexander - Generador de Ejecutable (.EXE)
color 0B
cls

echo ==========================================================
echo    GENERADOR DE ARCHIVO EJECUTABLE (.EXE) - TIENDA ALEXANDER
echo ==========================================================
echo.
echo Este script creara un ejecutable de UN SOLO CLIC que:
echo   1. Contiene el servidor Flask y la API completa.
echo   2. Integra el Frontend (HTML, CSS, JS e imagenes).
echo   3. Reproduce automaticamente la base de datos SQLite persistente.
echo   4. Abre el navegador web automaticamente al ejecutarse.
echo.
echo ==========================================================
echo [1/3] Verificando e instalando PyInstaller...
echo ==========================================================
python -m pip install --upgrade pip
pip install pyinstaller -r requirements.txt

if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] No se pudo instalar PyInstaller o las dependencias.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo [2/3] Compilando el proyecto en dist\TiendaAlexander.exe...
echo ==========================================================

pyinstaller --noconfirm --clean ^
    --name "TiendaAlexander" ^
    --onedir ^
    --add-data "Frontend;Frontend" ^
    --add-data "database\esquema.sql;database" ^
    --add-data ".env;." ^
    --hidden-import "werkzeug" ^
    --hidden-import "werkzeug.security" ^
    --hidden-import "sqlite3" ^
    --hidden-import "flask_cors" ^
    --hidden-import "api" ^
    --hidden-import "api.auth" ^
    --hidden-import "api.usuarios" ^
    --hidden-import "api.productos" ^
    --hidden-import "api.ventas" ^
    --hidden-import "api.proveedores" ^
    --hidden-import "api.reportes" ^
    --hidden-import "api.respaldos" ^
    --hidden-import "seguridad" ^
    --hidden-import "seguridad.autenticacion" ^
    --hidden-import "seguridad.decoradores" ^
    --hidden-import "seguridad.modelos" ^
    app.py

if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Ocurrio un fallo durante la compilacion.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo [3/3] Finalizando paquete distribuible...
echo ==========================================================
copy .env dist\TiendaAlexander\.env >nul 2>&1
if not exist "dist\TiendaAlexander\database" mkdir "dist\TiendaAlexander\database"
copy database\esquema.sql dist\TiendaAlexander\database\esquema.sql >nul 2>&1

echo.
echo ==========================================================
echo    COMPILACION COMPLETADA CON EXITO!
echo ==========================================================
echo Tu aplicacion se encuentra lista en la carpeta:
echo   dist\TiendaAlexander\TiendaAlexander.exe
echo.
echo Al hacer doble clic sobre 'TiendaAlexander.exe':
echo   - La base de datos se crea/reproduce automaticamente.
echo   - El navegador se abre automaticamente en la pantalla de login.
echo.
pause

