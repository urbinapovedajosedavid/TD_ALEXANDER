"""seguridad.modelos
===================
Modelo conceptual de la tabla ``usuarios`` y rutina de inicialización.
Lee variables desde .env y crea el administrador por defecto si la base está vacía.
"""

import os
import sqlite3
import sys
from pathlib import Path


def _cargar_env() -> None:
    """Lee el archivo .env (clave=valor) y lo inyecta en os.environ."""
    if getattr(sys, "frozen", False):
        base = Path(sys.executable).resolve().parent
    else:
        base = Path(__file__).resolve().parent.parent

    ruta = base / ".env"
    if not ruta.exists() and getattr(sys, "_MEIPASS", None):
        ruta = Path(sys._MEIPASS) / ".env"

    if not ruta.exists():
        return

    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, _, valor = linea.partition("=")
            clave = clave.strip()
            valor = valor.strip()
            if clave and clave not in os.environ:
                os.environ[clave] = valor


def inicializar_usuarios(conn: sqlite3.Connection) -> None:
    """Crea un administrador por defecto si la tabla de usuarios está vacía."""
    from seguridad.autenticacion import hash_password

    _cargar_env()

    cantidad = conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    if cantidad > 0:
        return

    nombre = os.environ.get("ADMIN_NOMBRE", "Administrador")
    usuario = os.environ.get("ADMIN_USUARIO", "admin")
    clave = os.environ.get("ADMIN_CLAVE", "admin123")

    conn.execute(
        "INSERT INTO usuarios (nombre, usuario, password_hash, rol, intentos_fallidos, bloqueado, nivel_bloqueo) "
        "VALUES (?, ?, ?, 'ADMIN', 0, 0, 0)",
        (nombre, usuario, hash_password(clave)),
    )
