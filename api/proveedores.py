"""api.proveedores
===============
Gestión y directorio de proveedores.
"""

from flask import jsonify

import db
from api import api_bp
from api.utils import cuerpo_json, error
from seguridad import requiere_login, requiere_rol


def _fila_proveedor(f):
    return {
        "id": f["id"],
        "nombre": f["nombre"],
        "telefono": f["telefono"],
        "cedula": f["cedula"],
        "direccion": f["direccion"],
        "departamento": f["departamento"],
    }


def _extraer_campos_proveedor(datos: dict):
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        return None, "El nombre del proveedor es obligatorio."

    return {
        "nombre": nombre,
        "telefono": (datos.get("telefono") or "").strip(),
        "cedula": (datos.get("cedula") or "").strip(),
        "direccion": (datos.get("direccion") or "").strip(),
        "departamento": (datos.get("departamento") or "").strip(),
    }, None


@api_bp.get("/proveedores")
@requiere_login
def obtener_proveedores():
    with db.conectar_db() as conn:
        filas = conn.execute("SELECT * FROM proveedores ORDER BY nombre").fetchall()
    return jsonify([_fila_proveedor(f) for f in filas])


@api_bp.post("/proveedores")
@requiere_login
def crear_proveedor():
    campos, problema = _extraer_campos_proveedor(cuerpo_json())
    if problema:
        return error(problema, 400)

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


@api_bp.put("/proveedores/<int:id_proveedor>")
@requiere_login
def actualizar_proveedor(id_proveedor: int):
    campos, problema = _extraer_campos_proveedor(cuerpo_json())
    if problema:
        return error(problema, 400)

    with db.conectar_db() as conn:
        cur = conn.execute(
            "UPDATE proveedores SET nombre = :nombre, telefono = :telefono, "
            "cedula = :cedula, direccion = :direccion, departamento = :departamento "
            "WHERE id = :id",
            {**campos, "id": id_proveedor},
        )
        if cur.rowcount == 0:
            return error("Proveedor no encontrado.", 404)

    return jsonify({"exito": True, "mensaje": "Proveedor actualizado."})


@api_bp.delete("/proveedores/<int:id_proveedor>")
@requiere_rol("ADMIN")
def eliminar_proveedor(id_proveedor: int):
    with db.conectar_db() as conn:
        cur = conn.execute("DELETE FROM proveedores WHERE id = ?", (id_proveedor,))
        if cur.rowcount == 0:
            return error("Proveedor no encontrado.", 404)

    return jsonify({"exito": True, "mensaje": "Proveedor eliminado."})
