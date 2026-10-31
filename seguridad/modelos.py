"""seguridad.modelos
===================
Inicialización del usuario administrador por defecto desde variables de entorno (.env).
"""

import os
import sqlite3

from config import cargar_env


def inicializar_usuarios(conn: sqlite3.Connection) -> None:
    """Crea un administrador por defecto si la tabla de usuarios está vacía."""
    from seguridad.autenticacion import hash_password

    cargar_env()

    cantidad = conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    if cantidad > 0:
        return

    nombre = os.environ.get("ADMIN_NOMBRE", "Administrador")
    usuario = os.environ.get("ADMIN_USUARIO", "admin")
    clave = os.environ.get("ADMIN_CLAVE", "admin123")

    conn.execute(
        "INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo, "
        "intentos_fallidos, bloqueado, nivel_bloqueo) "
        "VALUES (?, ?, ?, 'ADMIN', 1, 0, 0, 0)",
        (nombre, usuario, hash_password(clave)),
    )
