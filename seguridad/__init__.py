"""seguridad — Módulo de seguridad y autenticación."""

from seguridad.autenticacion import (
    crear_sesion,
    hash_password,
    procesar_intento_login,
    purgar_sesiones_vencidas,
    purgar_todas_las_sesiones,
    revocar_sesion,
    revocar_sesiones_de_usuario,
    usuario_de_token,
    verify_password,
)
from seguridad.decoradores import obtener_token_actual, requiere_login, requiere_rol
from seguridad.modelos import inicializar_usuarios

__all__ = [
    "hash_password",
    "verify_password",
    "procesar_intento_login",
    "crear_sesion",
    "usuario_de_token",
    "revocar_sesion",
    "revocar_sesiones_de_usuario",
    "purgar_sesiones_vencidas",
    "purgar_todas_las_sesiones",
    "obtener_token_actual",
    "requiere_login",
    "requiere_rol",
    "inicializar_usuarios",
]
