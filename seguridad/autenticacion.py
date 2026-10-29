"""seguridad.autenticacion
========================
Hashing con werkzeug.security, sesiones de base de datos y
protección contra fuerza bruta con bloqueo escalonado.
"""

import secrets
import sqlite3
from datetime import datetime, timedelta

from werkzeug.security import check_password_hash, generate_password_hash

DURACION_SESION_HORAS = 8
FORMATO_FECHA = "%Y-%m-%d %H:%M:%S"


def ahora() -> str:
    """Marca de tiempo local en el formato estándar."""
    return datetime.now().strftime(FORMATO_FECHA)


# ------------------------------------------------------------------ #
#  Contraseñas con werkzeug.security                                  #
# ------------------------------------------------------------------ #

def hash_password(clave: str) -> str:
    """Genera hash seguro PBKDF2-SHA-256 usando werkzeug.security."""
    return generate_password_hash(clave, method="pbkdf2:sha256", salt_length=16)


def verify_password(clave: str, almacenado: str) -> bool:
    """Verifica una contraseña contra un hash almacenado."""
    if not almacenado:
        return False

    if almacenado.startswith("pbkdf2:"):
        return check_password_hash(almacenado, clave)

    # Compatibilidad con hashes previos pbkdf2$<sal>$<hash> si existieran
    if almacenado.startswith("pbkdf2$"):
        import hashlib
        import hmac as _hmac
        try:
            _, sal_hex, esperado_hex = almacenado.split("$", 2)
            derivada = hashlib.pbkdf2_hmac(
                "sha256", clave.encode(), bytes.fromhex(sal_hex), 200_000
            )
            return _hmac.compare_digest(derivada.hex(), esperado_hex)
        except Exception:
            return False

    return False


# ------------------------------------------------------------------ #
#  Protección contra fuerza bruta (Bloqueo Escalonado)                #
# ------------------------------------------------------------------ #

def procesar_intento_login(conn: sqlite3.Connection, usuario_input: str, clave_input: str):
    """Procesa un intento de login aplicando bloqueo escalonado.

    Reglas de negocio:
    1. Si un usuario ingresa contraseña incorrecta 3 veces seguidas:
       Bloqueo automático por 1 minuto (Nivel 1).
    2. Si vuelve a fallar inmediatamente tras terminar la penalización:
       El tiempo de bloqueo aumenta sumando 2 minutos más:
       Nivel 2: 1 + 2 = 3 minutos.
       Nivel 3: 3 + 2 = 5 minutos.
       Nivel k: 1 + 2*(k - 1) minutos.
    3. Si el inicio de sesión es exitoso:
       Reinicia intentos_fallidos, bloqueado, tiempo_bloqueo y nivel_bloqueo a cero.

    Retorna: (exito: bool, datos_o_error: dict, codigo_http: int)
    """
    usuario_input = (usuario_input or "").strip()
    clave_input = clave_input or ""

    if not usuario_input or not clave_input:
        return False, {"mensaje": "Usuario y contraseña son obligatorios."}, 400

    fila = conn.execute(
        "SELECT id, nombre, usuario, rol, password_hash, "
        "intentos_fallidos, bloqueado, tiempo_bloqueo, nivel_bloqueo "
        "FROM usuarios WHERE usuario = ? COLLATE NOCASE",
        (usuario_input,),
    ).fetchone()

    if fila is None:
        # Prevención de ataques de temporización
        check_password_hash("pbkdf2:sha256:1000000$dummy$dummy", clave_input)
        return False, {"mensaje": "Usuario o contraseña incorrectos."}, 401

    user_id = fila["id"]
    intentos = fila["intentos_fallidos"] or 0
    bloqueado = fila["bloqueado"] or 0
    tiempo_bloqueo_str = fila["tiempo_bloqueo"]
    nivel = fila["nivel_bloqueo"] or 0
    ahora_dt = datetime.now()

    # 1. Comprobar si la cuenta está actualmente bloqueada
    if bloqueado and tiempo_bloqueo_str:
        try:
            tiempo_bloqueo = datetime.strptime(tiempo_bloqueo_str, FORMATO_FECHA)
        except ValueError:
            tiempo_bloqueo = ahora_dt

        if ahora_dt < tiempo_bloqueo:
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
        else:
            # La penalización expiró para este nuevo intento
            bloqueado = 0

    # 2. Verificar contraseña
    valida = verify_password(clave_input, fila["password_hash"])

    if valida:
        # ÉXITO: reiniciar contadores a cero
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
            },
            200,
        )

    # 3. CONTRASEÑA INCORRECTA
    if nivel > 0:
        # Vuelve a fallar inmediatamente tras terminar la penalización
        nuevo_nivel = nivel + 1
        # Nivel 1 = 1m; Nivel 2 = 1+2 = 3m; Nivel 3 = 3+2 = 5m...
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
    else:
        nuevos_intentos = intentos + 1
        if nuevos_intentos >= 3:
            # 3 intentos fallidos consecutivos: bloqueo automático por 1 minuto
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
        else:
            conn.execute(
                "UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?",
                (nuevos_intentos, user_id),
            )
            restantes = 3 - nuevos_intentos
            return (
                False,
                {
                    "mensaje": f"Usuario o contraseña incorrectos. Intentos restantes antes del bloqueo: {restantes}.",
                    "bloqueado": False,
                    "intentos_restantes": restantes,
                },
                401,
            )


# ------------------------------------------------------------------ #
#  Sesiones en SQLite                                                 #
# ------------------------------------------------------------------ #

def crear_sesion(conn: sqlite3.Connection, usuario_id: int) -> str:
    """Abre una sesión en la BD y devuelve un token opaco."""
    token = secrets.token_urlsafe(32)
    expira = datetime.now() + timedelta(hours=DURACION_SESION_HORAS)
    conn.execute(
        "INSERT INTO sesiones (token, usuario_id, creado_en, expira_en) "
        "VALUES (?, ?, ?, ?)",
        (token, usuario_id, ahora(), expira.strftime(FORMATO_FECHA)),
    )
    return token


def usuario_de_token(conn: sqlite3.Connection, token: str):
    """Busca al usuario si el token es válido y no ha expirado."""
    if not token:
        return None
    return conn.execute(
        "SELECT u.id, u.nombre, u.usuario, u.rol, u.bloqueado FROM sesiones s "
        "JOIN usuarios u ON u.id = s.usuario_id "
        "WHERE s.token = ? AND s.expira_en > ? AND u.bloqueado = 0",
        (token, ahora()),
    ).fetchone()


def revocar_sesion(conn: sqlite3.Connection, token: str) -> None:
    conn.execute("DELETE FROM sesiones WHERE token = ?", (token,))


def revocar_sesiones_de_usuario(conn: sqlite3.Connection, usuario_id: int) -> None:
    conn.execute("DELETE FROM sesiones WHERE usuario_id = ?", (usuario_id,))


def purgar_sesiones_vencidas(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM sesiones WHERE expira_en <= ?", (ahora(),))


def purgar_todas_las_sesiones(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM sesiones")
