@echo off
chcp 65001 >nul
cls
echo ========================================================
echo   SELECCIONA EL MODO DE SUBIDA A GITHUB
echo ========================================================
echo [1] Nueva en esta PC (Configurar usuario, correo y rama)
echo [2] PC habitual (Configurar usuario, correo y elegir rama)
echo ========================================================
set /p opcion="Elige una opcion (1 o 2): "

if "%opcion%"=="1" goto modo1
if "%opcion%"=="2" goto modo2
goto fin

:modo1
echo.
echo --- CONFIGURACION INICIAL ---
set /p gemail="Escribe tu correo de GitHub: "
set /p gname="Escribe tu nombre de usuario: "
set /p rama="Escribe la rama a la que deseas subir (ej: main, develop): "
git config --global user.email "%gemail%"
git config --global user.name "%gname%"
goto preguntar_tipo

:modo2
echo.
echo --- MODO HABITUAL ---
set /p gemail="Escribe tu correo de GitHub: "
set /p gname="Escribe tu nombre de usuario: "
set /p rama="Escribe la rama a la que deseas subir (ej: main, develop): "
git config --global user.email "%gemail%"
git config --global user.name "%gname%"
goto preguntar_tipo

:preguntar_tipo
echo.
echo ========================================================
echo   ¿QUE DESEAS SUBIR?
echo ========================================================
echo [1] Sustituir solo los cambios que hiciste ahorita
echo [2] Subir todo el repositorio actual (forzar actualizacion completa)
echo ========================================================
set /p tipo="Elige una opcion (1 o 2): "

if "%tipo%"=="1" goto ejecutar_cambios
if "%tipo%"=="2" goto ejecutar_todo
goto fin

:ejecutar_cambios
echo.
echo ========================================
echo   Iniciando subida de cambios recientes...
echo ========================================
git checkout %rama% 2>nul || git checkout -b %rama%
git add .
set /p mensaje="Escribe el mensaje para el commit (o presiona Enter): "
if "%mensaje%"=="" set mensaje="Actualizacion de cambios recientes"
git commit -m "%mensaje%"
git push -u origin %rama%
goto fin_exito

:ejecutar_todo
echo.
echo ========================================
echo   Iniciando subida forzada de todo el repositorio...
echo ========================================
git checkout %rama% 2>nul || git checkout -b %rama%
git add -A
set /p mensaje="Escribe el mensaje para el commit (o presiona Enter): "
if "%mensaje%"=="" set mensaje="Actualizacion completa de todo el repositorio"
git commit -m "%mensaje%"
git push -u origin %rama% --force
goto fin_exito

:fin_exito
echo.
echo ========================================
echo   ¡Proceso completado con exito!
echo ========================================
pause
exit

:fin
echo.
echo Opcion no valida.
pause