@echo off
setlocal EnableDelayedExpansion
title Tienda Alexander - Compilador y Asistente de Entorno
color 0B
cls

set "PROYECTO_DIR=%~dp0"
set "PYTHON_EXE="

echo =====================================================================
echo        TIENDA ALEXANDER - COMPILADOR Y CONFIGURADOR DE ENTORNO
echo =====================================================================
echo Este asistente verificara e instalara todos los componentes necesarios:
echo   1. Python (Deteccion o descarga e instalacion desatendida)
echo   2. Entorno virtual (.venv)
echo   3. Actualizacion de pip
echo   4. Dependencias del proyecto (Flask, Flask-Cors)
echo   5. Soporte para base de datos SQLite (sqlite3)
echo =====================================================================
echo.

:: ===================================================================
:: PASO 1: COMPROBACION O INSTALACION AUTOMATICA DE PYTHON
:: ===================================================================
echo [PASO 1/5] Comprobando disponibilidad de Python en el sistema...

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    echo   [OK] Python detectado en PATH:
    python --version
    goto venv_etapa
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=py"
    echo   [OK] Lanzador py detectado:
    py --version
    goto venv_etapa
)

for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*" "%ProgramFiles%\Python3*") do (
    if not defined PYTHON_EXE (
        if exist "%%D\python.exe" (
            set "PYTHON_EXE=%%D\python.exe"
            set "PATH=%%D;%%D\Scripts;%PATH%"
        )
    )
)

if defined PYTHON_EXE (
    echo   [OK] Python localizado en el sistema:
    "%PYTHON_EXE%" --version
    goto venv_etapa
)

echo.
echo   [AVISO] No se encontro Python instalado en el equipo.
echo   Iniciando descarga e instalacion automatica...
echo.

set "PY_ARCH=amd64"
set "PY_VERSION=3.11.9"
if "%PROCESSOR_ARCHITECTURE%"=="x86" (
    if not defined PROCESSOR_ARCHITEW6432 set "PY_ARCH=win32"
)

if "%PY_ARCH%"=="amd64" (
    set "PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    set "INSTALLER_NAME=python-3.11.9-amd64.exe"
) else (
    set "PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9.exe"
    set "INSTALLER_NAME=python-3.11.9.exe"
)

set "TEMP_INSTALLER=%TEMP%\%INSTALLER_NAME%"

echo   Descargando Python %PY_VERSION% para arquitectura %PY_ARCH%...
echo   URL: %PY_URL%
echo.

where curl.exe >nul 2>&1
if %errorlevel% equ 0 (
    curl.exe -# -f -L -o "%TEMP_INSTALLER%" "%PY_URL%"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'Continue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%PY_URL%', '%TEMP_INSTALLER%')"
)

if not exist "%TEMP_INSTALLER%" goto error_descarga_python

echo.
echo   [INSTALACION] Ejecutando instalador oficial de Python en modo silencioso...
echo   Configurando componentes y agregando al PATH. Espere unos momentos...

"%TEMP_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_pip=1 SimpleInstall=1

timeout /t 6 /nobreak >nul
del "%TEMP_INSTALLER%" >nul 2>&1

for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*" "%ProgramFiles%\Python3*") do (
    if not defined PYTHON_EXE (
        if exist "%%D\python.exe" (
            set "PYTHON_EXE=%%D\python.exe"
            set "PATH=%%D;%%D\Scripts;%PATH%"
        )
    )
)

if not defined PYTHON_EXE goto error_instalacion_python

echo   [OK] Python instalado e integrado al sistema con exito.
goto venv_etapa

:error_descarga_python
color 0C
echo.
echo   [ERROR] No se pudo descargar el instalador de Python.
echo   Por favor instala Python manualmente desde https://www.python.org/
echo.
pause
exit /b 1

:error_instalacion_python
color 0C
echo.
echo   [ERROR] La instalacion finalizo pero no se detecto el ejecutable de Python.
echo   Por favor abre una nueva ventana de terminal o reinicia la sesion.
echo.
pause
exit /b 1

:venv_etapa
echo.
:: ===================================================================
:: PASO 2: CREACION / VERIFICACION DEL ENTORNO VIRTUAL (.venv)
:: ===================================================================
echo [PASO 2/5] Configurando el entorno virtual (.venv)...

