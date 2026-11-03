"""Herramienta de recuperación local de cuentas para Windows."""

import ctypes
import secrets
import sqlite3
import subprocess
import sys
from collections.abc import Generator
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from werkzeug.security import generate_password_hash

RAIZ_PROYECTO = Path(__file__).resolve().parent.parent
RUTA_DB = RAIZ_PROYECTO / "database" / "tienda_alexander.db"


@contextmanager
def _conectar(ruta_db: Path) -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(ruta_db)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def _columnas_usuario(conn: sqlite3.Connection) -> set[str]:
    return {
        str(fila["name"])
        for fila in conn.execute("PRAGMA table_info(usuarios)").fetchall()
    }


def restablecer_administrador(ruta_db: Path, id_usuario: int) -> str:
    """Genera una clave temporal, desbloquea el administrador y revoca sus sesiones."""
    clave_temporal = secrets.token_urlsafe(18)
    with _conectar(ruta_db) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        columnas = _columnas_usuario(conn)
        if not columnas:
            raise RuntimeError("La base de datos no contiene la tabla usuarios.")

        if "debe_cambiar_clave" not in columnas:
            conn.execute(
                "ALTER TABLE usuarios ADD COLUMN debe_cambiar_clave "
                "INTEGER NOT NULL DEFAULT 0"
            )
            columnas.add("debe_cambiar_clave")

        administrador = conn.execute(
            "SELECT id FROM usuarios WHERE id = ? AND rol = 'ADMIN'",
            (id_usuario,),
        ).fetchone()
        if administrador is None:
            raise ValueError("El identificador no corresponde a una cuenta ADMIN.")

        actualizaciones = [
            "password_hash = ?",
            "debe_cambiar_clave = 1",
        ]
        parametros: list[object] = [
            generate_password_hash(
                clave_temporal,
                method="pbkdf2:sha256",
                salt_length=16,
            )
        ]
        for columna, valor in (
            ("activo", 1),
            ("intentos_fallidos", 0),
            ("bloqueado", 0),
            ("tiempo_bloqueo", None),
            ("nivel_bloqueo", 0),
        ):
            if columna in columnas:
                actualizaciones.append(f"{columna} = ?")
                parametros.append(valor)
        parametros.append(id_usuario)
        conn.execute(
            f"UPDATE usuarios SET {', '.join(actualizaciones)} WHERE id = ?",
            parametros,
        )

        if conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sesiones'"
        ).fetchone():
            conn.execute("DELETE FROM sesiones WHERE usuario_id = ?", (id_usuario,))

    return clave_temporal


