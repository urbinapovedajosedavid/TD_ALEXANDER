compilar_content = """@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
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

rem ===================================================================
rem PASO 1: COMPROBACION O INSTALACION AUTOMATICA DE PYTHON
rem ===================================================================
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

for /d %%D in ("%LOCALAPPDATA%\\Programs\\Python\\Python3*" "%ProgramFiles%\\Python3*") do (
    if not defined PYTHON_EXE (
        if exist "%%D\\python.exe" (
            set "PYTHON_EXE=%%D\\python.exe"
            set "PATH=%%D;%%D\\Scripts;!PATH!"
            echo   [OK] Python localizado en %%D:
            "%%D\\python.exe" --version
            goto venv_etapa
        )
    )
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

set "TEMP_INSTALLER=%TEMP%\\%INSTALLER_NAME%"

echo   Descargando Python %PY_VERSION% (%PY_ARCH%)...
echo   URL: %PY_URL%
echo   Progreso de descarga en tiempo real:
echo.

where curl.exe >nul 2>&1
if %errorlevel% equ 0 (
    curl.exe -# -f -L -o "%TEMP_INSTALLER%" "%PY_URL%"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'Continue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%PY_URL%', '%TEMP_INSTALLER%')"
)

if not exist "%TEMP_INSTALLER%" (
    color 0C
    echo.
    echo   [ERROR] No se pudo descargar el instalador de Python.
    echo   Por favor instala Python manualmente desde https://www.python.org/
    echo.
    pause
    exit /b 1
)

echo.
echo   [INSTALACION] Ejecutando instalador oficial de Python en modo silencioso...
echo   Configurando componentes y agregando al PATH. Espere unos momentos...

"%TEMP_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_pip=1 SimpleInstall=1

timeout /t 6 /nobreak >nul
del "%TEMP_INSTALLER%" >nul 2>&1

for /d %%D in ("%LOCALAPPDATA%\\Programs\\Python\\Python3*" "%ProgramFiles%\\Python3*") do (
    if not defined PYTHON_EXE (
        if exist "%%D\\python.exe" (
            set "PYTHON_EXE=%%D\\python.exe"
            set "PATH=%%D;%%D\\Scripts;!PATH!"
        )
    )
)

if not defined PYTHON_EXE (
    color 0C
    echo.
    echo   [ERROR] La instalacion finalizo pero no se detecto el ejecutable de Python.
    echo   Por favor abre una nueva ventana de terminal o reinicia la sesion.
    echo.
    pause
    exit /b 1
)

echo   [OK] Python instalado e integrado al sistema con exito.

:venv_etapa
echo.
rem ===================================================================
rem PASO 2: CREACION / VERIFICACION DEL ENTORNO VIRTUAL (.venv)
rem ===================================================================
echo [PASO 2/5] Configurando el entorno virtual (.venv)...

if exist "%PROYECTO_DIR%.venv\\Scripts\\python.exe" (
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
set "VENV_PY=%PROYECTO_DIR%.venv\\Scripts\\python.exe"
echo.

rem ===================================================================
rem PASO 3: ACTUALIZACION DE PIP
rem ===================================================================
echo [PASO 3/5] Actualizando el gestor de paquetes pip en el entorno virtual...
"%VENV_PY%" -m pip install --upgrade pip
if %errorlevel% neq 0 (
    echo   [AVISO] No se pudo actualizar pip, se continuara con la version actual.
) else (
    echo   [OK] Pip actualizado satisfactoriamente.
)
echo.

rem ===================================================================
rem PASO 4: INSTALACION DE DEPENDENCIAS (requirements.txt)
rem ===================================================================
echo [PASO 4/5] Instalando dependencias requeridas (Flask, Flask-Cors)...

if not exist "%PROYECTO_DIR%requirements.txt" (
    echo   [AVISO] Creando archivo requirements.txt base...
    echo Flask^>=3.0> "%PROYECTO_DIR%requirements.txt"
    echo Flask-Cors^>=4.0>> "%PROYECTO_DIR%requirements.txt"
)

"%VENV_PY%" -m pip install -r "%PROYECTO_DIR%requirements.txt"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo   [ERROR] Ocurrio un error al instalar los paquetes de requirements.txt.
    echo   Por favor revisa tu conexion a internet o los errores mostrados arriba.
    echo.
    pause
    exit /b 1
)
echo   [OK] Todas las librerias han sido instaladas correctamente.
echo.

rem ===================================================================
rem PASO 5: VERIFICACION Y SOPORTE DE SQLITE
rem ===================================================================
echo [PASO 5/5] Verificando soporte para base de datos SQLite (sqlite3)...

"%VENV_PY%" -c "import sqlite3; conn=sqlite3.connect(':memory:'); conn.execute('CREATE TABLE _test(id INT);'); conn.close(); print('  -> Version de SQLite:', sqlite3.sqlite_version)"
if %errorlevel% neq 0 (
    echo   [AVISO] El modulo estandar sqlite3 fallo. Intentando instalar pysqlite3-binary...
    "%VENV_PY%" -m pip install pysqlite3-binary
    "%VENV_PY%" -c "import sqlite3; conn=sqlite3.connect(':memory:'); conn.close()" >nul 2>&1
    if %errorlevel% neq 0 (
        color 0C
        echo   [ERROR] No se pudo verificar el soporte para SQLite.
        pause
        exit /b 1
    )
)
echo   [OK] Soporte SQLite (sqlite3) comprobado y 100%% funcional.
echo.

rem ===================================================================
rem RESUMEN FINAL
rem ===================================================================
color 0A
echo =====================================================================
echo         COMPILACION Y PREPARACION FINALIZADA CON EXITO
echo =====================================================================
echo Todos los requisitos fueron verificados e instalados:
echo   [√] Interprete Python configurado
echo   [√] Entorno virtual (.venv) listo
echo   [√] Gestor de paquetes pip actualizado
echo   [√] Librerias requeridas (Flask, Flask-Cors) instaladas
echo   [√] Motor y modulo SQLite (sqlite3) validado
echo =====================================================================
echo.
echo Ya puedes iniciar la aplicacion mediante:
echo   - iniciar.bat 
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
"""

