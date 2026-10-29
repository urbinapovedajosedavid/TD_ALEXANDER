"""seguridad.decoradores
=======================
Decoradores firewall para proteger rutas de Flask.

Soporta autenticación basada en:
1. Token Bearer en encabezado HTTP Authorization (usado por tests y clientes API)
2. Sesión cifrada nativa de Flask (cookies HttpOnly/SameSite en el navegador, sin LocalStorage)
"""

from functools import wraps

from flask import g, jsonify, request, session

from seguridad.autenticacion import usuario_de_token


def _token_de_peticion() -> str:
    """Lee el token del encabezado Authorization: Bearer <token> si existe."""
    encabezado = request.headers.get("Authorization", "")
    if encabezado.startswith("Bearer "):
        return encabezado[7:].strip()
    return ""


def _error(mensaje: str, estado: int = 400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def requiere_login(funcion):
    """Exige una sesión válida.

    Si se envía encabezado 'Authorization: Bearer <token>', se autentica por token.
    En caso contrario, se autentica por la sesión cifrada nativa de Flask.
    """
    @wraps(funcion)
    def envoltura(*args, **kwargs):
        from db import conectar_db

        usuario = None
        token = _token_de_peticion()

        # 1. Si viene encabezado Authorization: Bearer <token>, validar por token
        if token:
            with conectar_db() as conn:
                fila = usuario_de_token(conn, token)
                if fila:
                    usuario = dict(fila)
        else:
            # 2. Si no hay encabezado, usar la cookie de sesión nativa de Flask (navegador web)
            usuario_id_sesion = session.get("usuario_id")
            if usuario_id_sesion:
                with conectar_db() as conn:
                    fila = conn.execute(
                        "SELECT id, nombre, usuario, rol, bloqueado FROM usuarios "
                        "WHERE id = ? AND bloqueado = 0",
                        (usuario_id_sesion,),
                    ).fetchone()
                    if fila:
                        usuario = dict(fila)

        if usuario is None:
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
