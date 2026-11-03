import os
import secrets
import sqlite3

from backend.config import cargar_env


def inicializar_usuarios(conn: sqlite3.Connection) -> None:
    """Crea un administrador por defecto si la tabla de usuarios está vacía."""
    from seguridad.autenticacion import hash_password

    cargar_env()

    cantidad = conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    if cantidad > 0:
        return

    nombre = os.environ.get("ADMIN_NOMBRE", "Administrador")
    usuario = os.environ.get("ADMIN_USUARIO", "admin")
    clave = os.environ.get("ADMIN_CLAVE")
    if not clave:
        clave = secrets.token_urlsafe(16)
        print(
            "Contraseña temporal del administrador (se muestra solo al crear "
            f"la base de datos): {clave}"
        )

    conn.execute(
        "INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo, "
        "intentos_fallidos, bloqueado, nivel_bloqueo, debe_cambiar_clave) "
        "VALUES (?, ?, ?, 'ADMIN', 1, 0, 0, 0, 1)",
        (nombre, usuario, hash_password(clave)),
    )
