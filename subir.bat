@echo off
echo ========================================
echo   Iniciando subida automatica a GitHub
echo ========================================

git add .
set /p mensaje="Escribe el mensaje para el commit (o presiona Enter para usar uno por defecto): "
if "%mensaje%"=="" set mensaje="Actualizacion automatica del proyecto"

git commit -m "%mensaje%"
git push -u origin main

echo ========================================
echo   ¡Proceso completado con exito!
echo ========================================
pause 