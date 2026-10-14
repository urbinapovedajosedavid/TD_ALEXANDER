#!/bin/bash

clear
echo "======================================================="
echo "   SELECCIONA EL MODO DE SUBIDA A GITHUB"
echo "======================================================="
echo "[1] Nueva en esta PC (Configurar usuario, correo y rama)"
echo "[2] PC habitual (Configurar usuario, correo y subir a develop)"
echo "[3] Ingresar con cuenta predefinida (Seleccionar correo)"
echo "======================================================="
read -p "Elige una opcion (1, 2 o 3): " opcion

case $opcion in
    1)
        echo ""
        echo "--- CONFIGURACION INICIAL ---"
        read -p "Escribe tu correo de GitHub: " gemail
        read -p "Escribe tu nombre de usuario: " gname
        read -p "Escribe la rama a la que deseas subir (ej: main, develop): " rama
        git config --global user.email "$gemail"
        git config --global user.name "$gname"
        ;;
    2)
        echo ""
        echo "--- MODO HABITUAL ---"
        read -p "Escribe tu correo de GitHub: " gemail
        read -p "Escribe tu nombre de usuario: " gname
        git config --global user.email "$gemail"
        git config --global user.name "$gname"
        rama="develop"
        ;;
    3)
        echo ""
        echo "======================================================="
        echo "   SELECCIONA EL CORREO PREDEFINIDO"
        echo "======================================================="
        echo "[1] correo1@dominio.com"
        echo "[2] correo2@dominio.com"
        echo "[3] correo3@dominio.com"
        echo "======================================================="
        read -p "Elige una opcion (1, 2 o 3): " correo_op

        if [ "$correo_op" = "1" ]; then
            gemail="correo1@dominio.com"
        elif [ "$correo_op" = "2" ]; then
            gemail="correo2@dominio.com"
        elif [ "$correo_op" = "3" ]; then
            gemail="correo3@dominio.com"
        else
            echo "Opcion de correo no valida."
            exit 1
        fi

        echo ""
        read -p "Escribe tu nombre de usuario: " gname
        git config --global user.email "$gemail"
        git config --global user.name "$gname"

        echo ""
        read -p "Escribe la rama a la que deseas ingresar/subir (ej: main, develop): " rama
        if [ -z "$rama" ]; then
            rama="develop"
        fi
        ;;
    *)
        echo "Opcion no valida."
        exit 1
        ;;
esac

echo ""
echo "========================================"
echo "   MENSAJE PARA EL COMMIT"
echo "========================================"
read -p "Escribe el mensaje del commit (deja vacio por defecto): " mensaje
if [ -z "$mensaje" ]; then
    mensaje="Actualizacion del sistema"
fi

echo ""
echo "========================================"
echo "   Iniciando subida automatica a GitHub"
echo "========================================"

# Cambiar a la rama seleccionada (si no existe localmente, la crea)
git checkout "$rama" 2>/dev/null || git checkout -b "$rama"

git add .
git commit -m "$mensaje"
git push -u origin "$rama"

echo "========================================"
echo "   ¡Proceso completado con exito!"
echo "========================================"
