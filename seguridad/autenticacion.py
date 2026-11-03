import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Any

from werkzeug.security import check_password_hash, generate_password_hash

from backend.config import FORMATO_FECHA, ahora

DURACION_SESION_HORAS = 8
VENTANA_ESCALADO_SEGUNDOS = 15 * 60  # Tras 15 min de vencido el bloqueo, el nivel decae a 0


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

def procesar_intento_login(
    conn: sqlite3.Connection,
    usuario_input: str,
    clave_input: str,
) -> tuple[bool, dict[str, Any], int]:
    """Procesa un intento de login aplicando bloqueo escalonado con decaimiento.

    Reglas de negocio:
    1. Si un usuario ingresa contraseña incorrecta 3 veces seguidas:
       Bloqueo automático por 1 minuto (Nivel 1).
    2. Si vuelve a fallar inmediatamente tras terminar la penalización (dentro de la ventana):
       El tiempo de bloqueo aumenta sumando 2 minutos más:
       Nivel 2: 1 + 2 = 3 minutos.
       Nivel 3: 3 + 2 = 5 minutos.
       Nivel k: 1 + 2*(k - 1) minutos.
    3. Si transcurrió la ventana de enfriamiento tras vencer el bloqueo, el nivel decae.
    4. Si el inicio de sesión es exitoso:
       Reinicia intentos_fallidos, bloqueado, tiempo_bloqueo y nivel_bloqueo a cero.
    """
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
        # Prevención de ataques de temporización
        check_password_hash("pbkdf2:sha256:1000000$dummy$dummy", clave_input)
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

    # 1. Comprobar si la cuenta tiene un bloqueo temporal activo o vencido
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

        # La penalización ya venció: limpiar bandera de bloqueo en base de datos
        segundos_desde_vencimiento = (ahora_dt - tiempo_bloqueo).total_seconds()
        if segundos_desde_vencimiento > VENTANA_ESCALADO_SEGUNDOS:
            # Si pasó suficiente tiempo desde el vencimiento, decae el nivel de bloqueo
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

    # 2. Verificar contraseña
    valida = verify_password(clave_input, fila["password_hash"])

    if valida:
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

    # 3. Contraseña incorrecta
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


# ------------------------------------------------------------------ #
#  Sesiones en SQLite                                                 #
# ------------------------------------------------------------------ #

def crear_sesion(conn: sqlite3.Connection, usuario_id: int) -> str:
    """Abre una sesión en la BD y devuelve un token criptográfico."""
    token = secrets.token_urlsafe(32)
    expira = datetime.now() + timedelta(hours=DURACION_SESION_HORAS)
    conn.execute(
        "INSERT INTO sesiones (token, usuario_id, creado_en, expira_en) "
        "VALUES (?, ?, ?, ?)",
        (token, usuario_id, ahora(), expira.strftime(FORMATO_FECHA)),
    )
    return token


def usuario_de_token(conn: sqlite3.Connection, token: str) -> sqlite3.Row | None:
    """Busca al usuario si el token de sesión existe en BD, no ha expirado y la cuenta está activa."""
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
