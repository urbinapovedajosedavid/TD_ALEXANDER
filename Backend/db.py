"""Backend.db
============
Capa de acceso a la base de datos SQLite y persistencia del sistema.
Compatible con entornos de desarrollo y ejecutables empaquetados (.exe).
"""

import os
import sqlite3
import sys
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

# Detección de entorno empaquetado (PyInstaller) vs desarrollo
if getattr(sys, "frozen", False):
    RAIZ_ACTUAL = Path(sys.executable).resolve().parent
    RAIZ_RECURSOS = Path(getattr(sys, "_MEIPASS", RAIZ_ACTUAL))
else:
    RAIZ_ACTUAL = Path(__file__).resolve().parent.parent
    RAIZ_RECURSOS = RAIZ_ACTUAL

if str(RAIZ_ACTUAL) not in sys.path:
    sys.path.insert(0, str(RAIZ_ACTUAL))
if str(RAIZ_RECURSOS) not in sys.path:
    sys.path.insert(0, str(RAIZ_RECURSOS))

from seguridad.autenticacion import (  # noqa: E402
    hash_password,
    verify_password,
    crear_sesion,
    usuario_de_token,
    revocar_sesion,
    revocar_sesiones_de_usuario,
    purgar_sesiones_vencidas,
)
from seguridad.modelos import inicializar_usuarios  # noqa: E402

# Esquema DDL: buscar en recursos empaquetados o en la carpeta database
RUTA_ESQUEMA = RAIZ_RECURSOS / "database" / "esquema.sql"
if not RUTA_ESQUEMA.exists():
    RUTA_ESQUEMA = RAIZ_ACTUAL / "database" / "esquema.sql"

# Base de datos SQLite: siempre junto al ejecutable/proyecto para que los datos persistan
RUTA_DB = RAIZ_ACTUAL / "database" / "tienda_alexander.db"

CATEGORIAS_INICIALES = ("Electrodomésticos", "Electrónica", "Alimentos")
FORMATO_FECHA = "%Y-%m-%d %H:%M:%S"


# ---------- Fechas ----------

def ahora() -> str:
    """Marca de tiempo local en el formato estándar de SQLite."""
    return datetime.now().strftime(FORMATO_FECHA)


# ---------- Conexión ----------

@contextmanager
def conectar_db():
    """Entrega una conexión con foreign_keys activo."""
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(RUTA_DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- Purga global de sesiones ----------

def purgar_todas_las_sesiones() -> None:
    """Cierra todas las sesiones abiertas."""
    with conectar_db() as conn:
        from seguridad.autenticacion import purgar_todas_las_sesiones as _purgar
        _purgar(conn)


# ---------- Inicialización ----------

def inicializar_db():
    """Crea el archivo y las tablas a partir de database/esquema.sql si no existen."""
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    sql = RUTA_ESQUEMA.read_text(encoding="utf-8")

    conn = sqlite3.connect(RUTA_DB)
    try:
        conn.executescript(sql)
        conn.commit()
        _migrar_detalle_ventas(conn)
        _migrar_usuarios_bloqueo(conn)
        conn.commit()
        _sembrar(conn)
        conn.commit()
    finally:
        conn.close()


def _migrar_usuarios_bloqueo(conn: sqlite3.Connection) -> None:
    """Añade columnas de control de intentos fallidos, bloqueo y datos de perfil."""
    columnas = {f[1] for f in conn.execute("PRAGMA table_info(usuarios)")}
    if not columnas:
        return
    if "intentos_fallidos" not in columnas:
        conn.execute("ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER NOT NULL DEFAULT 0")
    if "bloqueado" not in columnas:
        conn.execute("ALTER TABLE usuarios ADD COLUMN bloqueado INTEGER NOT NULL DEFAULT 0")
    if "tiempo_bloqueo" not in columnas:
        conn.execute("ALTER TABLE usuarios ADD COLUMN tiempo_bloqueo DATETIME DEFAULT NULL")
    if "nivel_bloqueo" not in columnas:
        conn.execute("ALTER TABLE usuarios ADD COLUMN nivel_bloqueo INTEGER NOT NULL DEFAULT 0")
    if "apellido" not in columnas:
        conn.execute("ALTER TABLE usuarios ADD COLUMN apellido TEXT NOT NULL DEFAULT ''")
    if "telefono" not in columnas:
        conn.execute("ALTER TABLE usuarios ADD COLUMN telefono TEXT NOT NULL DEFAULT ''")


def _migrar_detalle_ventas(conn: sqlite3.Connection) -> None:
    """Rehace detalle_ventas en bases viejas para borrado en cascada seguro."""
    columnas = {f[1] for f in conn.execute("PRAGMA table_info(detalle_ventas)")}
    if not columnas or "nombre_producto" in columnas:
        return

    conn.execute("PRAGMA foreign_keys = OFF")
    try:
        conn.executescript(
            """
            CREATE TABLE detalle_ventas_nueva (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id         INTEGER NOT NULL REFERENCES ventas (id) ON DELETE CASCADE,
                producto_id      INTEGER REFERENCES productos (id) ON DELETE SET NULL,
                nombre_producto  TEXT NOT NULL DEFAULT '',
                cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
                precio_unitario  REAL NOT NULL CHECK (precio_unitario >= 0),
                subtotal         REAL GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
            );

            INSERT INTO detalle_ventas_nueva
                (id, venta_id, producto_id, nombre_producto, cantidad, precio_unitario)
            SELECT d.id, d.venta_id, d.producto_id,
                   COALESCE(p.nombre, 'Producto eliminado'),
                   d.cantidad, d.precio_unitario
            FROM detalle_ventas d
            LEFT JOIN productos p ON p.id = d.producto_id;

            DROP TABLE detalle_ventas;
            ALTER TABLE detalle_ventas_nueva RENAME TO detalle_ventas;

            CREATE INDEX IF NOT EXISTS idx_detalle_venta    ON detalle_ventas (venta_id);
            CREATE INDEX IF NOT EXISTS idx_detalle_producto ON detalle_ventas (producto_id);
            """
        )
        conn.execute(
            "UPDATE sqlite_sequence SET seq = "
            "(SELECT COALESCE(MAX(id), 0) FROM detalle_ventas) "
            "WHERE name = 'detalle_ventas'"
        )

        problemas = conn.execute("PRAGMA foreign_key_check").fetchall()
        if problemas:
            raise RuntimeError(
                "La migración de detalle_ventas dejó referencias rotas: "
                + "; ".join(str(p) for p in problemas)
            )
    finally:
        conn.execute("PRAGMA foreign_keys = ON")


def _sembrar(conn: sqlite3.Connection):
    """Inserta el administrador por defecto y categorías mínimas."""
    cur = conn.cursor()
    inicializar_usuarios(conn)

    if cur.execute("SELECT COUNT(*) FROM categorias").fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO categorias (nombre) VALUES (?)",
            [(c,) for c in CATEGORIAS_INICIALES],
        )
