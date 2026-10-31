@echo off
chcp 65001 >nul
cls
echo ========================================================
echo   SUBIDA A GITHUB - TIENDA ALEXANDER
echo ========================================================
echo [1] Subida rapida (rama actual)
echo [2] Configurar usuario/correo local de este repositorio y elegir rama
echo ========================================================
set /p opcion="Elige una opcion (1 o 2): "

if "%opcion%"=="1" goto pedir_commit
if "%opcion%"=="2" goto configurar_local
goto fin

:configurar_local
echo.
set /p gemail="Escribe tu correo de Git: "
set /p gname="Escribe tu nombre de usuario: "
set /p rama="Escribe la rama destino (ej: main, develop): "
if not "%gemail%"=="" git config user.email "%gemail%"
if not "%gname%"=="" git config user.name "%gname%"
if not "%rama%"=="" (
    git checkout %rama% 2>nul || git checkout -b %rama%
)
goto pedir_commit

:pedir_commit
echo.
set /p mensaje="Escribe el mensaje del commit: "
if "%mensaje%"=="" set mensaje=Actualizacion del sistema
git add .
git commit -m "%mensaje%"
git push -u origin HEAD
echo.
echo ========================================
echo   Proceso completado.
echo ========================================
pause
exit /b 0

:fin
echo Opcion no valida.
pause