def verificar_instalacion(ruta_db: Path) -> list[str]:
    """Comprueba integridad y estado básico sin mostrar contraseñas ni datos privados."""
    if not ruta_db.is_file():
        return [f"No se encontró la base de datos: {ruta_db}"]

    with _conectar(ruta_db) as conn:
        integridad = conn.execute("PRAGMA integrity_check").fetchone()
        if integridad is None or integridad[0] != "ok":
            raise RuntimeError(f"Falló la comprobación de integridad: {integridad}")

        tablas = {
            str(fila[0])
            for fila in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        if "usuarios" not in tablas:
            return ["ERROR: no existe la tabla usuarios."]

        admins = conn.execute(
            "SELECT COUNT(*) FROM usuarios WHERE rol = 'ADMIN'"
        ).fetchone()
        admins_activos = conn.execute(
            "SELECT COUNT(*) FROM usuarios "
            "WHERE rol = 'ADMIN' AND COALESCE(activo, 1) = 1"
        ).fetchone()
        bloqueados = conn.execute(
            "SELECT COUNT(*) FROM usuarios "
            "WHERE rol = 'ADMIN' AND COALESCE(bloqueado, 0) = 1"
        ).fetchone()
        sesiones = (
            conn.execute("SELECT COUNT(*) FROM sesiones").fetchone()
            if "sesiones" in tablas
            else (0,)
        )

    return [
        "Integridad SQLite: correcta.",
        f"Cuentas ADMIN registradas: {admins[0]}.",
        f"Cuentas ADMIN activas: {admins_activos[0]}.",
        f"Cuentas ADMIN con bloqueo marcado: {bloqueados[0]}.",
        f"Sesiones activas almacenadas: {sesiones[0]}.",
    ]


def crear_respaldo(ruta_db: Path, carpeta_respaldo: Path) -> Path:
    """Crea una copia consistente de SQLite usando la API de respaldo integrada."""
    if not ruta_db.is_file():
        raise FileNotFoundError(f"No se encontró la base de datos: {ruta_db}")

    carpeta_respaldo.mkdir(parents=True, exist_ok=True)
    marca = datetime.now().strftime("%Y%m%d_%H%M%S")
    destino = carpeta_respaldo / f"tienda_alexander_{marca}.db"
    contador = 1
    while destino.exists():
        destino = carpeta_respaldo / f"tienda_alexander_{marca}_{contador}.db"
        contador += 1

    origen = sqlite3.connect(ruta_db)
    try:
        copia = sqlite3.connect(destino)
        try:
            origen.backup(copia)
        finally:
            copia.close()
    finally:
        origen.close()
    return destino


def _requiere_administrador_windows() -> bool:
    return sys.platform == "win32" and bool(ctypes.windll.shell32.IsUserAnAdmin())


def _limpiar_pantalla() -> None:
    comando = ["cmd", "/c", "cls"] if sys.platform == "win32" else ["clear"]
    subprocess.run(comando, check=False)


def confirmacion_valida(respuesta: str) -> bool:
    return respuesta.strip().casefold() == "si"


def seleccionar_administrador(ruta_db: Path) -> int | None:
    with _conectar(ruta_db) as conn:
        filas = conn.execute(
            "SELECT id, usuario, COALESCE(activo, 1), COALESCE(bloqueado, 0) "
            "FROM usuarios WHERE rol = 'ADMIN' ORDER BY id"
        ).fetchall()

    if not filas:
        print("No hay cuentas ADMIN en la base de datos.")
        return None

    print("\nCuentas de administrador:")
    for fila in filas:
        estado = "activa" if fila[2] else "inactiva"
        if fila[3]:
            estado += ", bloqueo marcado"
        print(f"  {fila[0]}) {fila[1]} ({estado})")

    seleccion = input(
        "\nEscribe el número o nombre de usuario de la cuenta que deseas recuperar: "
    ).strip()
    try:
        id_usuario = int(seleccion)
    except ValueError:
        usuario_buscado = seleccion.casefold()
        coincidencias = [
            fila for fila in filas
            if str(fila[1]).casefold() == usuario_buscado
        ]
        if not coincidencias:
            print("\nNo se encontró una cuenta ADMIN con ese nombre de usuario.")
            return None
        return int(coincidencias[0][0])

    if any(int(fila[0]) == id_usuario for fila in filas):
        return id_usuario
    print("\nNo se encontró una cuenta ADMIN con ese identificador.")
    return None


def _menu() -> int:
    _limpiar_pantalla()
    if not _requiere_administrador_windows():
        print("ERROR: ejecuta este archivo desde el BAT elevado como Administrador.")
        return 1
    if not RUTA_DB.is_file():
        print(f"ERROR: no se encontró la base de datos: {RUTA_DB}")
        return 1

    while True:
        _limpiar_pantalla()
        print(
            "=== Recuperación local - Tienda Alexander ===\n\n"
            "1) Generar contraseña temporal y desbloquear administrador\n"
            "2) Verificación de pasos e integridad\n"
            "3) Crear copia de seguridad\n"
            "4) Salir\n"
        )
        opcion = input("Selecciona una opción: ").strip()
        _limpiar_pantalla()

        try:
            if opcion == "1":
                id_usuario = seleccionar_administrador(RUTA_DB)
                if id_usuario is not None:
                    print()
                    confirmado = input(
                        "Esto revocará las sesiones de la cuenta y exigirá cambiar "
                        "la clave temporal.\nEscribe SI para continuar: "
                    ).strip()
                    if not confirmacion_valida(confirmado):
                        print("\nOperación cancelada.")
                    else:
                        print()
                        clave = restablecer_administrador(RUTA_DB, id_usuario)
                        print("Clave temporal (se muestra solo esta vez):\n")
                        print(f"  {clave}\n")
                        print(
                            "Inicia sesión con el nombre de usuario seleccionado y esta clave.\n"
                            "El sistema exigirá definir y confirmar una nueva contraseña."
                        )
            elif opcion == "2":
                print("=== Verificación de pasos e integridad ===\n")
                for paso in verificar_instalacion(RUTA_DB):
                    print(f"  {paso}")
            elif opcion == "3":
                destino = crear_respaldo(
                    RUTA_DB,
                    RAIZ_PROYECTO / "database" / "copias_seguridad",
                )
                print(f"Copia creada:\n  {destino}")
            elif opcion == "4":
                return 0
            else:
                print("Opción no válida. Selecciona 1, 2, 3 o 4.")
        except (OSError, sqlite3.Error, RuntimeError, ValueError) as exc:
            print(f"ERROR: no se completó la operación: {exc}")

        input("\n\nPresiona Enter para volver al menú...")


if __name__ == "__main__":
    raise SystemExit(_menu())
