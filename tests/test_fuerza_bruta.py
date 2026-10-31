"""Prueba de protección contra fuerza bruta y bloqueo escalonado.

Utiliza una base de datos temporal aislada para no tocar la base de datos de producción.
"""

import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

# Base de datos temporal aislada para esta corrida de pruebas
_tmp_db = Path(tempfile.gettempdir()) / f"test_fuerza_bruta_{os.getpid()}.db"
os.environ["TIENDA_DB_PATH"] = str(_tmp_db)

from app import app  # noqa: E402
import db  # noqa: E402
from seguridad import hash_password  # noqa: E402

try:
    db.inicializar_db()
    cliente = app.test_client()

    print("\n== INICIANDO PRUEBAS DE BLOQUEO ESCALONADO (DB AISLADA) ==")

    with db.conectar_db() as conn:
        conn.execute(
            "INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo, "
            "intentos_fallidos, bloqueado, nivel_bloqueo) "
            "VALUES ('Test Lockout', 'test_lockout', ?, 'VENDEDOR', 1, 0, 0, 0)",
            (hash_password("clave_correcta"),),
        )

    # 1. Intentos 1 y 2: fallos normales con contador decreciente
    r1 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala1"})
    assert r1.status_code == 401
    assert r1.get_json().get("intentos_restantes") == 2
    print("  OK   Intento fallido 1 -> 401, quedan 2 intentos")

    r2 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala2"})
    assert r2.status_code == 401
    assert r2.get_json().get("intentos_restantes") == 1
    print("  OK   Intento fallido 2 -> 401, queda 1 intento")

    # 2. Intento 3: bloqueo automático por 1 minuto (Nivel 1)
    r3 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala3"})
    assert r3.status_code == 403
    d3 = r3.get_json()
    assert d3.get("bloqueado") is True
    assert d3.get("nivel_bloqueo") == 1
    assert d3.get("minutos_bloqueo") == 1
    print("  OK   Intento fallido 3 -> 403, cuenta bloqueada por 1 minuto (Nivel 1)")

    # 3. Intento durante el período de bloqueo
    r_durante = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "clave_correcta"})
    assert r_durante.status_code == 403
    assert r_durante.get_json().get("bloqueado") is True
    print("  OK   Intento durante bloqueo -> 403 rechazado con tiempo restante")

    # 4. Simular que expira la penalización de 1 minuto (hace 10 segundos)
    with db.conectar_db() as conn:
        pasado = (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("UPDATE usuarios SET tiempo_bloqueo = ? WHERE usuario = 'test_lockout'", (pasado,))

    # 5. Fallar inmediatamente tras vencer la penalización -> Escalado a Nivel 2 (3 minutos)
    r_escalado1 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala4"})
    assert r_escalado1.status_code == 403
    d_esc1 = r_escalado1.get_json()
    assert d_esc1.get("nivel_bloqueo") == 2
    assert d_esc1.get("minutos_bloqueo") == 3
    print("  OK   Fallo inmediato tras penalización -> escalado a Nivel 2: 3 minutos (1+2m)")

    # 6. Simular que expira la penalización de Nivel 2
    with db.conectar_db() as conn:
        pasado = (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("UPDATE usuarios SET tiempo_bloqueo = ? WHERE usuario = 'test_lockout'", (pasado,))

    # 7. Volver a fallar -> Escalado a Nivel 3 (5 minutos)
    r_escalado2 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala5"})
    assert r_escalado2.status_code == 403
    d_esc2 = r_escalado2.get_json()
    assert d_esc2.get("nivel_bloqueo") == 3
    assert d_esc2.get("minutos_bloqueo") == 5
    print("  OK   Fallo inmediato tras segunda penalización -> escalado a Nivel 3: 5 minutos (3+2m)")

    # 8. Simular que expira la penalización y entrar con la contraseña correcta
    with db.conectar_db() as conn:
        pasado = (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("UPDATE usuarios SET tiempo_bloqueo = ? WHERE usuario = 'test_lockout'", (pasado,))

    r_exito = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "clave_correcta"})
    assert r_exito.status_code == 200
    assert r_exito.get_json().get("exito") is True

    with db.conectar_db() as conn:
        u = conn.execute(
            "SELECT intentos_fallidos, bloqueado, tiempo_bloqueo, nivel_bloqueo "
            "FROM usuarios WHERE usuario = 'test_lockout'"
        ).fetchone()

    assert u["intentos_fallidos"] == 0
    assert u["bloqueado"] == 0
    assert u["tiempo_bloqueo"] is None
    assert u["nivel_bloqueo"] == 0
    print("  OK   Login correcto restablece contadores a cero")

    print("\n==============================================")
    print("TODAS LAS PRUEBAS DE BLOQUEO ESCALONADO PASARON EXITOSAMENTE")
finally:
    _tmp_db.unlink(missing_ok=True)
