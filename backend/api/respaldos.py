# Rutas de respaldo y restauración de la base de datos SQLite.

import io
import sqlite3
from datetime import datetime

from flask import jsonify, request, send_file, session

import backend.db as db
from backend.api import api_bp
from backend.api.utils import error
from backend.config import FORMATO_FECHA
from seguridad import requiere_rol


def _validar_archivo_respaldo(ruta):
    try:
        conexion = sqlite3.connect(ruta)
    except sqlite3.Error:
        return "El archivo no es una base de datos válida."

    try:
        for nombre in ("usuarios", "categorias", "productos", "ventas", "sesiones"):
            existe = conexion.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
                (nombre,),
            ).fetchone()
            if existe is None:
                return f"Le falta la tabla '{nombre}'. El archivo no pertenece a Tienda Alexander."

        admins = conexion.execute(
            "SELECT COUNT(*) FROM usuarios WHERE rol = 'ADMIN'"
        ).fetchone()[0]
        if admins == 0:
            return "El archivo no tiene ningún administrador."
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
        return error("No se recibió ningún archivo.", 400)

    archivo = request.files["archivo"]
    if not archivo.filename:
        return error("El archivo no tiene nombre.", 400)

    temporal = db.RUTA_DB.with_suffix(".restaurando")
    archivo.save(temporal)

    problema = _validar_archivo_respaldo(temporal)
    if problema:
        temporal.unlink(missing_ok=True)
        return error(problema, 400)

    respaldo_previo = db.RUTA_DB.with_suffix(".antes-de-restaurar")
    try:
        if db.RUTA_DB.exists():
            actual_conn = sqlite3.connect(db.RUTA_DB)
            previo_conn = sqlite3.connect(respaldo_previo)
            try:
                actual_conn.backup(previo_conn)
            finally:
                previo_conn.close()
                actual_conn.close()

        origen = sqlite3.connect(temporal)
        destino = sqlite3.connect(db.RUTA_DB)
        try:
            origen.backup(destino)
        finally:
            destino.close()
            origen.close()
    finally:
        temporal.unlink(missing_ok=True)

    db.inicializar_db()
    db.purgar_todas_las_sesiones()
    session.clear()

    return jsonify({
        "exito": True,
        "mensaje": "Respaldo restaurado correctamente. Se guardó copia de seguridad previa.",
    })


@api_bp.get("/respaldos/info")
@requiere_rol("ADMIN")
def informacion_respaldo():
    existe = db.RUTA_DB.exists()
    stat = db.RUTA_DB.stat() if existe else None
    return jsonify({
        "existe": existe,
        "tamano_bytes": stat.st_size if stat else 0,
        "fecha": datetime.fromtimestamp(stat.st_mtime).strftime(FORMATO_FECHA) if stat else None,
    })
