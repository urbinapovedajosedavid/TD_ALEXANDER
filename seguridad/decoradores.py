"""seguridad.decoradores
=======================
Decoradores firewall para proteger rutas de Flask.

Unifica la autenticación respaldada en la tabla ``sesiones`` de SQLite:
1. Cookie HttpOnly de Flask (``session["token"]``) para el navegador web.
2. Encabezado HTTP ``Authorization: Bearer <token>`` para clientes API / tests.
En ambos casos el token debe existir y estar vigente en ``sesiones``, garantizando
revocación inmediata al cerrar sesión, cambiar contraseña o restaurar respaldos.
"""

from collections.abc import Callable
from functools import wraps
from typing import ParamSpec

from flask import Response, g, jsonify, request, session

from seguridad.autenticacion import usuario_de_token

P = ParamSpec("P")
RespuestaVista = Response | tuple[Response, int]

def obtener_token_actual() -> str:
    """Extrae el token de sesión desde el encabezado Bearer o desde la cookie de sesión."""
    encabezado = request.headers.get("Authorization", "")
    if encabezado.startswith("Bearer "):
        return encabezado[7:].strip()
    return session.get("token") or ""


def _error(mensaje: str, estado: int = 400) -> tuple[Response, int]:
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def requiere_login(
    funcion: Callable[P, RespuestaVista],
) -> Callable[P, RespuestaVista]:
    """Exige una sesión activa y verificada en la tabla ``sesiones`` del servidor."""
    @wraps(funcion)
    def envoltura(*args: P.args, **kwargs: P.kwargs) -> RespuestaVista:
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
            return _error(
                "Sesión no válida o vencida. Vuelve a iniciar sesión.", 401
            )

        usuario["debe_cambiar_clave"] = bool(usuario["debe_cambiar_clave"])
        g.usuario = usuario
        if usuario.get("debe_cambiar_clave") and request.endpoint not in {
            "api.quien_soy",
            "api.cerrar_sesion",
            "api.cambiar_clave",
        }:
            return _error(
                "Debes cambiar la contraseña temporal antes de continuar.", 403
            )
        return funcion(*args, **kwargs)

    return envoltura


def requiere_rol(
    rol_requerido: str,
) -> Callable[[Callable[P, RespuestaVista]], Callable[P, RespuestaVista]]:
    """Exige autenticación y que el usuario tenga el rol especificado."""
    def decorador(
        funcion: Callable[P, RespuestaVista],
    ) -> Callable[P, RespuestaVista]:
        @wraps(funcion)
        @requiere_login
        def envoltura(*args: P.args, **kwargs: P.kwargs) -> RespuestaVista:
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
