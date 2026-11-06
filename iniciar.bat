@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Tienda Alexander - Verificacion e Inicio del Sistema
color 0B
cls

set "PROYECTO_DIR=%~dp0"
set "TOTAL_FALTANTES=0"

set "FALTA_PYTHON=0"
set "FALTA_VENV=0"
set "FALTA_LIBS=0"
set "FALTA_SQLITE=0"

set "PYTHON_SISTEMA="

echo =====================================================================
echo                TIENDA ALEXANDER - SISTEMA DE GESTION
echo =====================================================================
echo Iniciando verificacion sistematica de todos los requisitos...
echo =====================================================================
echo.

rem ===================================================================
rem 1. VERIFICACION DE PYTHON
rem ===================================================================
echo [1/4] Verificando presencia de Python en el equipo...

python --version >nul 2>&1
if !errorlevel! equ 0 (
    set "PYTHON_SISTEMA=python"
    echo   [OK] Python detectado en PATH:
    python --version
    goto check_venv
)

py --version >nul 2>&1
if !errorlevel! equ 0 (
    set "PYTHON_SISTEMA=py"
    echo   [OK] Lanzador py detectado:
    py --version
    goto check_venv
)

for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*" "%ProgramFiles%\Python3*") do (
    if not defined PYTHON_SISTEMA (
        if exist "%%D\python.exe" (
            set "PYTHON_SISTEMA=%%D\python.exe"
        )
    )
)

if defined PYTHON_SISTEMA (
    echo   [OK] Python localizado en el sistema:
    "%PYTHON_SISTEMA%" --version
    goto check_venv
)

if not exist "%PROYECTO_DIR%.venv\Scripts\python.exe" goto python_no_encontrado

echo   [OK] Python detectado en el entorno virtual:
"%PROYECTO_DIR%.venv\Scripts\python.exe" --version
goto check_venv

:python_no_encontrado
set "FALTA_PYTHON=1"
set /a TOTAL_FALTANTES+=1
echo   [FALTANTE] Python no se encuentra instalado en la PC ni en PATH.

:check_venv
echo.
rem ===================================================================
rem 2. VERIFICACION DEL ENTORNO VIRTUAL (VENV)
rem ===================================================================
echo [2/4] Verificando entorno virtual (.venv)...
if not exist "%PROYECTO_DIR%.venv\Scripts\python.exe" goto venv_no_encontrado

echo   [OK] Entorno virtual (.venv) encontrado y activo.
goto check_libs

:venv_no_encontrado
set "FALTA_VENV=1"
set /a TOTAL_FALTANTES+=1
echo   [FALTANTE] El entorno virtual (.venv) no existe o no tiene python.exe.

:check_libs
echo.
rem ===================================================================
rem 3. VERIFICACION DE LIBRERIAS Y DEPENDENCIAS
rem ===================================================================
echo [3/4] Verificando librerias requeridas (Flask, Flask-Cors)...
if not exist "%PROYECTO_DIR%.venv\Scripts\python.exe" goto libs_sin_venv

"%PROYECTO_DIR%.venv\Scripts\python.exe" -c "import flask, flask_cors" >nul 2>&1
if !errorlevel! neq 0 goto libs_faltantes

echo   [OK] Librerias requeridas (Flask, Flask-Cors) instaladas correctamente.
goto check_sqlite

:libs_sin_venv
set "FALTA_LIBS=1"
set /a TOTAL_FALTANTES+=1
echo   [FALTANTE] Dependencias no verificadas porque falta el entorno virtual (.venv).
goto check_sqlite

:libs_faltantes
set "FALTA_LIBS=1"
set /a TOTAL_FALTANTES+=1
echo   [FALTANTE] Faltan librerias requeridas (Flask y/o Flask-Cors) en el entorno.

:check_sqlite
echo.
rem ===================================================================
rem 4. VERIFICACION DEL SOPORTE DE SQLITE
rem ===================================================================
echo [4/4] Verificando soporte para base de datos SQLite (sqlite3)...
set "SQLITE_OK=0"

if exist "%PROYECTO_DIR%.venv\Scripts\python.exe" (
    "%PROYECTO_DIR%.venv\Scripts\python.exe" -c "import sqlite3; c=sqlite3.connect(':memory:'); c.execute('CREATE TABLE t(x INT);'); c.close()" >nul 2>&1
    if !errorlevel! equ 0 set "SQLITE_OK=1"
) else if defined PYTHON_SISTEMA (
    "%PYTHON_SISTEMA%" -c "import sqlite3; c=sqlite3.connect(':memory:'); c.execute('CREATE TABLE t(x INT);'); c.close()" >nul 2>&1
    if !errorlevel! equ 0 set "SQLITE_OK=1"
)

if "%SQLITE_OK%"=="1" (
    echo   [OK] Modulo y soporte SQLite (sqlite3) comprobado exitosamente.
) else (
    set "FALTA_SQLITE=1"
    set /a TOTAL_FALTANTES+=1
    echo   [FALTANTE] El soporte para SQLite (sqlite3) no esta disponible o presenta fallas.
)
echo.

rem ===================================================================
rem RECOPILACION Y EVALUACION FINAL DE REQUISITOS
rem ===================================================================
if %TOTAL_FALTANTES% gtr 0 goto mostrar_faltantes

rem ===================================================================
rem INICIO DEL SISTEMA (SOLO SI ABSOLUTAMENTE TODO ESTA CORRECTO)
rem ===================================================================
color 0A
echo =====================================================================
echo       TODOS LOS REQUISITOS HAN SIDO VERIFICADOS EXITOSAMENTE
echo =====================================================================
echo.
echo [OK] Python, entorno .venv, librerias y SQLite estan 100%% listos.
echo [OK] Iniciando Tienda Alexander...
echo.
echo   * URL de la aplicacion: http://127.0.0.1:5000/
echo   * Base de datos SQLite: database\tienda_alexander.db
echo   * Para cerrar el sistema, presiona Ctrl + C o cierra esta ventana.
echo.
echo =====================================================================
echo.

"%PROYECTO_DIR%.venv\Scripts\python.exe" -B app.py

pause
exit /b 0

:mostrar_faltantes
color 0C
echo =====================================================================
echo            INFORME DE REQUISITOS FALTANTES DETECTADOS
echo =====================================================================
echo El sistema NO puede iniciar debido a los siguientes %TOTAL_FALTANTES% elemento(s) faltante(s):
echo.
if %FALTA_PYTHON% equ 1 echo   [X] Python          : Falta instalar Python o agregarlo a la variable PATH.
if %FALTA_VENV% equ 1 echo   [X] Entorno Virtual : No se encuentra la carpeta .venv o esta incompleta.
if %FALTA_LIBS% equ 1 echo   [X] Dependencias    : Faltan instalar Flask y/o Flask-Cors desde requirements.txt.
if %FALTA_SQLITE% equ 1 echo   [X] Soporte SQLite  : El modulo sqlite3 no esta disponible en el entorno.
echo.
echo =====================================================================
echo ATENCION:
echo Ejecuta el archivo ejecutar.bat para corregir e instalar lo necesario.
echo =====================================================================
echo.
pause
exit /b 1