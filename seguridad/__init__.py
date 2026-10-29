# seguridad/ — Módulo de seguridad y autenticación
#
# Expone:
#   from seguridad import (
#       hash_password, verify_password,
#       procesar_intento_login,
#       crear_sesion, usuario_de_token, revocar_sesion,
#       requiere_login, requiere_rol,
#       inicializar_usuarios,
#   )

from seguridad.autenticacion import (
    hash_password,
    verify_password,
    procesar_intento_login,
    crear_sesion,
    usuario_de_token,
    revocar_sesion,
    revocar_sesiones_de_usuario,
    purgar_sesiones_vencidas,
    purgar_todas_las_sesiones,
)
from seguridad.decoradores import requiere_login, requiere_rol
from seguridad.modelos import inicializar_usuarios

__all__ = [
    # Contraseñas y fuerza bruta
    "hash_password",
    "verify_password",
    "procesar_intento_login",
    # Sesiones
    "crear_sesion",
    "usuario_de_token",
    "revocar_sesion",
    "revocar_sesiones_de_usuario",
    "purgar_sesiones_vencidas",
    "purgar_todas_las_sesiones",
    # Decoradores
    "requiere_login",
    "requiere_rol",
    # Inicialización
    "inicializar_usuarios",
]
