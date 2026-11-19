import os
import secrets
import sqlite3

from backend.config import cargar_env


def inicializar_usuarios(conn: sqlite3.Connection) -> None:
    from seguridad.autenticacion import hash_password

    cargar_env()

    nombre = os.environ.get("ADMIN_NOMBRE", "Administrador")
    usuario = os.environ.get("ADMIN_USUARIO", "admin")
    clave = os.environ.get("ADMIN_CLAVE")

    cantidad = conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    if cantidad > 0:
        admin_pendiente = conn.execute(
            "SELECT id FROM usuarios WHERE usuario = ? COLLATE NOCASE AND rol = 'ADMIN' AND debe_cambiar_clave = 1",
            (usuario,),
        ).fetchone()
        if admin_pendiente and not clave:
            nueva_temporal = secrets.token_urlsafe(12)
            conn.execute(
                "UPDATE usuarios SET password_hash = ?, intentos_fallidos = 0, bloqueado = 0, tiempo_bloqueo = NULL, nivel_bloqueo = 0 WHERE id = ?",
                (hash_password(nueva_temporal), admin_pendiente[0]),
            )
            print(
                f"\n * Usuario administrador : {usuario}\n"
                f" * Contraseña temporal   : {nueva_temporal}"
            )
        return

    if not clave:
        clave = secrets.token_urlsafe(12)
        print(
            f"\n * Usuario administrador : {usuario}\n"
            f" * Contraseña temporal   : {clave}"
        )

    conn.execute(
        "INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo, "
        "intentos_fallidos, bloqueado, nivel_bloqueo, debe_cambiar_clave) "
        "VALUES (?, ?, ?, 'ADMIN', 1, 0, 0, 0, 1)",
        (nombre, usuario, hash_password(clave)),
    )
