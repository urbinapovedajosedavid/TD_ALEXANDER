import secrets
import sqlite3
from datetime import datetime, timedelta

from werkzeug.security import check_password_hash, generate_password_hash

from backend.config import FORMATO_FECHA, ahora

DURACION_SESION_HORAS = 8
VENTANA_ESCALADO_SEGUNDOS = 15 * 60


def hash_password(clave: str) -> str:
    """Genera hash PBKDF2-SHA-256 usando werkzeug.security."""
    return generate_password_hash(clave, method="pbkdf2:sha256", salt_length=16)


def verify_password(clave: str, almacenado: str) -> bool:
    """Verifica una contraseña contra el hash almacenado."""
    if not almacenado or not almacenado.startswith("pbkdf2:"):
        return False
    return check_password_hash(almacenado, clave)


def procesar_intento_login(
    conn: sqlite3.Connection,
    usuario_input: str,
    clave_input: str,
):
    """Valida credenciales y gestiona el bloqueo temporal por intentos fallidos."""
    usuario_input = (usuario_input or "").strip()
    clave_input = clave_input or ""

    if not usuario_input or not clave_input:
        return False, {"mensaje": "Usuario y contraseña son obligatorios."}, 400

    fila = conn.execute(
        "SELECT id, nombre, usuario, rol, password_hash, COALESCE(activo, 1) AS activo, "
        "intentos_fallidos, bloqueado, tiempo_bloqueo, nivel_bloqueo, "
        "debe_cambiar_clave "
        "FROM usuarios WHERE usuario = ? COLLATE NOCASE",
        (usuario_input,),
    ).fetchone()

    if fila is None:
        return False, {"mensaje": "Usuario o contraseña incorrectos."}, 401

    if not fila["activo"]:
        return (
            False,
            {"mensaje": "Esta cuenta se encuentra desactivada. Contacta al administrador."},
            403,
        )

    user_id = fila["id"]
    intentos = fila["intentos_fallidos"] or 0
    bloqueado = fila["bloqueado"] or 0
    tiempo_bloqueo_str = fila["tiempo_bloqueo"]
    nivel = fila["nivel_bloqueo"] or 0
    ahora_dt = datetime.now()

    if tiempo_bloqueo_str:
        try:
            tiempo_bloqueo = datetime.strptime(tiempo_bloqueo_str, FORMATO_FECHA)
        except ValueError:
            tiempo_bloqueo = ahora_dt

        if bloqueado and ahora_dt < tiempo_bloqueo:
            segundos = max(1, int((tiempo_bloqueo - ahora_dt).total_seconds()))
            minutos = (segundos + 59) // 60
            return (
                False,
                {
                    "mensaje": (
                        f"Cuenta bloqueada temporalmente por intentos fallidos. "
                        f"Intenta de nuevo en {segundos} segundos ({minutos} min)."
                    ),
                    "bloqueado": True,
                    "segundos_restantes": segundos,
                    "minutos_restantes": minutos,
                    "nivel_bloqueo": nivel,
                },
                403,
            )

        segundos_desde_vencimiento = (ahora_dt - tiempo_bloqueo).total_seconds()
        if segundos_desde_vencimiento > VENTANA_ESCALADO_SEGUNDOS:
            nivel = 0
            intentos = 0
            conn.execute(
                "UPDATE usuarios SET bloqueado = 0, tiempo_bloqueo = NULL, "
                "nivel_bloqueo = 0, intentos_fallidos = 0 WHERE id = ?",
                (user_id,),
            )
        else:
            conn.execute(
                "UPDATE usuarios SET bloqueado = 0 WHERE id = ?",
                (user_id,),
            )
        bloqueado = 0

    if verify_password(clave_input, fila["password_hash"]):
        conn.execute(
            "UPDATE usuarios SET intentos_fallidos = 0, bloqueado = 0, "
            "tiempo_bloqueo = NULL, nivel_bloqueo = 0 WHERE id = ?",
            (user_id,),
        )
        return (
            True,
            {
                "id": fila["id"],
                "nombre": fila["nombre"],
                "usuario": fila["usuario"],
                "rol": fila["rol"],
                "debe_cambiar_clave": bool(fila["debe_cambiar_clave"]),
            },
            200,
        )

    if nivel > 0:
        nuevo_nivel = nivel + 1
        minutos = 1 + 2 * (nuevo_nivel - 1)
        segundos = minutos * 60
        tiempo_fin = (ahora_dt + timedelta(minutes=minutos)).strftime(FORMATO_FECHA)
        conn.execute(
            "UPDATE usuarios SET bloqueado = 1, nivel_bloqueo = ?, "
            "tiempo_bloqueo = ?, intentos_fallidos = 3 WHERE id = ?",
            (nuevo_nivel, tiempo_fin, user_id),
        )
        return (
            False,
            {
                "mensaje": (
                    f"Contraseña incorrecta tras penalización: "
                    f"cuenta bloqueada por {minutos} minutos (Nivel {nuevo_nivel}). "
                    f"Intenta de nuevo en {segundos} segundos."
                ),
                "bloqueado": True,
                "nivel_bloqueo": nuevo_nivel,
                "minutos_bloqueo": minutos,
                "segundos_restantes": segundos,
            },
            403,
        )

    nuevos_intentos = intentos + 1
    if nuevos_intentos >= 3:
        minutos = 1
        segundos = 60
        tiempo_fin = (ahora_dt + timedelta(minutes=minutos)).strftime(FORMATO_FECHA)
        conn.execute(
            "UPDATE usuarios SET bloqueado = 1, nivel_bloqueo = 1, "
            "tiempo_bloqueo = ?, intentos_fallidos = ? WHERE id = ?",
            (tiempo_fin, nuevos_intentos, user_id),
        )
        return (
            False,
            {
                "mensaje": (
                    "Contraseña incorrecta. 3 intentos fallidos consecutivos: "
                    "cuenta bloqueada por 1 minuto. Intenta de nuevo en 60 segundos."
                ),
                "bloqueado": True,
                "nivel_bloqueo": 1,
                "minutos_bloqueo": 1,
                "segundos_restantes": 60,
            },
            403,
        )

    conn.execute(
        "UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?",
        (nuevos_intentos, user_id),
    )
    restantes = 3 - nuevos_intentos
    return (
        False,
        {
            "mensaje": f"Usuario o contraseña incorrectos. Intentos restantes : {restantes}.",
            "bloqueado": False,
            "intentos_restantes": restantes,
        },
        401,
    )


