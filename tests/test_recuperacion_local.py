"""Pruebas aisladas para las operaciones locales de recuperación."""

import sqlite3
import sys
import tempfile
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from seguridad.recuperacion_local import (
    confirmacion_valida,
    crear_respaldo,
    restablecer_administrador,
    seleccionar_administrador,
    verificar_instalacion,
)
from seguridad.autenticacion import verify_password


def test_recuperar_administrador_y_forzar_cambio() -> None:
    with tempfile.TemporaryDirectory() as directorio:
        ruta_db = Path(directorio) / "tienda.db"
        with sqlite3.connect(ruta_db) as conn:
            conn.executescript(
                """
                CREATE TABLE usuarios (
                    id INTEGER PRIMARY KEY,
                    usuario TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    rol TEXT NOT NULL,
                    activo INTEGER NOT NULL DEFAULT 1,
                    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
                    bloqueado INTEGER NOT NULL DEFAULT 0,
                    tiempo_bloqueo TEXT,
                    nivel_bloqueo INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE sesiones (
                    token TEXT PRIMARY KEY,
                    usuario_id INTEGER NOT NULL
                );
                """
            )
            conn.execute(
                "INSERT INTO usuarios "
                "(id, usuario, password_hash, rol, activo, intentos_fallidos, bloqueado) "
                "VALUES (1, 'admin', 'hash-anterior', 'ADMIN', 0, 3, 1)"
            )
            conn.execute(
                "INSERT INTO sesiones (token, usuario_id) VALUES ('sesion-vieja', 1)"
            )
        conn.close()

        clave = restablecer_administrador(ruta_db, 1)
        assert clave
        with sqlite3.connect(ruta_db) as conn:
            fila = conn.execute(
                "SELECT password_hash, debe_cambiar_clave, activo, "
                "intentos_fallidos, bloqueado FROM usuarios WHERE id = 1"
            ).fetchone()
            sesiones = conn.execute("SELECT COUNT(*) FROM sesiones").fetchone()[0]
        conn.close()

        assert verify_password(clave, fila[0])
        assert fila[1:] == (1, 1, 0, 0)
        assert sesiones == 0
        assert any("Integridad SQLite: correcta." in linea
                   for linea in verificar_instalacion(ruta_db))


def test_crear_respaldo_consistente() -> None:
    with tempfile.TemporaryDirectory() as directorio:
        carpeta = Path(directorio)
        ruta_db = carpeta / "tienda.db"
        with sqlite3.connect(ruta_db) as conn:
            conn.execute("CREATE TABLE prueba (valor TEXT)")
            conn.execute("INSERT INTO prueba VALUES ('persistente')")
        conn.close()

        respaldo = crear_respaldo(ruta_db, carpeta / "copias")
        with sqlite3.connect(respaldo) as conn:
            assert conn.execute("SELECT valor FROM prueba").fetchone()[0] == "persistente"
        conn.close()


def test_seleccion_y_confirmacion_sin_distinguir_mayusculas() -> None:
    with tempfile.TemporaryDirectory() as directorio:
        ruta_db = Path(directorio) / "usuarios.db"
        with sqlite3.connect(ruta_db) as conn:
            conn.execute(
                "CREATE TABLE usuarios "
                "(id INTEGER, usuario TEXT, activo INTEGER, bloqueado INTEGER, rol TEXT)"
            )
            conn.execute(
                "INSERT INTO usuarios VALUES (1, 'admin', 1, 1, 'ADMIN')"
            )
        conn.close()

        with patch("builtins.input", return_value="admin"):
            assert seleccionar_administrador(ruta_db) == 1

    assert confirmacion_valida("SI")
    assert confirmacion_valida("si")
    assert confirmacion_valida(" Si ")
    assert not confirmacion_valida("no")


if __name__ == "__main__":
    test_recuperar_administrador_y_forzar_cambio()
    test_crear_respaldo_consistente()
    test_seleccion_y_confirmacion_sin_distinguir_mayusculas()
    print("Todas las pruebas de recuperación local pasaron.")
