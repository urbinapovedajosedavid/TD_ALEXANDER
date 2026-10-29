"""Prueba exhaustiva de protección contra fuerza bruta y bloqueo escalonado.

Reglas comprobadas:
1. 3 contraseñas incorrectas consecutivas bloquean la cuenta por 1 minuto (Nivel 1).
2. Durante el minuto de bloqueo, cualquier intento es rechazado con HTTP 403 y tiempo restante.
3. Si tras vencer el bloqueo vuelve a fallar la contraseña inmediatamente:
   - El tiempo de bloqueo aumenta sumando 2 minutos más:
     Nivel 2: 1 + 2 = 3 minutos.
     Nivel 3: 3 + 2 = 5 minutos.
4. Si el inicio de sesión es exitoso en cualquier momento, todos los contadores
   y niveles se reinician a cero.
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import app
import db

cliente = app.test_client()

print("\n== INICIANDO PRUEBAS DE BLOQUEO ESCALONADO ==")

# Asegurar usuario de prueba
with db.conectar_db() as conn:
    conn.execute("DELETE FROM usuarios WHERE usuario = 'test_lockout'")
    from seguridad import hash_password
    conn.execute(
        "INSERT INTO usuarios (nombre, usuario, password_hash, rol, intentos_fallidos, bloqueado, nivel_bloqueo) "
        "VALUES ('Test Lockout', 'test_lockout', ?, 'VENDEDOR', 0, 0, 0)",
        (hash_password("clave_correcta"),),
    )

# 1. Intentos 1 y 2: fallos normales con contador decreciente
r1 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala1"})
assert r1.status_code == 401, f"Intento 1 debió ser 401, fue {r1.status_code}"
d1 = r1.get_json()
assert d1.get("intentos_restantes") == 2, f"Esperaba 2 restantes: {d1}"
print("  OK   Intento fallido 1 -> 401, quedan 2 intentos")

r2 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala2"})
assert r2.status_code == 401, f"Intento 2 debió ser 401, fue {r2.status_code}"
d2 = r2.get_json()
assert d2.get("intentos_restantes") == 1, f"Esperaba 1 restante: {d2}"
print("  OK   Intento fallido 2 -> 401, queda 1 intento")

# 2. Intento 3: bloqueo automático por 1 minuto (Nivel 1)
r3 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala3"})
assert r3.status_code == 403, f"Intento 3 debió ser 403, fue {r3.status_code}"
d3 = r3.get_json()
assert d3.get("bloqueado") is True, f"Esperaba bloqueado=True: {d3}"
assert d3.get("nivel_bloqueo") == 1, f"Esperaba nivel 1: {d3}"
assert d3.get("minutos_bloqueo") == 1, f"Esperaba 1 minuto: {d3}"
print("  OK   Intento fallido 3 -> 403, cuenta bloqueada por 1 minuto (Nivel 1)")

# 3. Intento durante el período de bloqueo
r_durante = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "clave_correcta"})
assert r_durante.status_code == 403, f"Durante bloqueo debió ser 403, fue {r_durante.status_code}"
d_durante = r_durante.get_json()
assert d_durante.get("bloqueado") is True, f"Esperaba bloqueado=True: {d_durante}"
assert "bloqueada" in d_durante.get("mensaje", "").lower(), f"Mensaje incorrecto: {d_durante}"
print("  OK   Intento durante bloqueo -> 403 rechazado con tiempo restante")

# 4. Simular que expira la penalización de 1 minuto (avanzar tiempo_bloqueo al pasado)
with db.conectar_db() as conn:
    pasado = (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("UPDATE usuarios SET tiempo_bloqueo = ? WHERE usuario = 'test_lockout'", (pasado,))

# 5. Fallar inmediatamente tras vencer la penalización -> Escalado a Nivel 2 (+2m = 3 minutos)
r_escalado1 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala4"})
assert r_escalado1.status_code == 403, f"Fallo tras penalización debió ser 403, fue {r_escalado1.status_code}"
d_esc1 = r_escalado1.get_json()
assert d_esc1.get("nivel_bloqueo") == 2, f"Esperaba nivel 2: {d_esc1}"
assert d_esc1.get("minutos_bloqueo") == 3, f"Esperaba 3 minutos (1+2): {d_esc1}"
print("  OK   Fallo inmediato tras penalización -> escalado a Nivel 2: 3 minutos (1+2m)")

# 6. Simular que expira la penalización de Nivel 2
with db.conectar_db() as conn:
    pasado = (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("UPDATE usuarios SET tiempo_bloqueo = ? WHERE usuario = 'test_lockout'", (pasado,))

# 7. Volver a fallar -> Escalado a Nivel 3 (+2m = 5 minutos)
r_escalado2 = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "mala5"})
assert r_escalado2.status_code == 403, f"Segundo fallo debió ser 403, fue {r_escalado2.status_code}"
d_esc2 = r_escalado2.get_json()
assert d_esc2.get("nivel_bloqueo") == 3, f"Esperaba nivel 3: {d_esc2}"
assert d_esc2.get("minutos_bloqueo") == 5, f"Esperaba 5 minutos (3+2): {d_esc2}"
print("  OK   Fallo inmediato tras segunda penalización -> escalado a Nivel 3: 5 minutos (3+2m)")

# 8. Simular que expira la penalización de Nivel 3 y entrar con la contraseña correcta
with db.conectar_db() as conn:
    pasado = (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("UPDATE usuarios SET tiempo_bloqueo = ? WHERE usuario = 'test_lockout'", (pasado,))

r_exito = cliente.post("/api/auth/login", json={"usuario": "test_lockout", "clave": "clave_correcta"})
assert r_exito.status_code == 200, f"Login con clave correcta debió ser 200: {r_exito.get_json()}"
d_exito = r_exito.get_json()
assert d_exito.get("exito") is True

# Verificar en base de datos que todos los contadores se reiniciaron
with db.conectar_db() as conn:
    u = conn.execute(
        "SELECT intentos_fallidos, bloqueado, tiempo_bloqueo, nivel_bloqueo "
        "FROM usuarios WHERE usuario = 'test_lockout'"
    ).fetchone()

assert u["intentos_fallidos"] == 0, f"intentos_fallidos debió ser 0, es {u['intentos_fallidos']}"
assert u["bloqueado"] == 0, f"bloqueado debió ser 0, es {u['bloqueado']}"
assert u["tiempo_bloqueo"] is None, f"tiempo_bloqueo debió ser None, es {u['tiempo_bloqueo']}"
assert u["nivel_bloqueo"] == 0, f"nivel_bloqueo debió ser 0, es {u['nivel_bloqueo']}"
print("  OK   Login correcto restablece intentos_fallidos=0, bloqueado=0, tiempo_bloqueo=None, nivel_bloqueo=0")

# Limpiar usuario de prueba
with db.conectar_db() as conn:
    conn.execute("DELETE FROM usuarios WHERE usuario = 'test_lockout'")

print("\n==============================================")
print("TODAS LAS PRUEBAS DE BLOQUEO ESCALONADO PASARON EXITOSAMENTE")

