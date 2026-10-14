@echo off
chcp 65001 >nul
cls
echo ========================================================
echo   SELECCIONA EL MODO DE SUBIDA A GITHUB
echo ========================================================
echo [1] Nueva en esta PC (Configurar usuario, correo y rama)
echo [2] PC habitual (Configurar usuario, correo y subir a develop)
echo [3] Ingresar con cuenta predefinida (Seleccionar correo)
echo ========================================================
set /p opcion="Elige una opcion (1, 2 o 3): "

if "%opcion%"=="1" goto modo1
if "%opcion%"=="2" goto modo2
if "%opcion%"=="3" goto modo3
goto fin

:modo1
echo.
echo --- CONFIGURACION INICIAL ---
set /p gemail="Escribe tu correo de GitHub: "
set /p gname="Escribe tu nombre de usuario: "
set /p rama="Escribe la rama a la que deseas subir (ej: main, develop): "
git config --global user.email "%gemail%"
git config --global user.name "%gname%"
goto pedir_commit

:modo2
echo.
echo --- MODO HABITUAL ---
set /p gemail="Escribe tu correo de GitHub: "
set /p gname="Escribe tu nombre de usuario: "
git config --global user.email "%gemail%"
git config --global user.name "%gname%"
set rama=develop
goto pedir_commit

:modo3
echo.
echo ========================================================
echo   SELECCIONA EL CORREO PREDEFINIDO
echo ========================================================
echo [1] correo1@dominio.com
echo [2] correo2@dominio.com
echo [3] correo3@dominio.com
echo ========================================================
set /p correo_op="Elige una opcion (1, 2 o 3): "

if "%correo_op%"=="1" set gemail=correo1@dominio.com
if "%correo_op%"=="2" set gemail=correo2@dominio.com
if "%correo_op%"=="3" set gemail=correo3@dominio.com

if "%gemail%"=="" (
    echo Opcion de correo no valida.
    pause
    exit
)

echo.
set /p gname="Escribe tu nombre de usuario: "
:: Nota: Git no guarda contraseñas directamente por seguridad en comandos simples, 
:: pero configuramos el usuario y correo global:
git config --global user.email "%gemail%"
git config --global user.name "%gname%"

echo.
set /p rama="Escribe la rama a la que deseas ingresar/subir (ej: main, develop): "
if "%rama%"=="" set rama=develop
goto pedir_commit

:pedir_commit
echo.
echo ========================================
echo   MENSAJE PARA EL COMMIT
echo ========================================
set /p mensaje="Escribe el mensaje del commit: "
if "%mensaje%"=="" set mensaje=Actualizacion del sistema
goto ejecutar

:ejecutar
echo.
echo ========================================
echo   Iniciando subida automatica a GitHub
echo ========================================

:: Cambiar a la rama seleccionada (si no existe localmente, la crea)
git checkout %rama% 2>nul || git checkout -b %rama%

git add .
git commit -m "%mensaje%"
git push -u origin %rama%

echo ========================================
echo   ¡Proceso completado con exito!
echo ========================================
pause
exit

:fin
echo Opcion no valida.
pause