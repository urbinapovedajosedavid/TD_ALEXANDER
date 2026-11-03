"""Prueba de sesión en servidor con cookie HttpOnly respaldada en la tabla `sesiones`."""

import os
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

_tmp_db = Path(tempfile.gettempdir()) / f"test_sesion_cookie_{os.getpid()}.db"
os.environ["TIENDA_DB_PATH"] = str(_tmp_db)
os.environ["ADMIN_CLAVE"] = "admin123"

from app import app  # noqa: E402
import backend.db as db  # noqa: E402

try:
    db.inicializar_db()
    cliente = app.test_client()

    print("\n== PRUEBA DE SESIÓN EN SERVIDOR CON COOKIE Y TABLA `sesiones` ==")

    r_root = cliente.get("/")
    assert r_root.status_code == 302
    print("  OK   GET / -> 302 redirige al login")

    r_login_html = cliente.get("/Login.html")
    assert r_login_html.status_code == 200
    assert b"Iniciar" in r_login_html.data
    print("  OK   GET /Login.html -> 200 servido correctamente")

    r_yo_anon = cliente.get("/api/auth/yo")
    assert r_yo_anon.status_code == 401
    print("  OK   GET /api/auth/yo sin sesión -> 401 no autorizado")

    r_login = cliente.post("/api/auth/login", json={"usuario": "admin", "clave": "admin123"})
    assert r_login.status_code == 200
    set_cookie = r_login.headers.get("Set-Cookie", "")
    assert "alexander_session=" in set_cookie
    assert "HttpOnly" in set_cookie
    print("  OK   POST /api/auth/login -> 200 establece cookie alexander_session con HttpOnly")

    r_cambio_inicial = cliente.post(
        "/api/auth/cambiar-clave",
        json={
            "actual": "admin123",
            "nueva": "admin_cookie_123",
            "confirmacion": "admin_cookie_123",
        },
    )
    assert r_cambio_inicial.status_code == 200

    r_yo_autenticado = cliente.get("/api/auth/yo")
    assert r_yo_autenticado.status_code == 200
    datos_yo = r_yo_autenticado.get_json()
    assert datos_yo["usuario"]["usuario"] == "admin"
    assert datos_yo["usuario"]["rol"] == "ADMIN"
    print("  OK   GET /api/auth/yo autenticado por cookie respaldada en SQLite")

    r_prods = cliente.get("/api/productos")
    assert r_prods.status_code == 200
    print("  OK   GET /api/productos -> 200 protegido y consumido con cookie")

    # Verificar que si se purgan las sesiones en BD, la cookie queda revocada inmediatamente
    db.purgar_todas_las_sesiones()
    r_yo_revocado = cliente.get("/api/auth/yo")
    assert r_yo_revocado.status_code == 401
    print("  OK   Revocación en tabla `sesiones` invalida inmediatamente la cookie activa")

    # Nuevo login y logout normal
    cliente.post("/api/auth/login", json={"usuario": "admin", "clave": "admin_cookie_123"})
    r_logout = cliente.post("/api/auth/logout")
    assert r_logout.status_code == 200
    r_yo_tras_logout = cliente.get("/api/auth/yo")
    assert r_yo_tras_logout.status_code == 401
    print("  OK   POST /api/auth/logout -> 200 sesión revocada en BD y cookie")

    print("\n==============================================")
    print("TODAS LAS PRUEBAS DE COOKIE Y SERVIDOR PASARON EXITOSAMENTE")
finally:
    _tmp_db.unlink(missing_ok=True)
