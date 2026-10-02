@echo off
chcp 65001 >nul
cls
echo ========================================================
echo   SELECCIONA EL MODO DE SUBIDA A GITHUB
echo ========================================================
echo [1] Nueva en esta PC (Configurar usuario, correo y rama)
echo [2] PC habitual (Configurar usuario, correo y subir a develop)
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
goto ejecutar

:modo2
echo.
echo --- MODO HABITUAL ---
set /p gemail="Escribe tu correo de GitHub: "
set /p gname="Escribe tu nombre de usuario: "
git config --global user.email "%gemail%"
git config --global user.name "%gname%"
set rama=develop
goto ejecutar

:ejecutar
echo.
echo ========================================
echo   Iniciando subida automatica a GitHub
echo ========================================

:: Cambiar a la rama seleccionada (si no existe localmente, la crea)
git checkout %rama% 2>nul || git checkout -b %rama%

git add .
set /p mensaje="Escribe el mensaje para el commit (o presiona Enter para usar uno por defecto): "
if "%mensaje%"=="" set mensaje="Actualizacion automatica del proyecto"

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