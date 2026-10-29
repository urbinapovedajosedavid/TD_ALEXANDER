"""api.respaldos
=============
Generación, descarga y restauración de respaldos de SQLite.
"""

import io
import sqlite3
from datetime import datetime
from typing import Optional

from flask import jsonify, request, send_file

import db
from api import api_bp
from seguridad import requiere_rol


def _error(mensaje, estado=400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def _validar_archivo_respaldo(ruta) -> Optional[str]:
    try:
        conexion = sqlite3.connect(f"file:{ruta}?mode=ro", uri=True)
    except sqlite3.Error:
        return "El archivo no es una base de datos válida."

    try:
        tabla = conexion.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'"
        ).fetchone()
        if tabla is None:
            return "El archivo no contiene las tablas de Tienda Alexander."

        for nombre in ("usuarios", "categorias", "productos", "ventas", "sesiones"):
            existe = conexion.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", (nombre,)
            ).fetchone()
            if existe is None:
                return f"Le falta la tabla '{nombre}'. El archivo no es de este sistema."

        admins = conexion.execute(
            "SELECT COUNT(*) FROM usuarios WHERE rol = 'ADMIN'"
        ).fetchone()[0]
        if admins == 0:
            return "El archivo no tiene ningún administrador: restaurarlo dejaría el sistema cerrado."
    except sqlite3.Error:
        return "No se pudo leer el archivo: puede estar dañado."
    finally:
        conexion.close()

    return None


@api_bp.get("/respaldos/descargar")
@requiere_rol("ADMIN")
def descargar_respaldo():
    temporal = db.RUTA_DB.with_suffix(".descargando")
    conexion = sqlite3.connect(db.RUTA_DB)
    try:
        destino = sqlite3.connect(temporal)
        try:
            conexion.backup(destino)
        finally:
            destino.close()
        contenido = temporal.read_bytes()
    finally:
        conexion.close()
        temporal.unlink(missing_ok=True)

    return send_file(
        io.BytesIO(contenido),
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name=f"alexander_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db",
    )


@api_bp.post("/respaldos/restaurar")
@requiere_rol("ADMIN")
def restaurar_respaldo():
    if "archivo" not in request.files:
        return _error("No se recibió ningún archivo.", 400)

    archivo = request.files["archivo"]
    if not archivo.filename:
        return _error("El archivo no tiene nombre.", 400)

    temporal = db.RUTA_DB.with_suffix(".restaurando")
    archivo.save(temporal)

    problema = _validar_archivo_respaldo(temporal)
    if problema:
        temporal.unlink(missing_ok=True)
        return _error(problema, 400)

    copia_seguridad = db.RUTA_DB.with_suffix(".antes-de-restaurar")
    copia_seguridad.write_bytes(db.RUTA_DB.read_bytes())

    conexion = sqlite3.connect(db.RUTA_DB)
    conexion.close()
    db.RUTA_DB.write_bytes(temporal.read_bytes())
    temporal.unlink(missing_ok=True)

    db.purgar_todas_las_sesiones()

    return jsonify({
        "exito": True,
        "mensaje": "Respaldo restaurado. Vuelve a iniciar sesión.",
    })


@api_bp.get("/respaldos/info")
@requiere_rol("ADMIN")
def informacion_respaldo():
    existe = db.RUTA_DB.exists()
    datos = {
        "existe": existe,
        "tamano_bytes": db.RUTA_DB.stat().st_size if existe else 0,
        "fecha": datetime.fromtimestamp(db.RUTA_DB.stat().st_mtime).strftime(db.FORMATO_FECHA) if existe else None,
    }
    return jsonify(datos)