iniciar_content = """@echo off
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
if %errorlevel% equ 0 (
    set "PYTHON_SISTEMA=python"
    echo   [OK] Python detectado en PATH:
    python --version
    goto check_venv
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_SISTEMA=py"
    echo   [OK] Lanzador py detectado:
    py --version
    goto check_venv
)

for /d %%D in ("%LOCALAPPDATA%\\Programs\\Python\\Python3*" "%ProgramFiles%\\Python3*") do (
    if not defined PYTHON_SISTEMA (
        if exist "%%D\\python.exe" (
            set "PYTHON_SISTEMA=%%D\\python.exe"
            echo   [OK] Python localizado en %%D:
            "%%D\\python.exe" --version
            goto check_venv
        )
    )
)

if not exist "%PROYECTO_DIR%.venv\\Scripts\\python.exe" (
    set "FALTA_PYTHON=1"
    set /a TOTAL_FALTANTES+=1
    echo   [FALTANTE] Python no se encuentra instalado en la PC ni en PATH.
) else (
    echo   [OK] Python detectado en el entorno virtual:
    "%PROYECTO_DIR%.venv\\Scripts\\python.exe" --version
)

:check_venv
echo.
rem ===================================================================
rem 2. VERIFICACION DEL ENTORNO VIRTUAL (VENV)
rem ===================================================================
echo [2/4] Verificando entorno virtual (.venv)...
if not exist "%PROYECTO_DIR%.venv\\Scripts\\python.exe" (
    set "FALTA_VENV=1"
    set /a TOTAL_FALTANTES+=1
    echo   [FALTANTE] El entorno virtual (.venv) no existe o no tiene python.exe.
) else (
    echo   [OK] Entorno virtual (.venv) encontrado y activo.
)
echo.

rem ===================================================================
rem 3. VERIFICACION DE LIBRERIAS Y DEPENDENCIAS
rem ===================================================================
echo [3/4] Verificando librerias requeridas (Flask, Flask-Cors)...
if exist "%PROYECTO_DIR%.venv\\Scripts\\python.exe" (
    "%PROYECTO_DIR%.venv\\Scripts\\python.exe" -c "import flask, flask_cors" >nul 2>&1
    if !errorlevel! neq 0 (
        set "FALTA_LIBS=1"
        set /a TOTAL_FALTANTES+=1
        echo   [FALTANTE] Faltan librerias requeridas (Flask y/o Flask-Cors) en el entorno.
    ) else (
        echo   [OK] Librerias requeridas (Flask, Flask-Cors) instaladas correctamente.
    )
) else (
    set "FALTA_LIBS=1"
    set /a TOTAL_FALTANTES+=1
    echo   [FALTANTE] Dependencias no verificadas porque falta el entorno virtual (.venv).
)
echo.

rem ===================================================================
rem 4. VERIFICACION DEL SOPORTE DE SQLITE
rem ===================================================================
echo [4/4] Verificando soporte para base de datos SQLite (sqlite3)...
set "SQLITE_OK=0"

if exist "%PROYECTO_DIR%.venv\\Scripts\\python.exe" (
    "%PROYECTO_DIR%.venv\\Scripts\\python.exe" -c "import sqlite3; c=sqlite3.connect(':memory:'); c.execute('CREATE TABLE t(x INT);'); c.close()" >nul 2>&1
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
if %TOTAL_FALTANTES% gtr 0 (
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
    echo ejecuta el archivo compilar.bat para poder descargar los archivos necesarios
    echo =====================================================================
    echo.
    pause
    exit /b 1
)

rem ===================================================================
rem                      INICIO DEL SISTEMA
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
echo   * Base de datos SQLite: database\\tienda_alexander.db
echo   * Para cerrar el sistema, cierra esta ventana.
echo.
echo =====================================================================
echo.

"%PROYECTO_DIR%.venv\\Scripts\\python.exe" -B app.py

pause
"""

ejecutar_content = """@echo off
rem =====================================================================
rem   TIENDA ALEXANDER - ACCESO DE EJECUCION
rem   Este archivo enlaza directamente con iniciar.bat para ejecutar
rem   la comprobacion sistematica de requisitos y levantar el sistema.
rem =====================================================================
call "%~dp0iniciar.bat" %*
"""

def write_crlf(filename, content):
    content_crlf = content.replace('\\r\\n', '\\n').replace('\\n', '\\r\\n')
    with open(filename, 'wb') as f:
        f.write(content_crlf.encode('utf-8'))
    print(f"OK: {filename} ({len(content_crlf)} bytes)")

write_crlf('compilar.bat', compilar_content)
write_crlf('iniciar.bat', iniciar_content)

