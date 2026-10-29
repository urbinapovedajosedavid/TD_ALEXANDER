"""api.auth
========
Endpoints de autenticación, control de sesiones en el servidor,
cambio de clave y registro de usuarios.
"""

from flask import g, jsonify, request, session

import db
from api import api_bp
from schemas import validar_usuario
from seguridad import (
    hash_password,
    procesar_intento_login,
    requiere_login,
    requiere_rol,
    verify_password,
)


def _cuerpo_json():
    return request.get_json(silent=True) or {}


def _token_de_peticion():
    encabezado = request.headers.get("Authorization", "")
    if encabezado.startswith("Bearer "):
        return encabezado[7:].strip()
    return ""


def _error(mensaje, estado=400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


@api_bp.post("/auth/login")
def login():
    datos = _cuerpo_json()
    usuario = (datos.get("usuario") or "").strip()
    clave = datos.get("clave") or ""

    if not usuario or not clave:
        return _error("Usuario y contraseña son obligatorios.", 400)

    with db.conectar_db() as conn:
        exito, resultado, codigo = procesar_intento_login(conn, usuario, clave)
        if not exito:
            return jsonify({"exito": False, **resultado}), codigo

        db.purgar_sesiones_vencidas(conn)
        token = db.crear_sesion(conn, resultado["id"])

    # 1. Establecer sesión cifrada nativa de Flask (cookie HttpOnly del servidor)
    session.clear()
    session["usuario_id"] = resultado["id"]
    session["usuario"] = resultado["usuario"]
    session["rol"] = resultado["rol"]
    session["nombre"] = resultado["nombre"]

    # 2. Responder con datos de usuario y token
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
    """Cierra la sesión activa en el servidor y en la base de datos."""
    token = _token_de_peticion()
    if token:
        with db.conectar_db() as conn:
            db.revocar_sesion(conn, token)

    session.clear()
    return jsonify({"exito": True, "mensaje": "Sesión cerrada."})


@api_bp.post("/auth/cambiar-clave")
@requiere_login
def cambiar_clave():
    datos = _cuerpo_json()
    actual = datos.get("actual") or ""
    nueva = datos.get("nueva") or ""

    if len(nueva) < 4:
        return _error("La nueva clave debe tener al menos 4 caracteres.", 400)
    if nueva == actual:
        return _error("La nueva clave debe ser distinta de la actual.", 400)

    token_actual = _token_de_peticion()
    with db.conectar_db() as conn:
        fila = conn.execute(
            "SELECT password_hash FROM usuarios WHERE id = ?", (g.usuario["id"],)
        ).fetchone()

        if not verify_password(actual, fila["password_hash"]):
            return _error("La clave actual no es correcta.", 401)

        conn.execute(
            "UPDATE usuarios SET password_hash = ? WHERE id = ?",
            (hash_password(nueva), g.usuario["id"]),
        )
        # Revocar otras sesiones salvo el token actual (si existe)
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
            "SELECT 1 FROM usuarios WHERE rol = 'ADMIN' AND id <> ? LIMIT 1",
            (g.usuario["id"],),
        ).fetchone()

        if g.usuario["rol"] == "ADMIN" and admin is None:
            return _error(
                "No puedes eliminar la única cuenta de administrador del sistema.",
                409,
            )

        if conn.execute(
            "SELECT 1 FROM ventas WHERE usuario_id = ? LIMIT 1", (g.usuario["id"],)
        ).fetchone():
            return _error(
                "Esta cuenta ya tiene ventas registradas y no se puede eliminar. "
                "Pide a un administrador que la desactive.",
                409,
            )

        conn.execute("DELETE FROM usuarios WHERE id = ?", (g.usuario["id"],))

    session.clear()
    return jsonify({"exito": True, "mensaje": "Cuenta eliminada."})


@api_bp.post("/auth/registro")
@requiere_rol("ADMIN")
def registrar_usuario():
    """Registro de usuarios por parte de un Administrador."""
    datos = _cuerpo_json()
    valido, problema = validar_usuario(datos)
    if not valido:
        return _error(problema, 400)

    usuario = datos.get("usuario").strip()
    clave = datos.get("clave") or datos.get("contrasena")
    nombre = (datos.get("nombre") or "").strip() or usuario
    rol = "ADMIN" if str(datos.get("rol", "")).upper() == "ADMIN" else "VENDEDOR"

    with db.conectar_db() as conn:
        existe = conn.execute(
            "SELECT 1 FROM usuarios WHERE usuario = ? COLLATE NOCASE", (usuario,)
        ).fetchone()
        if existe:
            return _error("Ese usuario ya existe, ingrese otro usuario.", 400)

        cur = conn.execute(
            "INSERT INTO usuarios (nombre, usuario, password_hash, rol, intentos_fallidos, bloqueado, nivel_bloqueo) "
            "VALUES (?, ?, ?, ?, 0, 0, 0)",
            (nombre, usuario, hash_password(clave), rol),
        )
        nuevo_id = cur.lastrowid

    return jsonify({
        "exito": True,
        "mensaje": f"Usuario {usuario} agregado.",
        "id": nuevo_id,
    }), 201


@api_bp.post("/auth/registro-publico")
def registrar_usuario_publico():
    """Alta pública de usuario vendedor (usado por la pantalla agregar_usuario.html)."""
    datos = _cuerpo_json()
    valido, problema = validar_usuario(datos)
    if not valido:
        return _error(problema, 400)

    usuario = datos.get("usuario").strip()
    clave = datos.get("clave") or datos.get("contrasena")
    nombre = (datos.get("nombre") or "").strip() or usuario

    with db.conectar_db() as conn:
        existe = conn.execute(
            "SELECT 1 FROM usuarios WHERE usuario = ? COLLATE NOCASE", (usuario,)
        ).fetchone()
        if existe:
            return _error("Ese usuario ya existe, ingrese otro usuario.", 400)

        cur = conn.execute(
            "INSERT INTO usuarios (nombre, usuario, password_hash, rol, intentos_fallidos, bloqueado, nivel_bloqueo) "
            "VALUES (?, ?, ?, 'VENDEDOR', 0, 0, 0)",
            (nombre, usuario, hash_password(clave)),
        )
        nuevo_id = cur.lastrowid

    return jsonify({
        "exito": True,
        "mensaje": f"Usuario {usuario} creado exitosamente. Ya puedes iniciar sesión.",
        "id": nuevo_id,
    }), 201
