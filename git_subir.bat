@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cls

title Subida a GitHub con Force - Tienda Alexander

echo ========================================================
echo        SUBIDA A GITHUB (FORCE) - TIENDA ALEXANDER
echo ========================================================
echo [1] Primera vez en esta PC (Limpieza de credenciales + Git Force)
echo [2] Uso frecuente / PC ya usada (Solo datos de commit + Git Force)
echo ========================================================
set /p opcion="Elige una opcion (1 o 2): "

if "%opcion%"=="1" goto primera_vez
if "%opcion%"=="2" goto uso_frecuente
goto fin

:primera_vez
echo.
echo ========================================================
echo   CONFIGURACION INICIAL, LIMPIEZA Y SUBIDA FORZADA
echo ========================================================
echo.
:: Eliminar credenciales guardadas en Windows para corregir bloqueos o error 403
cmdkey /delete:git:https://github.com >nul 2>&1
git config --global --unset credential.helper >nul 2>&1

set /p gemail="Escribe tu correo de Git: "
set /p gname="Escribe tu nombre de usuario de Git: "
set /p rama="Escribe la rama destino (ej: main, develop): "
set /p mensaje="Escribe el mensaje del commit: "

if "%gemail%"==" " set gemail=urbinapovedajosedavid@gmail.com
if "%gname%"==" " set gname=david.p
if "%rama%"==" " set rama=develop
if "%mensaje%"==" " set mensaje=Actualizacion e instalacion inicial

git config user.email "%gemail%"
git config user.name "%gname%"

git checkout %rama% 2>nul || git checkout -b %rama%
git add .
git commit -m "%mensaje%"

echo.
echo [!] Reemplazando repositorio en GitHub (git push --force)...
git push -f -u origin %rama%
goto resultado

:uso_frecuente
echo.
echo ========================================================
echo   SUBIDA RAPIDA CON FORZADO (PC YA USADA)
echo ========================================================
echo.
set /p gemail="Escribe tu correo de Git: "
set /p gname="Escribe tu nombre de usuario: "
set /p mensaje="Escribe el mensaje del commit: "

if not "%gemail%"=="" git config user.email "%gemail%"
if not "%gname%"=="" git config user.name "%gname%"
if "%mensaje%"=="" set mensaje=Actualizacion del proyecto

:: Obtener la rama actual del repositorio
for /f "tokens=*" %%a in ('git branch --show-current') do set RAMA_ACTUAL=%%a
if "%RAMA_ACTUAL%"=="" set RAMA_ACTUAL=develop

git add .
git commit -m "%mensaje%"

echo.
echo [!] Sobrescribiendo la rama %RAMA_ACTUAL% en GitHub (git push --force)...
git push -f origin %RAMA_ACTUAL%
goto resultado

:resultado
echo.
if !errorlevel! equ 0 (
    color 0A
    echo ========================================================
    echo   [OK] Reemplazo y subida completados exitosamente.
    echo ========================================================
) else (
    color 0C
    echo ========================================================
    echo   [X] Ocurrio un error al subir los cambios a GitHub.
    echo ========================================================
)
pause
exit /b 0

:fin
echo.
echo Opcion no valida.
pause
exit /b 1