from flask import jsonify

import db
from api import api_bp
from seguridad import requiere_rol


@api_bp.get("/usuarios")
@requiere_rol("ADMIN")
def listar_usuarios():
    with db.conectar_db() as conn:
        filas = conn.execute(
            "SELECT id, nombre, usuario, rol, bloqueado, nivel_bloqueo, creado_en "
            "FROM usuarios ORDER BY id"
        ).fetchall()

    return jsonify([
        {
            "id": f["id"],
            "nombre": f["nombre"],
            "usuario": f["usuario"],
            "rol": f["rol"],
            "bloqueado": bool(f["bloqueado"]),
            "nivel_bloqueo": f["nivel_bloqueo"],
            "creado_en": f["creado_en"],
        }
        for f in filas
    ])
