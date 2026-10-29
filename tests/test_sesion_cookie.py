
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import app
import db

cliente = app.test_client()

print("\n== PRUEBA DE SESIÓN EN SERVIDOR CON COOKIE (CERO LOCALSTORAGE) ==")

# 1. Servir Frontend
r_root = cliente.get("/")
assert r_root.status_code == 302, f"Redirección de raíz falló: {r_root.status_code}"
print("  OK   GET / -> 302 redirige al login")

r_login_html = cliente.get("/Login.html")
assert r_login_html.status_code == 200, f"Carga de Login.html falló: {r_login_html.status_code}"
assert b"Iniciar" in r_login_html.data, "Login.html no contiene formulario"
print("  OK   GET /Login.html -> 200 servido correctamente")

# 2. Intentar acceder a ruta protegida sin sesión ni cookie
r_yo_anon = cliente.get("/api/auth/yo")
assert r_yo_anon.status_code == 401, f"Sin sesión debió ser 401: {r_yo_anon.status_code}"
print("  OK   GET /api/auth/yo sin sesión -> 401 no autorizado")

# 3. Login con admin por defecto
r_login = cliente.post("/api/auth/login", json={"usuario": "admin", "clave": "admin123"})
assert r_login.status_code == 200, f"Login falló: {r_login.get_json()}"
set_cookie = r_login.headers.get("Set-Cookie", "")
assert "alexander_session=" in set_cookie, f"Falta cookie de sesión: {set_cookie}"
assert "HttpOnly" in set_cookie, f"Cookie debe ser HttpOnly: {set_cookie}"
print("  OK   POST /api/auth/login -> 200 establece cookie alexander_session con HttpOnly")

# 4. Acceder a /api/auth/yo SIN encabezado Authorization (utilizando únicamente la cookie de sesión)
r_yo_autenticado = cliente.get("/api/auth/yo")
assert r_yo_autenticado.status_code == 200, f"Acceso con cookie falló: {r_yo_autenticado.get_json()}"
datos_yo = r_yo_autenticado.get_json()
assert datos_yo["usuario"]["usuario"] == "admin"
assert datos_yo["usuario"]["rol"] == "ADMIN"
print("  OK   GET /api/auth/yo autenticado 100% por cookie de servidor (sin Bearer ni storage cliente)")

# 5. Acceder a productos y categorías solo con cookie
r_prods = cliente.get("/api/productos")
assert r_prods.status_code == 200, f"Productos con cookie falló: {r_prods.status_code}"
print("  OK   GET /api/productos -> 200 protegido y consumido solo con cookie")

# 6. Logout mediante cookie
r_logout = cliente.post("/api/auth/logout")
assert r_logout.status_code == 200, f"Logout falló: {r_logout.status_code}"
print("  OK   POST /api/auth/logout -> 200 sesión cerrada en servidor")

# 7. Comprobar que tras logout la cookie ya no tiene acceso
r_yo_tras_logout = cliente.get("/api/auth/yo")
assert r_yo_tras_logout.status_code == 401, f"Tras logout debió ser 401: {r_yo_tras_logout.status_code}"
print("  OK   GET /api/auth/yo tras logout -> 401 sesión revocada")

print("\n==============================================")
print("TODAS LAS PRUEBAS DE COOKIE Y SERVIDOR PASARON EXITOSAMENTE")

