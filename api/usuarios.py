from flask import jsonify

import db
from api import api_bp
from seguridad import requiere_rol


@api_bp.get("/usuarios")
@requiere_rol("ADMIN")
def listar_usuarios():
    with db.conectar_db() as conn:
        filas = conn.execute(
            "SELECT id, nombre, apellido, telefono, usuario, rol, bloqueado, "
            "nivel_bloqueo, creado_en "
            "FROM usuarios ORDER BY id"
        ).fetchall()

    resultado = []
    for f in filas:
        apellido = (f["apellido"] or "").strip() if "apellido" in f.keys() else ""
        telefono = (f["telefono"] or "").strip() if "telefono" in f.keys() else ""
        nombre_completo = (f["nombre"] or "").strip()
        if apellido:
            nombre_completo = f"{nombre_completo} {apellido}".strip()
        resultado.append({
            "id": f["id"],
            "nombre": nombre_completo or f["nombre"],
            "apellido": apellido,
            "telefono": telefono,
            "usuario": f["usuario"],
            "rol": f["rol"],
            "bloqueado": bool(f["bloqueado"]),
            "nivel_bloqueo": f["nivel_bloqueo"],
            "creado_en": f["creado_en"],
        })
    return jsonify(resultado)
