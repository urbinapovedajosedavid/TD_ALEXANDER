@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Tienda Alexander - Panel de Control Administrativo
color 0E

rem ===================================================================
rem VERIFICACIÓN Y AUTO-ELEVACIÓN DE PRIVILEGIOS DE ADMINISTRADOR
rem ===================================================================
net session >nul 2>&1
if %errorlevel% equ 0 goto es_admin

echo.
echo =====================================================================
echo    SOLICITANDO PRIVILEGIOS DE ADMINISTRADOR EN WINDOWS...
echo =====================================================================
echo Por favor confirma la ventana de Control de Cuentas de Usuario.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:es_admin
rem Al elevarse, Windows cambia el directorio a System32, forzamos la ruta del proyecto
cd /d "%~dp0"
set "PROYECTO_DIR=%~dp0"

rem ===================================================================
rem LOCALIZAR INTÉRPRETE DE PYTHON
rem ===================================================================
set "PYTHON_EXE="

if exist "%PROYECTO_DIR%.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%PROYECTO_DIR%.venv\Scripts\python.exe"
    goto menu_principal
)

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    goto menu_principal
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py"
    goto menu_principal
)

color 0C
echo.
echo =====================================================================
echo [ERROR] No se detectó Python ni el entorno virtual .venv
echo Por favor ejecuta primero compilar.bat para configurar el sistema.
echo =====================================================================
echo.
pause
exit /b 1

rem ===================================================================
rem MENÚ PRINCIPAL INTERACTIVO
rem ===================================================================
:menu_principal
cls
echo =====================================================================
echo         TIENDA ALEXANDER — GESTIÓN Y ACCESOS ADMINISTRATIVOS
echo                       [ MODO ADMINISTRADOR ]
echo =====================================================================
echo.
echo   [1] Recuperar cuenta
echo       (Genera clave temporal para login y exige cambio obligatorio)
echo.
echo   [2] Contraseña de usuarios
echo       (Lista los usuarios registrados y permite modificar contraseñas)
echo.
echo   [3] Desarrolladores
echo       (Control maestro, copias de seguridad, restablecimiento y dev)
echo.
echo   [4] Salir
echo.
echo =====================================================================
set /p OPCION_ADMIN="Selecciona una opción [1-4]: "

if "%OPCION_ADMIN%"=="1" goto ejecutar_recuperar
if "%OPCION_ADMIN%"=="2" goto ejecutar_usuarios
if "%OPCION_ADMIN%"=="3" goto ejecutar_desarrolladores
if "%OPCION_ADMIN%"=="4" goto salir
goto menu_principal

:ejecutar_recuperar
cls
"%PYTHON_EXE%" -B "%PROYECTO_DIR%backend\admin_cli.py" recuperar
echo.
echo Presiona cualquier tecla para volver al menú administrativo...
pause >nul
goto menu_principal

:ejecutar_usuarios
cls
"%PYTHON_EXE%" -B "%PROYECTO_DIR%backend\admin_cli.py" usuarios
echo.
echo Presiona cualquier tecla para volver al menú administrativo...
pause >nul
goto menu_principal

:ejecutar_desarrolladores
cls
"%PYTHON_EXE%" -B "%PROYECTO_DIR%backend\admin_cli.py" dev
echo.
echo Presiona cualquier tecla para volver al menú administrativo...
pause >nul
goto menu_principal

:salir
cls
echo Saliendo del panel administrativo de Tienda Alexander...
timeout /t 1 /nobreak >nul
exit /b 0
