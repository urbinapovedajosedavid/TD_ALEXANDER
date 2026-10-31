@echo off
title Tienda Alexander - Generador de Ejecutable (.EXE)
color 0B
cls

echo ==========================================================
echo    GENERADOR DE ARCHIVO EJECUTABLE (.EXE) - TIENDA ALEXANDER
echo ==========================================================
echo.
echo [1/2] Verificando e instalando PyInstaller...
echo ==========================================================
python -m pip install --upgrade pip
python -m pip install pyinstaller -r requirements.txt

if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] No se pudo instalar PyInstaller o las dependencias.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo [2/2] Compilando el proyecto usando TiendaAlexander.spec...
echo ==========================================================

pyinstaller --noconfirm --clean TiendaAlexander.spec

if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Ocurrio un fallo durante la compilacion.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo    COMPILACION COMPLETADA CON EXITO!
echo ==========================================================
echo Tu aplicacion se encuentra lista en:
echo   dist\TiendaAlexander\TiendaAlexander.exe
echo.
echo Al ejecutarse por primera vez creara automaticamente la base de
echo datos SQLite y generara una clave secreta unica en su propio .env.
echo.
pause
