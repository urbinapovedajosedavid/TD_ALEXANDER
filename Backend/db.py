"""Acceso a datos de Tienda Alexander.

Concentra todo lo que antes estaba duplicado en los dos servidores Flask:
la conexión, la inicialización del esquema y el formato del hash de
contraseña. El DDL vive únicamente en database/esquema.sql.
"""

import hashlib
import hmac
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

# Rutas resueltas desde la raíz del proyecto, no desde el directorio actual,
# para que el servidor funcione igual sin importar dónde se ejecute.
RAIZ = Path(__file__).resolve().parent.parent
RUTA_ESQUEMA = RAIZ / "database" / "esquema.sql"
RUTA_DB = RAIZ / "database" / "tienda_alexander.db"

# Semilla de arranque
USUARIO_ADMIN = ("Administrador", "admin", "admin123", "ADMIN")
CATEGORIAS_INICIALES = ("Electrodomésticos", "Electrónica", "Alimentos")

# Una sesión dura una jornada de trabajo.
DURACION_SESION_HORAS = 8

FORMATO_FECHA = "%Y-%m-%d %H:%M:%S"


# ---------- Fechas ----------

def ahora() -> str:
    """Marca de tiempo local en el formato que usa SQLite.

    Importante: CURRENT_TIMESTAMP de SQLite devuelve SIEMPRE UTC, mientras
    que un local de Nicaragua va seis horas por detrás. Si una venta se
    guardara con CURRENT_TIMESTAMP y los reportes calcularan su corte con
    datetime.now(), las ventas de la tarde aparecerían como del día
    siguiente. Por eso el servidor escribe siempre la hora local explícita
    y nunca deja que SQLite la ponga por su cuenta.
    """
    return datetime.now().strftime(FORMATO_FECHA)


# ---------- Contraseñas ----------

def hash_password(clave: str) -> str:
    """PBKDF2-SHA256 con sal aleatoria. Formato: pbkdf2$<sal>$<hash>."""
    sal = os.urandom(16)
    derivada = hashlib.pbkdf2_hmac("sha256", clave.encode(), sal, 200_000)
    return f"pbkdf2${sal.hex()}${derivada.hex()}"


def verify_password(clave: str, almacenado: str) -> bool:
    """Compara la clave en texto plano contra un hash generado por hash_password."""
    if not almacenado or not almacenado.startswith("pbkdf2$"):
        return False
    _, sal_hex, esperado_hex = almacenado.split("$", 2)
    derivada = hashlib.pbkdf2_hmac(
        "sha256", clave.encode(), bytes.fromhex(sal_hex), 200_000
    )
    return hmac.compare_digest(derivada.hex(), esperado_hex)


# ---------- Sesiones ----------

def crear_sesion(conn: sqlite3.Connection, usuario_id: int) -> str:
    """Abre una sesión y devuelve el token opaco que se envía al cliente."""
    token = secrets.token_urlsafe(32)
    expira = datetime.now() + timedelta(hours=DURACION_SESION_HORAS)
    conn.execute(
        "INSERT INTO sesiones (token, usuario_id, creado_en, expira_en) "
        "VALUES (?, ?, ?, ?)",
        (token, usuario_id, ahora(), expira.strftime(FORMATO_FECHA)),
    )
    return token


def usuario_de_token(conn: sqlite3.Connection, token: str):
    """Fila del usuario si el token es válido y no ha vencido; si no, None."""
    if not token:
        return None
    return conn.execute(
        "SELECT u.id, u.nombre, u.usuario, u.rol FROM sesiones s "
        "JOIN usuarios u ON u.id = s.usuario_id "
        "WHERE s.token = ? AND s.expira_en > ?",
        (token, ahora()),
    ).fetchone()


def revocar_sesion(conn: sqlite3.Connection, token: str) -> None:
    conn.execute("DELETE FROM sesiones WHERE token = ?", (token,))


def revocar_sesiones_de_usuario(conn: sqlite3.Connection, usuario_id: int) -> None:
    """Cierra todas las sesiones abiertas de un usuario (tras cambiar la clave)."""
    conn.execute("DELETE FROM sesiones WHERE usuario_id = ?", (usuario_id,))


def purgar_sesiones_vencidas(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM sesiones WHERE expira_en <= ?", (ahora(),))


def purgar_todas_las_sesiones() -> None:
    """Cierra todas las sesiones abiertas.

    Se usa al restaurar un respaldo: los tokens estaban en la base que se
    acaba de reemplazar, así que pueden apuntar a usuarios que ya no existen.
    """
    with conectar_db() as conn:
        conn.execute("DELETE FROM sesiones")


# ---------- Conexión ----------

@contextmanager
def conectar_db():
    """Entrega una conexión con foreign_keys activo.

    Confirma el bloque al salir sin excepción y lo revierte si algo falla,
    de modo que quien lo usa no tiene que acordarse del commit.
    """
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


# ---------- Inicialización ----------

def inicializar_db():
    """Crea el archivo y las tablas a partir de database/esquema.sql."""
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    sql = RUTA_ESQUEMA.read_text(encoding="utf-8")

    conn = sqlite3.connect(RUTA_DB)
    try:
        conn.executescript(sql)
        conn.commit()
        _sembrar(conn)
        conn.commit()
    finally:
        conn.close()


def _sembrar(conn: sqlite3.Connection):
    """Inserta los datos mínimos la primera vez, sin duplicarlos después."""
    cur = conn.cursor()

    if cur.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0] == 0:
        nombre, usuario, clave, rol = USUARIO_ADMIN
        cur.execute(
            "INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, ?)",
            (nombre, usuario, hash_password(clave), rol),
        )

    if cur.execute("SELECT COUNT(*) FROM categorias").fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO categorias (nombre) VALUES (?)",
            [(c,) for c in CATEGORIAS_INICIALES],
        )
