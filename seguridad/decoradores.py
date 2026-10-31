"""seguridad.decoradores
=======================
Decoradores firewall para proteger rutas de Flask.

Unifica la autenticación respaldada en la tabla ``sesiones`` de SQLite:
1. Cookie HttpOnly de Flask (``session["token"]``) para el navegador web.
2. Encabezado HTTP ``Authorization: Bearer <token>`` para clientes API / tests.
En ambos casos el token debe existir y estar vigente en ``sesiones``, garantizando
revocación inmediata al cerrar sesión, cambiar contraseña o restaurar respaldos.
"""

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
    """Exige una sesión activa y verificada en la tabla ``sesiones`` del servidor."""
    @wraps(funcion)
    def envoltura(*args, **kwargs):
        from db import conectar_db

        token = obtener_token_actual()
        usuario = None

        if token:
            with conectar_db() as conn:
                fila = usuario_de_token(conn, token)
                if fila:
                    usuario = dict(fila)

        if usuario is None:
            session.clear()
            return _error(
                "Sesión no válida o vencida. Vuelve a iniciar sesión.", 401
            )

        g.usuario = usuario
        return funcion(*args, **kwargs)

    return envoltura


def requiere_rol(rol_requerido: str):
    """Exige autenticación y que el usuario tenga el rol especificado."""
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
