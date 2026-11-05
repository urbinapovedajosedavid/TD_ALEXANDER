"""Capa de conexión e inicialización de la base de datos SQLite."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from backend.config import RAIZ_ACTUAL
from seguridad.modelos import inicializar_usuarios

RUTA_ESQUEMA = RAIZ_ACTUAL / "database" / "esquema.sql"
RUTA_DB = Path(
    os.environ.get("TIENDA_DB_PATH")
    or (RAIZ_ACTUAL / "database" / "tienda_alexander.db")
)

CATEGORIAS_INICIALES = ("Electrodomésticos", "Electrónica", "Alimentos")


@contextmanager
def conectar_db():
    """Entrega una conexión SQLite transaccional con claves foráneas y modo WAL activos."""
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(RUTA_DB, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def purgar_todas_las_sesiones() -> None:
    """Cierra todas las sesiones activas en la base de datos."""
    with conectar_db() as conn:
        from seguridad.autenticacion import purgar_todas_las_sesiones as _purgar
        _purgar(conn)


def inicializar_db() -> None:
    """Crea las tablas e índices del esquema y siembra los datos iniciales si está vacía."""
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    sql = RUTA_ESQUEMA.read_text(encoding="utf-8")

    conn = sqlite3.connect(RUTA_DB, timeout=10.0)
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.executescript(sql)
        _sembrar(conn)
        conn.commit()
    finally:
        conn.close()


def _sembrar(conn: sqlite3.Connection) -> None:
    """Inserta el administrador por defecto y las categorías iniciales."""
    cur = conn.cursor()
    inicializar_usuarios(conn)

    if cur.execute("SELECT COUNT(*) FROM categorias").fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO categorias (nombre) VALUES (?)",
            [(c,) for c in CATEGORIAS_INICIALES],
        )
