"""api.auth
========
Endpoints de autenticación, control de sesiones revocables en el servidor,
cambio de contraseña y alta de usuarios.
"""

from flask import g, jsonify, session

import db
from api import api_bp
from api.utils import cuerpo_json, error
from schemas import validar_usuario
from seguridad import (
    crear_sesion,
    hash_password,
    obtener_token_actual,
    procesar_intento_login,
    purgar_sesiones_vencidas,
    requiere_login,
    requiere_rol,
    revocar_sesion,
    verify_password,
)


def _crear_cuenta_usuario(datos: dict, permitir_rol_admin: bool = False):
    """Valida e inserta un nuevo usuario en la base de datos evitando duplicar lógica."""
    valido, problema = validar_usuario(datos)
    if not valido:
        return error(problema, 400)

    usuario = datos.get("usuario").strip()
    clave = datos.get("clave") or datos.get("contrasena")
    nombre = (datos.get("nombre") or "").strip()
    apellido = (datos.get("apellido") or "").strip()
    telefono = (datos.get("telefono") or "").strip()

    rol = "VENDEDOR"
    if permitir_rol_admin and str(datos.get("rol", "")).upper() == "ADMIN":
        rol = "ADMIN"

    with db.conectar_db() as conn:
        existe = conn.execute(
            "SELECT 1 FROM usuarios WHERE usuario = ? COLLATE NOCASE", (usuario,)
        ).fetchone()
        if existe:
            return error("Ese usuario ya existe, ingrese otro usuario.", 400)

        cur = conn.execute(
            "INSERT INTO usuarios (nombre, apellido, telefono, usuario, password_hash, rol, "
            "activo, intentos_fallidos, bloqueado, nivel_bloqueo) "
            "VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0)",
            (nombre, apellido, telefono, usuario, hash_password(clave), rol),
        )
        nuevo_id = cur.lastrowid

    return jsonify({
        "exito": True,
        "mensaje": f"Usuario {usuario} creado exitosamente.",
        "id": nuevo_id,
    }), 201


@api_bp.post("/auth/login")
def login():
    datos = cuerpo_json()
    usuario = (datos.get("usuario") or "").strip()
    clave = datos.get("clave") or ""

    if not usuario or not clave:
        return error("Usuario y contraseña son obligatorios.", 400)

    with db.conectar_db() as conn:
        exito, resultado, codigo = procesar_intento_login(conn, usuario, clave)
        if not exito:
            return jsonify({"exito": False, **resultado}), codigo

        purgar_sesiones_vencidas(conn)
        token = crear_sesion(conn, resultado["id"])

    # Sesión de servidor firmada en cookie HttpOnly y respaldada por la tabla `sesiones`
    session.clear()
    session["token"] = token
    session["usuario_id"] = resultado["id"]
    session["usuario"] = resultado["usuario"]
    session["rol"] = resultado["rol"]
    session["nombre"] = resultado["nombre"]

    return jsonify({
        "exito": True,
        "token": token,
        "usuario": resultado,
    })


@api_bp.get("/auth/yo")
@requiere_login
def quien_soy():
    """Devuelve los datos del usuario de la sesión actual."""
    return jsonify({"exito": True, "usuario": g.usuario})


@api_bp.post("/auth/logout")
@requiere_login
def cerrar_sesion():
    """Revoca la sesión activa en la base de datos y limpia la cookie del navegador."""
    token = obtener_token_actual()
    if token:
        with db.conectar_db() as conn:
            revocar_sesion(conn, token)

    session.clear()
    return jsonify({"exito": True, "mensaje": "Sesión cerrada."})


@api_bp.post("/auth/cambiar-clave")
@requiere_login
def cambiar_clave():
    datos = cuerpo_json()
    actual = datos.get("actual") or ""
    nueva = datos.get("nueva") or ""

    if len(nueva) < 4:
        return error("La nueva clave debe tener al menos 4 caracteres.", 400)
    if nueva == actual:
        return error("La nueva clave debe ser distinta de la actual.", 400)

    token_actual = obtener_token_actual()
    with db.conectar_db() as conn:
        fila = conn.execute(
            "SELECT password_hash FROM usuarios WHERE id = ?", (g.usuario["id"],)
        ).fetchone()

        if not fila or not verify_password(actual, fila["password_hash"]):
            return error("La clave actual no es correcta.", 401)

        conn.execute(
            "UPDATE usuarios SET password_hash = ? WHERE id = ?",
            (hash_password(nueva), g.usuario["id"]),
        )
        # Revocar todas las demás sesiones abiertas del usuario (incluidas otras cookies)
        if token_actual:
            conn.execute(
                "DELETE FROM sesiones WHERE usuario_id = ? AND token <> ?",
                (g.usuario["id"], token_actual),
            )
        else:
            conn.execute(
                "DELETE FROM sesiones WHERE usuario_id = ?",
                (g.usuario["id"],),
            )

    return jsonify({"exito": True, "mensaje": "Contraseña actualizada."})


@api_bp.delete("/auth/cuenta")
@requiere_login
def eliminar_cuenta_propia():
    with db.conectar_db() as conn:
        admin = conn.execute(
            "SELECT 1 FROM usuarios WHERE rol = 'ADMIN' AND COALESCE(activo, 1) = 1 AND id <> ? LIMIT 1",
            (g.usuario["id"],),
        ).fetchone()

        if g.usuario["rol"] == "ADMIN" and admin is None:
            return error(
                "No puedes eliminar la única cuenta de administrador activa del sistema.",
                409,
            )

        if conn.execute(
            "SELECT 1 FROM ventas WHERE usuario_id = ? LIMIT 1", (g.usuario["id"],)
        ).fetchone():
            return error(
                "Esta cuenta ya tiene ventas registradas y no se puede eliminar. "
                "Un administrador puede desactivarla desde Gestión de Usuarios.",
                409,
            )

        conn.execute("DELETE FROM usuarios WHERE id = ?", (g.usuario["id"],))

    session.clear()
    return jsonify({"exito": True, "mensaje": "Cuenta eliminada."})


@api_bp.post("/auth/registro")
@requiere_rol("ADMIN")
def registrar_usuario():
    """Registro de usuarios (VENDEDOR o ADMIN) por parte de un Administrador."""
    return _crear_cuenta_usuario(cuerpo_json(), permitir_rol_admin=True)


@api_bp.post("/auth/registro-publico")
def registrar_usuario_publico():
    """Alta de cuenta con rol estrictamente restringido a VENDEDOR."""
    return _crear_cuenta_usuario(cuerpo_json(), permitir_rol_admin=False)
