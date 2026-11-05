# Rutas de administración de usuarios para el rol ADMIN.

import secrets

from flask import g, jsonify

import backend.db as db
from backend.api import api_bp
from backend.api.utils import cuerpo_json, error
from backend.config import ahora
from seguridad import (
    hash_password,
    requiere_rol,
    revocar_sesiones_de_usuario,
    verify_password,
)


def _formatear_usuario(f, marca_actual):
    nombre = (f["nombre"] or "").strip()
    apellido = (f["apellido"] or "").strip()
    nombre_completo = f"{nombre} {apellido}".strip() if apellido else nombre

    bloqueo_vigente = bool(
        f["bloqueado"]
        and f["tiempo_bloqueo"]
        and str(f["tiempo_bloqueo"]) > marca_actual
    )

    return {
        "id": f["id"],
        "nombre": nombre_completo or f["nombre"],
        "nombre_pila": nombre,
        "apellido": apellido,
        "telefono": (f["telefono"] or "").strip(),
        "usuario": f["usuario"],
        "rol": f["rol"],
        "activo": bool(f["activo"]),
        "bloqueado": bloqueo_vigente,
        "nivel_bloqueo": f["nivel_bloqueo"],
        "creado_en": f["creado_en"],
        "debe_cambiar_clave": bool(f["debe_cambiar_clave"]),
    }


@api_bp.get("/usuarios")
@requiere_rol("ADMIN")
def listar_usuarios():
    marca_actual = ahora()
    with db.conectar_db() as conn:
        filas = conn.execute(
            "SELECT id, nombre, apellido, telefono, usuario, rol, "
            "activo, bloqueado, tiempo_bloqueo, nivel_bloqueo, "
            "creado_en, debe_cambiar_clave "
            "FROM usuarios ORDER BY id"
        ).fetchall()

    return jsonify([_formatear_usuario(f, marca_actual) for f in filas])


@api_bp.get("/usuarios/<int:id_usuario>")
@requiere_rol("ADMIN")
def obtener_usuario(id_usuario):
    with db.conectar_db() as conn:
        fila = conn.execute(
            "SELECT id, nombre, apellido, telefono, usuario, rol, "
            "activo, bloqueado, tiempo_bloqueo, nivel_bloqueo, "
            "creado_en, debe_cambiar_clave "
            "FROM usuarios WHERE id = ?",
            (id_usuario,),
        ).fetchone()

    if not fila:
        return error("Usuario no encontrado.", 404)

    return jsonify(_formatear_usuario(fila, ahora()))


@api_bp.post("/usuarios/<int:id_usuario>/desbloquear")
@requiere_rol("ADMIN")
def desbloquear_usuario(id_usuario):
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


@api_bp.put("/usuarios/<int:id_usuario>/estado")
@api_bp.post("/usuarios/<int:id_usuario>/estado")
@requiere_rol("ADMIN")
def cambiar_estado_usuario(id_usuario):
    if id_usuario == g.usuario["id"]:
        return error("No puedes desactivar tu propia cuenta en sesión.", 400)

    datos = cuerpo_json()
    activo = datos.get("activo")
    if not isinstance(activo, bool):
        return error("El estado 'activo' debe ser booleano.", 400)
    nuevo_activo = int(activo)

    with db.conectar_db() as conn:
        fila = conn.execute(
            "SELECT id, usuario, rol FROM usuarios WHERE id = ?", (id_usuario,)
        ).fetchone()
        if not fila:
            return error("Usuario no encontrado.", 404)

        if nuevo_activo == 0 and fila["rol"] == "ADMIN":
            otro_admin = conn.execute(
                "SELECT 1 FROM usuarios WHERE rol = 'ADMIN' AND activo = 1 AND id <> ? LIMIT 1",
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


@api_bp.delete("/usuarios/<int:id_usuario>")
@requiere_rol("ADMIN")
def eliminar_usuario(id_usuario):
    if id_usuario == g.usuario["id"]:
        return error("No puedes eliminar tu propia cuenta desde Gestión de usuarios.", 409)

    with db.conectar_db() as conn:
        fila = conn.execute(
            "SELECT id, usuario, rol FROM usuarios WHERE id = ?", (id_usuario,)
        ).fetchone()
        if not fila:
            return error("Usuario no encontrado.", 404)

        if fila["rol"] == "ADMIN":
            otro_admin = conn.execute(
                "SELECT 1 FROM usuarios WHERE rol = 'ADMIN' AND activo = 1 AND id <> ? LIMIT 1",
                (id_usuario,),
            ).fetchone()
            if not otro_admin:
                return error("No se puede eliminar al único administrador activo.", 409)

        tiene_ventas = conn.execute(
            "SELECT 1 FROM ventas WHERE usuario_id = ? LIMIT 1", (id_usuario,)
        ).fetchone()
        if tiene_ventas:
            return error(
                "Esta cuenta tiene ventas registradas y no se puede eliminar. "
                "Puedes desactivarla para conservar el historial.",
                409,
            )

        conn.execute("DELETE FROM usuarios WHERE id = ?", (id_usuario,))

    return jsonify({
        "exito": True,
        "mensaje": f"Usuario '{fila['usuario']}' eliminado.",
    })


@api_bp.post("/usuarios/<int:id_usuario>/restablecer-clave")
@requiere_rol("ADMIN")
def restablecer_clave_usuario(id_usuario):
    if id_usuario == g.usuario["id"]:
        return error(
            "No puedes restablecer tu propia clave desde Gestión de usuarios.",
            409,
        )

    datos = cuerpo_json()
    clave_admin = datos.get("clave_admin")
    if not isinstance(clave_admin, str) or not clave_admin:
        return error("Debes confirmar la acción con tu contraseña actual.", 400)

    with db.conectar_db() as conn:
        admin = conn.execute(
            "SELECT password_hash FROM usuarios WHERE id = ?", (g.usuario["id"],)
        ).fetchone()
        if not admin or not verify_password(clave_admin, admin["password_hash"]):
            return error("La contraseña del administrador no es correcta.", 401)

        usuario = conn.execute(
            "SELECT usuario FROM usuarios WHERE id = ?", (id_usuario,)
        ).fetchone()
        if not usuario:
            return error("Usuario no encontrado.", 404)

        clave_temporal = secrets.token_urlsafe(8)
        conn.execute(
            "UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 1, "
            "intentos_fallidos = 0, bloqueado = 0, tiempo_bloqueo = NULL, "
            "nivel_bloqueo = 0 WHERE id = ?",
            (hash_password(clave_temporal), id_usuario),
        )
        revocar_sesiones_de_usuario(conn, id_usuario)

    return jsonify({
        "exito": True,
        "clave_temporal": clave_temporal,
        "mensaje": (
            f"Clave restablecida para '{usuario['usuario']}'. "
            "Se debe cambiar en el próximo inicio de sesión."
        ),
    })