def crear_sesion(conn: sqlite3.Connection, usuario_id: int) -> str:
    """Abre una sesión en la BD y devuelve un token aleatorio."""
    token = secrets.token_urlsafe(32)
    expira = datetime.now() + timedelta(hours=DURACION_SESION_HORAS)
    conn.execute(
        "INSERT INTO sesiones (token, usuario_id, creado_en, expira_en) "
        "VALUES (?, ?, ?, ?)",
        (token, usuario_id, ahora(), expira.strftime(FORMATO_FECHA)),
    )
    return token


def usuario_de_token(conn: sqlite3.Connection, token: str):
    """Busca al usuario si el token de sesión existe, no ha expirado y la cuenta está activa."""
    if not token:
        return None
    return conn.execute(
        "SELECT u.id, u.nombre, u.usuario, u.rol, COALESCE(u.activo, 1) AS activo, "
        "u.debe_cambiar_clave "
        "FROM sesiones s "
        "JOIN usuarios u ON u.id = s.usuario_id "
        "WHERE s.token = ? AND s.expira_en > ? AND COALESCE(u.activo, 1) = 1",
        (token, ahora()),
    ).fetchone()


def revocar_sesion(conn: sqlite3.Connection, token: str) -> None:
    if token:
        conn.execute("DELETE FROM sesiones WHERE token = ?", (token,))


def revocar_sesiones_de_usuario(conn: sqlite3.Connection, usuario_id: int) -> None:
    conn.execute("DELETE FROM sesiones WHERE usuario_id = ?", (usuario_id,))


def purgar_sesiones_vencidas(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM sesiones WHERE expira_en <= ?", (ahora(),))


def purgar_todas_las_sesiones(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM sesiones")
