"""Decoradores de autenticación y autorización para rutas de Flask."""

from functools import wraps

from flask import g, jsonify, request, session

from seguridad.autenticacion import usuario_de_token


def obtener_token_actual() -> str:
    """Extrae el token de sesión desde el encabezado Bearer o desde la cookie de sesión."""
    encabezado = request.headers.get("Authorization", "")
    if encabezado.startswith("Bearer "):
        return encabezado[7:].strip()
    return session.get("token") or ""


def _error(mensaje: str, estado: int = 400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def requiere_login(funcion):
    """Exige una sesión activa y verificada en la tabla `sesiones`."""
    @wraps(funcion)
    def envoltura(*args, **kwargs):
        from backend.db import conectar_db

        token = obtener_token_actual()
        usuario = None

        if token:
            with conectar_db() as conn:
                fila = usuario_de_token(conn, token)
                if fila:
                    usuario = dict(fila)

        if usuario is None:
            session.clear()
            return _error("Sesión no válida o vencida. Vuelve a iniciar sesión.", 401)

        usuario["debe_cambiar_clave"] = bool(usuario["debe_cambiar_clave"])
        g.usuario = usuario
        if usuario.get("debe_cambiar_clave") and request.endpoint not in {
            "api.quien_soy",
            "api.cerrar_sesion",
            "api.cambiar_clave",
        }:
            return _error("Debes cambiar la contraseña temporal antes de continuar.", 403)
        return funcion(*args, **kwargs)

    return envoltura


def requiere_rol(rol_requerido: str):
    """Exige autenticación y que el usuario tenga el rol indicado."""
    def decorador(funcion):
        @wraps(funcion)
        @requiere_login
        def envoltura(*args, **kwargs):
            if g.usuario.get("rol") != rol_requerido:
                return _error(
                    "Necesitas permisos de administrador para esta acción."
                    if rol_requerido == "ADMIN"
                    else "No tienes permisos suficientes para esta acción.",
                    403,
                )
            return funcion(*args, **kwargs)
        return envoltura
    return decorador
