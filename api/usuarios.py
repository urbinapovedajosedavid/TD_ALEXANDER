"""api.usuarios
============
Listado y administración de cuentas de usuario (desbloqueo, activación/desactivación).
"""

from flask import g, jsonify

import db
from api import api_bp
from api.utils import cuerpo_json, error
from config import ahora
from seguridad import requiere_rol, revocar_sesiones_de_usuario


@api_bp.get("/usuarios")
@requiere_rol("ADMIN")
def listar_usuarios():
    marca_actual = ahora()
    with db.conectar_db() as conn:
        filas = conn.execute(
            "SELECT id, nombre, apellido, telefono, usuario, rol, "
            "COALESCE(activo, 1) AS activo, bloqueado, tiempo_bloqueo, "
            "nivel_bloqueo, creado_en "
            "FROM usuarios ORDER BY id"
        ).fetchall()

    resultado = []
    for f in filas:
        apellido = (f["apellido"] or "").strip()
        telefono = (f["telefono"] or "").strip()
        nombre_base = (f["nombre"] or "").strip()
        nombre_completo = f"{nombre_base} {apellido}".strip() if apellido else nombre_base

        bloqueo_vigente = bool(
            f["bloqueado"]
            and f["tiempo_bloqueo"]
            and str(f["tiempo_bloqueo"]) > marca_actual
        )

        resultado.append({
            "id": f["id"],
            "nombre": nombre_completo or f["nombre"],
            "nombre_pila": nombre_base,
            "apellido": apellido,
            "telefono": telefono,
            "usuario": f["usuario"],
            "rol": f["rol"],
            "activo": bool(f["activo"]),
            "bloqueado": bloqueo_vigente,
            "nivel_bloqueo": f["nivel_bloqueo"],
            "creado_en": f["creado_en"],
        })
    return jsonify(resultado)


@api_bp.post("/usuarios/<int:id_usuario>/desbloquear")
@requiere_rol("ADMIN")
def desbloquear_usuario(id_usuario: int):
    """Limpia el bloqueo por fuerza bruta y reactiva la cuenta del usuario."""
    with db.conectar_db() as conn:
        existe = conn.execute(
            "SELECT id, usuario FROM usuarios WHERE id = ?", (id_usuario,)
        ).fetchone()
        if not existe:
            return error("Usuario no encontrado.", 404)

        conn.execute(
            "UPDATE usuarios SET bloqueado = 0, intentos_fallidos = 0, "
            "tiempo_bloqueo = NULL, nivel_bloqueo = 0, activo = 1 WHERE id = ?",
            (id_usuario,),
        )

    return jsonify({
        "exito": True,
        "mensaje": f"Usuario '{existe['usuario']}' desbloqueado y activo.",
    })


@api_bp.post("/usuarios/<int:id_usuario>/estado")
@requiere_rol("ADMIN")
def cambiar_estado_usuario(id_usuario: int):
    """Activa o desactiva una cuenta de usuario (revocando sus sesiones si se desactiva)."""
    if id_usuario == g.usuario["id"]:
        return error("No puedes desactivar tu propia cuenta en sesión.", 400)

    datos = cuerpo_json()
    nuevo_activo = 1 if datos.get("activo", True) else 0

    with db.conectar_db() as conn:
        fila = conn.execute(
            "SELECT id, usuario, rol FROM usuarios WHERE id = ?", (id_usuario,)
        ).fetchone()
        if not fila:
            return error("Usuario no encontrado.", 404)

        if nuevo_activo == 0 and fila["rol"] == "ADMIN":
            otro_admin = conn.execute(
                "SELECT 1 FROM usuarios WHERE rol = 'ADMIN' AND COALESCE(activo, 1) = 1 AND id <> ? LIMIT 1",
                (id_usuario,),
            ).fetchone()
            if not otro_admin:
                return error("No se puede desactivar al único administrador activo.", 409)

        conn.execute(
            "UPDATE usuarios SET activo = ? WHERE id = ?",
            (nuevo_activo, id_usuario),
        )
        if nuevo_activo == 0:
            revocar_sesiones_de_usuario(conn, id_usuario)

    estado_txt = "activada" if nuevo_activo else "desactivada"
    return jsonify({
        "exito": True,
        "activo": bool(nuevo_activo),
        "mensaje": f"Cuenta '{fila['usuario']}' {estado_txt}.",
    })