if exist "%PROYECTO_DIR%.venv\Scripts\python.exe" (
    echo   [OK] Entorno virtual (.venv) ya existente y listo.
    goto pip_etapa
)

echo   Creando entorno virtual en %PROYECTO_DIR%.venv ...
"%PYTHON_EXE%" -m venv "%PROYECTO_DIR%.venv"
if %errorlevel% neq 0 (
    color 0C
    echo   [ERROR] Fallo la creacion del entorno virtual (.venv).
    pause
    exit /b 1
)
echo   [OK] Entorno virtual creado exitosamente.

:pip_etapa
set "VENV_PY=%PROYECTO_DIR%.venv\Scripts\python.exe"
echo.

:: ===================================================================
:: PASO 3: ACTUALIZACION DE PIP
:: ===================================================================
echo [PASO 3/5] Actualizando el gestor de paquetes pip en el entorno virtual...
"%VENV_PY%" -m pip install --upgrade pip
if %errorlevel% neq 0 (
    echo   [AVISO] No se pudo actualizar pip, se continuara con la version actual.
) else (
    echo   [OK] Pip actualizado satisfactoriamente.
)
echo.

:: ===================================================================
:: PASO 4: INSTALACION DE DEPENDENCIAS (requirements.txt)
:: ===================================================================
echo [PASO 4/5] Instalando dependencias requeridas (Flask, Flask-Cors)...

if not exist "%PROYECTO_DIR%requirements.txt" (
    echo   [AVISO] Creando archivo requirements.txt base...
    echo Flask^>=3.0> "%PROYECTO_DIR%requirements.txt"
    echo Flask-Cors^>=4.0>> "%PROYECTO_DIR%requirements.txt"
)

"%VENV_PY%" -m pip install -r "%PROYECTO_DIR%requirements.txt"
if %errorlevel% neq 0 (
    color 0C
    echo   [ERROR] Ocurrio un error al instalar los paquetes de requirements.txt.
    echo   Por favor revisa tu conexion a internet o los errores mostrados arriba.
    echo.
    pause
    exit /b 1
)
echo   [OK] Todas las librerias han sido instaladas correctamente.
echo.

:: ===================================================================
:: PASO 5: VERIFICACION Y SOPORTE DE SQLITE
:: ===================================================================
echo [PASO 5/5] Verificando soporte para base de datos SQLite (sqlite3)...

"%VENV_PY%" -c "import sqlite3; conn=sqlite3.connect(':memory:'); conn.execute('CREATE TABLE _test(id INT);'); conn.close(); print('  -> Version de SQLite:', sqlite3.sqlite_version)"
if %errorlevel% equ 0 goto sqlite_listo

echo   [AVISO] El modulo estandar sqlite3 fallo. Intentando instalar pysqlite3-binary...
"%VENV_PY%" -m pip install pysqlite3-binary
"%VENV_PY%" -c "import sqlite3; conn=sqlite3.connect(':memory:'); conn.close()" >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo   [ERROR] No se pudo verificar el soporte para SQLite.
    pause
    exit /b 1
)

:sqlite_listo
echo   [OK] Soporte SQLite (sqlite3) comprobado y 100%% funcional.
echo.

:: ===================================================================
:: RESUMEN FINAL
:: ===================================================================
color 0A
echo =====================================================================
echo         COMPILACION Y PREPARACION FINALIZADA CON EXITO
echo =====================================================================
echo Todos los requisitos fueron verificados e instalados:
echo   [v] Interprete Python configurado
echo   [v] Entorno virtual (.venv) listo
echo   [v] Gestor de paquetes pip actualizado
echo   [v] Librerias requeridas (Flask, Flask-Cors) instaladas
echo   [v] Motor y modulo SQLite (sqlite3) validado
echo =====================================================================
echo.
echo Ya puedes iniciar la aplicacion mediante:
echo   * iniciar.bat
echo.
set /p INICIAR_AHORA="Deseas iniciar la aplicacion ahora mismo? (S/N): "
if /i "%INICIAR_AHORA%"=="S" (
    echo.
    echo Lanzando iniciar.bat...
    call "%PROYECTO_DIR%iniciar.bat"
) else (
    echo.
    echo Proceso terminado exitosamente. Presiona cualquier tecla para salir.
    pause
)