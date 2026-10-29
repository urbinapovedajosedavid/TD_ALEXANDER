"""api.proveedores
===============
Gestión de proveedores.
"""

from flask import jsonify, request

import db
from api import api_bp
from seguridad import requiere_login


def _cuerpo_json():
    return request.get_json(silent=True) or {}


def _error(mensaje, estado=400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def _fila_proveedor(f):
    return {
        "id": f["id"],
        "nombre": f["nombre"],
        "telefono": f["telefono"],
        "cedula": f["cedula"],
        "direccion": f["direccion"],
        "departamento": f["departamento"],
    }


@api_bp.get("/proveedores")
@requiere_login
def obtener_proveedores():
    with db.conectar_db() as conn:
        filas = conn.execute("SELECT * FROM proveedores ORDER BY nombre").fetchall()
    return jsonify([_fila_proveedor(f) for f in filas])


@api_bp.post("/proveedores")
@requiere_login
def crear_proveedor():
    datos = _cuerpo_json()
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        return _error("El nombre del proveedor es obligatorio.", 400)

    campos = {
        "nombre": nombre,
        "telefono": (datos.get("telefono") or "").strip(),
        "cedula": (datos.get("cedula") or "").strip(),
        "direccion": (datos.get("direccion") or "").strip(),
        "departamento": (datos.get("departamento") or "").strip(),
    }

    with db.conectar_db() as conn:
        cur = conn.execute(
            "INSERT INTO proveedores (nombre, telefono, cedula, direccion, departamento) "
            "VALUES (:nombre, :telefono, :cedula, :direccion, :departamento)",
            campos,
        )
        nuevo_id = cur.lastrowid

    return jsonify({
        "exito": True,
        "mensaje": "Proveedor registrado.",
        "id": nuevo_id,
    }), 201


@api_bp.delete("/proveedores/<int:id_proveedor>")
@requiere_login
def eliminar_proveedor(id_proveedor):
    with db.conectar_db() as conn:
        cur = conn.execute("DELETE FROM proveedores WHERE id = ?", (id_proveedor,))
        if cur.rowcount == 0:
            return _error("Proveedor no encontrado.", 404)

    return jsonify({"exito": True, "mensaje": "Proveedor eliminado."})

