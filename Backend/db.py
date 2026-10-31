"""Backend.db
============
Capa de acceso a la base de datos SQLite, migraciones automáticas y persistencia.
Compatible con entornos de desarrollo, pruebas aisladas y ejecutables (.exe).
"""

import os
import sqlite3
import sys
from contextlib import contextmanager
from pathlib import Path

RAIZ_PROYECTO = Path(__file__).resolve().parent.parent
if str(RAIZ_PROYECTO) not in sys.path:
    sys.path.insert(0, str(RAIZ_PROYECTO))
if str(RAIZ_PROYECTO / "Backend") not in sys.path:
    sys.path.insert(0, str(RAIZ_PROYECTO / "Backend"))

from config import FORMATO_FECHA, RAIZ_ACTUAL, RAIZ_RECURSOS, ahora  # noqa: E402
from seguridad.modelos import inicializar_usuarios  # noqa: E402

# Esquema DDL: buscar en recursos empaquetados o en la carpeta database
RUTA_ESQUEMA = RAIZ_RECURSOS / "database" / "esquema.sql"
if not RUTA_ESQUEMA.exists():
    RUTA_ESQUEMA = RAIZ_ACTUAL / "database" / "esquema.sql"

# Base de datos SQLite (permite override mediante TIENDA_DB_PATH para tests aislados)
RUTA_DB = Path(
    os.environ.get("TIENDA_DB_PATH")
    or (RAIZ_ACTUAL / "database" / "tienda_alexander.db")
)

CATEGORIAS_INICIALES = ("Electrodomésticos", "Electrónica", "Alimentos")


@contextmanager
def conectar_db():
    """Entrega una conexión SQLite transaccional con foreign_keys activo."""
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


def purgar_todas_las_sesiones() -> None:
    """Cierra todas las sesiones abiertas en la base de datos."""
    with conectar_db() as conn:
        from seguridad.autenticacion import purgar_todas_las_sesiones as _purgar
        _purgar(conn)


def inicializar_db():
    """Crea la base de datos, aplica migraciones de esquema y siembra datos iniciales."""
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    sql = RUTA_ESQUEMA.read_text(encoding="utf-8")

    conn = sqlite3.connect(RUTA_DB)
    try:
        # 1. Si la base ya existía con esquema antiguo, migrar tablas ANTES de crear índices nuevos
        _migrar_usuarios(conn)
        _migrar_productos(conn)
        _migrar_ventas(conn)
        _migrar_detalle_ventas(conn)
        conn.commit()

        # 2. Ejecutar esquema DDL completo (tablas nuevas e índices)
        conn.executescript(sql)
        conn.commit()

        # 3. Sembrar datos iniciales si está vacía
        _sembrar(conn)
        conn.commit()
    finally:
        conn.close()


def _migrar_usuarios(conn: sqlite3.Connection) -> None:
    """Garantiza que la tabla usuarios tenga todas las columnas de perfil, estado y bloqueo."""
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
    if "activo" not in columnas:
        conn.execute("ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1")


def _migrar_productos(conn: sqlite3.Connection) -> None:
    """Elimina el tope artificial de stock <= 64 en bases antiguas y añade costo_entrada y proveedor_id."""
    fila_sql = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'productos'"
    ).fetchone()
    if not fila_sql or not fila_sql[0]:
        return

    definicion_sql = fila_sql[0]
    columnas = {f[1] for f in conn.execute("PRAGMA table_info(productos)")}

    # Si la tabla antigua tiene el CHECK (stock <= 64), reconstruirla sin ese límite
    if "64" in definicion_sql:
        tiene_costo = "costo_entrada" in columnas
        tiene_prov = "proveedor_id" in columnas
        expr_costo = "COALESCE(costo_entrada, 0.0)" if tiene_costo else "0.0"
        expr_prov = "proveedor_id" if tiene_prov else "NULL"

        conn.execute("PRAGMA foreign_keys = OFF")
        try:
            conn.executescript(
                f"""
                CREATE TABLE productos_nueva (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    codigo_barra  TEXT UNIQUE,
                    nombre        TEXT NOT NULL,
                    categoria_id  INTEGER REFERENCES categorias (id) ON DELETE SET NULL,
                    proveedor_id  INTEGER REFERENCES proveedores (id) ON DELETE SET NULL,
                    precio        REAL NOT NULL CHECK (precio >= 0),
                    costo_entrada REAL NOT NULL DEFAULT 0.0 CHECK (costo_entrada >= 0),
                    stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
                );

                INSERT INTO productos_nueva
                    (id, codigo_barra, nombre, categoria_id, proveedor_id, precio, costo_entrada, stock)
                SELECT id, codigo_barra, nombre, categoria_id, {expr_prov}, precio, {expr_costo},
                       CASE WHEN stock < 0 THEN 0 ELSE stock END
                FROM productos;

                DROP TABLE productos;
                ALTER TABLE productos_nueva RENAME TO productos;

                CREATE INDEX IF NOT EXISTS idx_productos_cat  ON productos (categoria_id);
                CREATE INDEX IF NOT EXISTS idx_productos_prov ON productos (proveedor_id);
                """
            )
            tiene_seq = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'"
            ).fetchone()
            if tiene_seq:
                conn.execute(
                    "UPDATE sqlite_sequence SET seq = "
                    "(SELECT COALESCE(MAX(id), 0) FROM productos) "
                    "WHERE name = 'productos'"
                )
        finally:
            conn.execute("PRAGMA foreign_keys = ON")
        return

    if "costo_entrada" not in columnas:
        conn.execute(
            "ALTER TABLE productos ADD COLUMN costo_entrada REAL NOT NULL DEFAULT 0.0"
        )
    if "proveedor_id" not in columnas:
        conn.execute(
            "ALTER TABLE productos ADD COLUMN proveedor_id INTEGER REFERENCES proveedores (id) ON DELETE SET NULL"
        )


def _migrar_ventas(conn: sqlite3.Connection) -> None:
    """Añade subtotal, impuesto, efectivo_recibido, vuelto y estado a ventas históricas."""
    columnas = {f[1] for f in conn.execute("PRAGMA table_info(ventas)")}
    if not columnas:
        return

    if "subtotal" not in columnas:
        conn.execute("ALTER TABLE ventas ADD COLUMN subtotal REAL NOT NULL DEFAULT 0.0")
    if "impuesto" not in columnas:
        conn.execute("ALTER TABLE ventas ADD COLUMN impuesto REAL NOT NULL DEFAULT 0.0")
    if "efectivo_recibido" not in columnas:
        conn.execute("ALTER TABLE ventas ADD COLUMN efectivo_recibido REAL DEFAULT NULL")
    if "vuelto" not in columnas:
        conn.execute("ALTER TABLE ventas ADD COLUMN vuelto REAL DEFAULT NULL")
    if "estado" not in columnas:
        conn.execute("ALTER TABLE ventas ADD COLUMN estado TEXT NOT NULL DEFAULT 'COMPLETADA'")

    conn.execute(
        """
        UPDATE ventas
        SET subtotal = ROUND(total / 1.15, 2),
            impuesto = ROUND(total - ROUND(total / 1.15, 2), 2)
        WHERE subtotal = 0 AND total > 0
        """
    )


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
        tiene_seq = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'"
        ).fetchone()
        if tiene_seq:
            conn.execute(
                "UPDATE sqlite_sequence SET seq = "
                "(SELECT COALESCE(MAX(id), 0) FROM detalle_ventas) "
                "WHERE name = 'detalle_ventas'"
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
