@echo off
setlocal
title Recuperacion - Tienda Alexander

fltmc >nul 2>&1
if errorlevel 1 (
    echo Se requieren permisos de Administrador de Windows para recuperar la cuenta.
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

pushd "%~dp0.."
python seguridad\recuperacion_local.py
set "RESULTADO=%ERRORLEVEL%"
popd

echo.
pause
exit /b %RESULTADO%
