"""Prueba de extremo a extremo del servidor contra la API real.

Uso:  python tests/test_api.py

Empieza siempre desde una base limpia, por lo que borra
database/tienda_alexander.db. Con eso el archivo se regenera al terminar.
"""

import sys
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "Backend"))

(RAIZ / "database" / "tienda_alexander.db").unlink(missing_ok=True)

import db  # noqa: E402
import server  # noqa: E402

fallos = []


def check(nombre, condicion, detalle=""):
    if condicion:
        print("  OK   %s" % nombre)
    else:
        print("  FALLA %s %s" % (nombre, detalle))
        fallos.append(nombre)


cliente = server.app.test_client()


def con(token):
    """Cabecera de autorización para un token dado."""
    return {"Authorization": "Bearer %s" % token}


def entrar(usuario, clave):
    r = cliente.post("/api/auth/login", json={"usuario": usuario, "clave": clave})
    return (r.get_json() or {}).get("token")


# ---------------------------------------------------------------- esquema

print("\n== esquema ==")
with db.conectar_db() as conn:
    tablas = {
        r["name"]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
    }
    cols_ventas = {c["name"] for c in conn.execute("PRAGMA table_info(ventas)")}

check("8 tablas creadas", len(tablas) == 8, sorted(tablas))
check("metodo_pago en ventas", "metodo_pago" in cols_ventas, cols_ventas)
check("tabla sesiones existe", "sesiones" in tablas, sorted(tablas))

# ---------------------------------------------------------------- sin sesion

print("\n== la API rechaza peticiones sin token ==")
protegidos = [
    ("get", "/api/categorias"),
    ("post", "/api/categorias"),
    ("get", "/api/productos"),
    ("post", "/api/productos"),
    ("put", "/api/productos/1"),
    ("delete", "/api/productos/1"),
    ("post", "/api/ventas"),
    ("get", "/api/ventas/1"),
    ("get", "/api/proveedores"),
    ("post", "/api/proveedores"),
    ("delete", "/api/proveedores/1"),
    ("get", "/api/reportes"),
    ("get", "/api/inventario/resumen"),
    ("get", "/api/usuarios"),
    ("post", "/api/auth/registro"),
    ("post", "/api/auth/logout"),
    ("post", "/api/auth/cambiar-clave"),
    ("delete", "/api/auth/cuenta"),
    ("get", "/api/auth/yo"),
    ("get", "/api/respaldos/descargar"),
    ("get", "/api/respaldos/info"),
    ("post", "/api/respaldos/restaurar"),
]
for metodo, ruta in protegidos:
    r = cliente.open(ruta, method=metodo.upper(), json={})
    check("%s %s sin token -> 401" % (metodo.upper(), ruta), r.status_code == 401,
          r.status_code)

r = cliente.get("/api/categorias", headers=con("token-inventado"))
check("token falso -> 401", r.status_code == 401, r.status_code)

r = cliente.get("/api/categorias", headers=con(""))
check("token vacio -> 401", r.status_code == 401, r.status_code)

# ---------------------------------------------------------------- login

print("\n== autenticacion ==")
r = cliente.post("/api/auth/login", json={"usuario": "admin", "clave": "mala"})
check("login con clave incorrecta -> 401", r.status_code == 401, r.status_code)

r = cliente.post("/api/auth/login", json={"usuario": "noexiste", "clave": "x"})
check("login usuario inexistente -> 401", r.status_code == 401, r.status_code)

r = cliente.post("/api/auth/login", json={"usuario": "", "clave": ""})
check("login sin datos -> 400", r.status_code == 400, r.status_code)

r = cliente.post("/api/auth/login", json={"usuario": "admin", "clave": "admin123"})
datos = r.get_json() or {}
check("login correcto", r.status_code == 200, r.get_json())
check("login devuelve token", bool(datos.get("token")), datos)
admin = datos["token"]
admin_id = datos["usuario"]["id"]
A = con(admin)

r = cliente.get("/api/auth/yo", headers=A)
check("auth/yo responde el usuario", r.status_code == 200 and
      r.get_json()["usuario"]["usuario"] == "admin", r.get_json())

# El token de admin sirve para datos de solo lectura.
r = cliente.get("/api/categorias", headers=A)
check("categorias con token", r.status_code == 200 and len(r.get_json()) == 3,
      r.status_code)

# ---------------------------------------------------------------- roles

print("\n== permisos por rol ==")
r = cliente.post("/api/auth/registro", headers=A,
                 json={"usuario": "vendedor1", "clave": "1234"})
check("admin crea vendedor", r.status_code == 201, r.get_json())

r = cliente.post("/api/auth/registro", headers=A,
                 json={"usuario": "vendedor1", "clave": "1234"})
check("usuario duplicado rechazado", r.status_code == 400, r.get_json())

vendedor = entrar("vendedor1", "1234")
check("login del vendedor nuevo", bool(vendedor))
V = con(vendedor)

r = cliente.post("/api/auth/registro", headers=V,
                 json={"usuario": "intruso", "clave": "1234"})
check("vendedor NO puede crear usuarios -> 403", r.status_code == 403, r.status_code)

r = cliente.get("/api/usuarios", headers=V)
check("vendedor NO puede listar usuarios -> 403", r.status_code == 403, r.status_code)

r = cliente.get("/api/usuarios", headers=A)
check("admin si puede listar usuarios", r.status_code == 200 and
      len(r.get_json()) >= 2, r.status_code)

r = cliente.post("/api/productos", headers=V, json={
    "nombre": "Articulo del vendedor", "precio": 5, "stock": 1})
check("vendedor si puede crear productos", r.status_code == 201, r.get_json())
id_vendedor_prod = r.get_json()["id"]
cliente.delete("/api/productos/%d" % id_vendedor_prod, headers=V)

# ---------------------------------------------------------------- logout

print("\n== cerrar sesion ==")
temporal = entrar("vendedor1", "1234")
r = cliente.post("/api/auth/logout", headers=con(temporal))
check("logout responde 200", r.status_code == 200, r.get_json())
r = cliente.get("/api/categorias", headers=con(temporal))
check("token revocado ya no sirve -> 401", r.status_code == 401, r.status_code)

# ---------------------------------------------------------------- cambiar clave

print("\n== cambiar contrasena ==")
r = cliente.post("/api/auth/cambiar-clave", headers=V,
                 json={"actual": "equivocada", "nueva": "nueva123"})
check("clave actual incorrecta -> 401", r.status_code == 401, r.get_json())

r = cliente.post("/api/auth/cambiar-clave", headers=V,
                 json={"actual": "1234", "nueva": "abc"})
check("nueva clave muy corta -> 400", r.status_code == 400, r.get_json())

r = cliente.post("/api/auth/cambiar-clave", headers=V,
                 json={"actual": "1234", "nueva": "1234"})
check("nueva clave igual a la actual -> 400", r.status_code == 400, r.get_json())

r = cliente.post("/api/auth/cambiar-clave", headers=V,
                 json={"actual": "1234", "nueva": "clave456"})
check("cambio de clave correcto", r.status_code == 200, r.get_json())

check("clave nueva sirve", entrar("vendedor1", "clave456") is not None)
check("clave vieja ya no sirve", entrar("vendedor1", "1234") is None)

# La sesion usada para el cambio sobrevive; otras sesiones del mismo usuario
# quedan revocadas.
r = cliente.get("/api/auth/yo", headers=V)
check("sesion del cambio sigue viva", r.status_code == 200, r.status_code)
vendedor = entrar("vendedor1", "clave456")
V = con(vendedor)
otra = con(entrar("vendedor1", "clave456"))
r = cliente.post("/api/auth/cambiar-clave", headers=otra,
                 json={"actual": "clave456", "nueva": "clave789"})
check("segundo cambio de clave", r.status_code == 200, r.get_json())
r = cliente.get("/api/auth/yo", headers=V)
check("la otra sesion fue revocada -> 401", r.status_code == 401, r.status_code)

# ---------------------------------------------------------------- categorias

print("\n== categorias ==")
r = cliente.post("/api/categorias", headers=A, json={"nombre": "Muebles"})
check("crear categoria", r.status_code == 201, r.get_json())
id_cat = r.get_json()["id"]

r = cliente.post("/api/categorias", headers=A, json={"nombre": "Muebles"})
check("categoria duplicada -> 409", r.status_code == 409, r.status_code)

r = cliente.post("/api/categorias", headers=A, json={"nombre": "  "})
check("categoria vacia -> 400", r.status_code == 400)

# ---------------------------------------------------------------- productos

print("\n== productos ==")
r = cliente.post("/api/productos", headers=A, json={
    "nombre": "Lavadora", "codigo": "7501234567890", "precio": 450.0,
    "stock": 4, "categoria_id": id_cat})
check("crear producto", r.status_code == 201, r.get_json())
id_p1 = r.get_json()["id"]

r = cliente.post("/api/productos", headers=A, json={
    "nombre": "Microondas", "codigo": "7509876543210", "precio": 120.5,
    "stock": 64, "categoria_id": id_cat})
check("crear producto 2", r.status_code == 201, r.get_json())
id_p2 = r.get_json()["id"]

r = cliente.post("/api/productos", headers=A, json={
    "nombre": "Exceso", "codigo": "X1", "precio": 10, "stock": 65})
check("stock > 64 -> 400", r.status_code == 400, r.status_code)

r = cliente.post("/api/productos", headers=A, json={
    "nombre": "A", "codigo": "X2", "precio": -5, "stock": 1})
check("precio negativo -> 400", r.status_code == 400)

r = cliente.post("/api/productos", headers=A, json={
    "nombre": "A", "codigo": "X3", "precio": "abc", "stock": 1})
check("precio no numerico -> 400", r.status_code == 400)

r = cliente.post("/api/productos", headers=A, json={
    "nombre": "Cafetera", "codigo": "7501234567890", "precio": 10, "stock": 1})
check("codigo duplicado al crear -> 409", r.status_code == 409, r.status_code)

r = cliente.get("/api/productos", headers=A)
prods = r.get_json()
check("listar productos", len(prods) == 2, len(prods))
check("categoria_nombre presente", prods[0]["categoria_nombre"] == "Muebles", prods[0])

r = cliente.put("/api/productos/%d" % id_p1, headers=A, json={
    "nombre": "Lavadora XL", "codigo": "7501234567890", "precio": 500.0,
    "stock": 10, "categoria_id": id_cat})
check("actualizar producto", r.status_code == 200, r.get_json())

# Esto antes devolvia 500: el UNIQUE de codigo_barra reventaba la peticion.
r = cliente.put("/api/productos/%d" % id_p1, headers=A, json={
    "nombre": "Lavadora XL", "codigo": "7509876543210", "precio": 500.0,
    "stock": 10, "categoria_id": id_cat})
check("actualizar con codigo duplicado -> 409 (no 500)", r.status_code == 409,
      (r.status_code, r.get_json()))

r = cliente.put("/api/productos/9999", headers=A, json={
    "nombre": "Fantasma", "codigo": "Z9", "precio": 1, "stock": 1})
check("actualizar inexistente -> 404", r.status_code == 404)

# ---------------------------------------------------------------- ventas

print("\n== ventas ==")
r = cliente.post("/api/ventas", headers=A, json={
    "metodo_pago": "efectivo",
    "items": [{"id": id_p1, "cantidad": 2}, {"id": id_p2, "cantidad": 1}]})
check("registrar venta", r.status_code == 201, r.get_json())
venta = r.get_json()
# subtotal = 2*500 + 1*120.5 = 1120.50 ; iva 15% = 168.08 ; total = 1288.58
check("subtotal correcto", venta["subtotal"] == 1120.50, venta)
check("iva correcto (redondeo half-up)", venta["impuesto"] == 168.08, venta)
check("total correcto", venta["total"] == 1288.58, venta)

# La respuesta trae el detalle para poder imprimir la factura sin volver a
# preguntar al servidor. El nombre y el precio salen de la base, no del cuerpo.
check("la venta devuelve su detalle", len(venta["items"]) == 2, venta.get("items"))
with db.conectar_db() as conn:
    nombre_p1 = conn.execute(
        "SELECT nombre FROM productos WHERE id=?", (id_p1,)
    ).fetchone()["nombre"]
check("el detalle trae el nombre del producto",
      venta["items"][0]["nombre"] == nombre_p1, (venta["items"][0], nombre_p1))
check("el detalle trae el precio real, no el que manda el cliente",
      venta["items"][0]["precio_unitario"] == 500.0, venta["items"][0])
check("el importe de cada linea cuadra",
      venta["items"][0]["subtotal"] == 1000.0, venta["items"][0])
check("la venta devuelve su fecha", bool(venta.get("fecha")), venta.get("fecha"))
check("la venta devuelve el metodo de pago",
      venta["metodo_pago"] == "efectivo", venta.get("metodo_pago"))
check("la suma del detalle es el subtotal",
      round(sum(i["subtotal"] for i in venta["items"]), 2) == venta["subtotal"], venta)

# Reimprimir una venta: GET /api/ventas/<id>
r = cliente.get("/api/ventas/%d" % venta["venta_id"], headers=A)
check("detalle de venta disponible", r.status_code == 200, r.get_json())
factura = r.get_json()
check("la factura trae los mismos totales",
      (factura["subtotal"], factura["impuesto"], factura["total"])
      == (1120.50, 168.08, 1288.58), factura)
check("la factura trae las dos lineas", len(factura["items"]) == 2, factura["items"])
check("la factura trae el vendedor", factura["vendedor"] == "Administrador",
      factura.get("vendedor"))
check("la factura trae el metodo de pago", factura["metodo_pago"] == "efectivo",
      factura.get("metodo_pago"))

r = cliente.get("/api/ventas/999999", headers=A)
check("venta inexistente -> 404", r.status_code == 404, r.get_json())
r = cliente.get("/api/ventas/abc", headers=A)
check("id de venta que no es numero -> 404", r.status_code == 404, r.status_code)

with db.conectar_db() as conn:
    stock1 = conn.execute("SELECT stock FROM productos WHERE id=?", (id_p1,)).fetchone()["stock"]
    stock2 = conn.execute("SELECT stock FROM productos WHERE id=?", (id_p2,)).fetchone()["stock"]
    fila_venta = conn.execute(
        "SELECT usuario_id, fecha FROM ventas WHERE id=?", (venta["venta_id"],)
    ).fetchone()
check("stock descontado p1", stock1 == 8, stock1)
check("stock descontado p2", stock2 == 63, stock2)
check("la venta se attribuye a la sesion, no al cuerpo",
      fila_venta["usuario_id"] == admin_id, fila_venta["usuario_id"])

# La fecha guardada debe ser hora local, no UTC. Con UTC, una venta de la
# tarde aparecia como del dia siguiente en los reportes de 'hoy'.
guardada = datetime.strptime(fila_venta["fecha"], "%Y-%m-%d %H:%M:%S")
desfase = abs((guardada - datetime.now()).total_seconds())
check("fecha de venta en hora local (desfase < 120s)", desfase < 120, desfase)

# usuario_id en el cuerpo ya no se respeta: la sesion manda.
# (El token de vendedor de antes quedo revocado al cambiar la clave.)
V = con(entrar("vendedor1", "clave789"))
r = cliente.post("/api/ventas", headers=V, json={
    "usuario_id": admin_id, "items": [{"id": id_p1, "cantidad": 1}]})
check("venta del vendedor aceptada", r.status_code == 201, r.get_json())
con_body = r.get_json()
with db.conectar_db() as conn:
    quien = conn.execute(
        "SELECT usuario_id FROM ventas WHERE id=?", (con_body["venta_id"],)
    ).fetchone()["usuario_id"]
check("usuario_id del cuerpo se ignora", quien != admin_id, quien)

r = cliente.post("/api/ventas", headers=A, json={"items": []})
check("carrito vacio -> 400", r.status_code == 400)

r = cliente.post("/api/ventas", headers=A, json={"items": [{"id": id_p1, "cantidad": 999}]})
check("stock insuficiente -> 400", r.status_code == 400)

r = cliente.post("/api/ventas", headers=A, json={"items": [{"id": 9999, "cantidad": 1}]})
check("producto inexistente -> 404", r.status_code == 404)

r = cliente.post("/api/ventas", headers=A, json={
    "items": [{"id": id_p1, "cantidad": 1}], "metodo_pago": "bitcoin"})
check("metodo de pago invalido -> 400", r.status_code == 400)

r = cliente.post("/api/ventas", headers=A, json={"items": [{"id": id_p1, "cantidad": 0}]})
check("cantidad 0 -> 400", r.status_code == 400)

r = cliente.post("/api/ventas", headers=A, json={"items": [{"id": id_p1, "cantidad": -3}]})
check("cantidad negativa -> 400", r.status_code == 400)

r = cliente.post("/api/ventas", headers=A, json={"items": [{"id": id_p1, "cantidad": "x"}]})
check("cantidad no numerica -> 400", r.status_code == 400)

# ---------------------------------------------------------------- proveedores

print("\n== proveedores ==")
r = cliente.post("/api/proveedores", headers=A, json={
    "nombre": "Distribuidora Alexander", "telefono": "8888-8888",
    "cedula": "001-000000-0000A", "direccion": "Calle 1", "departamento": "Managua"})
check("crear proveedor", r.status_code == 201, r.get_json())
id_prov = r.get_json()["id"]

r = cliente.post("/api/proveedores", headers=A, json={"nombre": "   "})
check("proveedor sin nombre -> 400", r.status_code == 400)

r = cliente.get("/api/proveedores", headers=A)
check("listar proveedores", len(r.get_json()) == 1, r.get_json())

# ---------------------------------------------------------------- reportes

print("\n== reportes ==")
r = cliente.get("/api/reportes?periodo=hoy", headers=A)
data = r.get_json()
check("kpis presentes", set(data["kpis"]) >= {
    "total_vendido", "cantidad_ventas", "productos_vendidos"}, data["kpis"])
check("total vendido", data["kpis"]["total_vendido"] == round(1288.58 + 575.00, 2),
      data["kpis"])
check("2 transacciones", data["kpis"]["cantidad_ventas"] == 2, data["kpis"])
check("4 unidades vendidas", data["kpis"]["productos_vendidos"] == 4, data["kpis"])
check("filas de venta", len(data["ventas"]) == 2, data["ventas"])
r = cliente.get("/api/reportes?periodo=mes", headers=A)
check("periodo mes responde", r.status_code == 200)

# ---------------------------------------------------------------- inventario

print("\n== resumen inventario ==")
r = cliente.get("/api/inventario/resumen", headers=A)
data = r.get_json()
check("total productos", data["total_productos"] == 2, data)
check("valor inventario", data["valor_inventario"] == round(7 * 500 + 63 * 120.5, 2), data)

# ---------------------------------------------------------------- eliminar cuenta

print("\n== eliminar cuenta ==")
# Vendedor con ventas: mismo motivo, sin confusiones de rol.
r = cliente.delete("/api/auth/cuenta", headers=V)
check("vendedor con ventas -> 409", r.status_code == 409, r.get_json())
check("el motivo es el historial de ventas",
      "ventas" in (r.get_json() or {}).get("mensaje", "").lower(), r.get_json())

# Usuario sin ventas: se puede dar de baja.
r = cliente.post("/api/auth/registro", headers=A,
                 json={"usuario": "temporal", "clave": "1234"})
check("crear usuario temporal", r.status_code == 201, r.get_json())
temporal = con(entrar("temporal", "1234"))
r = cliente.delete("/api/auth/cuenta", headers=temporal)
check("usuario sin ventas se elimina", r.status_code == 200, r.get_json())
check("usuario eliminado ya no entra", entrar("temporal", "1234") is None)

# Se crea un segundo admin para poder distinguir las dos reglas.
r = cliente.post("/api/auth/registro", headers=A,
                 json={"usuario": "admin2", "clave": "1234", "nombre": "B"})
check("crear segundo usuario", r.status_code == 201)
with db.conectar_db() as conn:
    conn.execute("UPDATE usuarios SET rol='ADMIN' WHERE usuario='admin2'")

# Ahora que hay otro admin, el bloqueo del admin original viene de sus ventas.
r = cliente.delete("/api/auth/cuenta", headers=A)
check("admin con ventas -> 409", r.status_code == 409, r.get_json())
check("el motivo es el historial de ventas",
      "ventas" in (r.get_json() or {}).get("mensaje", "").lower(), r.get_json())

# Admin2 no tiene ventas y hay otro admin: si puede borrarse.
admin2 = con(entrar("admin2", "1234"))
r = cliente.delete("/api/auth/cuenta", headers=admin2)
check("admin puede borrarse si hay otro admin", r.status_code == 200, r.get_json())
check("admin2 ya no puede entrar", entrar("admin2", "1234") is None)

# ---------------------------------------------------------------- borrar datos

print("\n== eliminar ==")
r = cliente.delete("/api/proveedores/%d" % id_prov, headers=A)
check("eliminar proveedor", r.status_code == 200, r.get_json())
r = cliente.delete("/api/proveedores/%d" % id_prov, headers=A)
check("eliminar proveedor 2 veces -> 404", r.status_code == 404)

r = cliente.delete("/api/productos/%d" % id_p2, headers=A)
check("eliminar producto vendido -> 409", r.status_code == 409, r.get_json())
check("producto vendido sigue existindo",
      any(p["id"] == id_p2 for p in cliente.get("/api/productos", headers=A).get_json()))

r = cliente.post("/api/productos", headers=A, json={
    "nombre": "Basurero", "codigo": "BAS-1", "precio": 8.0, "stock": 3})
id_p3 = r.get_json()["id"]
r = cliente.delete("/api/productos/%d" % id_p3, headers=A)
check("eliminar producto sin ventas", r.status_code == 200, r.get_json())
r = cliente.delete("/api/productos/%d" % id_p3, headers=A)
check("eliminar producto 2 veces -> 404", r.status_code == 404)

# ---------------------------------------------------------------- respaldos
print("\n== copias de seguridad ==")

r = cliente.get("/api/respaldos/info", headers=A)
check("info del respaldo responde", r.status_code == 200, r.status_code)
check("informa el tamaño de la base", (r.get_json() or {}).get("tamano_bytes", 0) > 0,
      r.get_json())

r = cliente.get("/api/respaldos/descargar", headers=A)
check("descargar respaldo -> 200", r.status_code == 200, r.status_code)
contenido = r.data
check("el archivo descargado pesa lo mismo que la base",
      len(contenido) > 0, len(contenido))
check("es un SQLite (empieza con la firma del formato)",
      contenido[:16] == b"SQLite format 3\x00", contenido[:16])

# El archivo debe abrirse y tener las tablas del sistema. sqlite3.connect no
# acepta un BytesIO, así que se pasa por un temporal.
import io  # noqa: E402
import sqlite3  # noqa: E402

verificacion = RAIZ / "database" / "_verificacion.db"
verificacion.write_bytes(contenido)
copia = sqlite3.connect(verificacion)
nombres = {f[0] for f in copia.execute(
    "SELECT name FROM sqlite_master WHERE type='table'")}
cuenta_productos = copia.execute("SELECT COUNT(*) FROM productos").fetchone()[0]
copia.close()
verificacion.unlink(missing_ok=True)
check("la copia trae las tablas del sistema",
      {"usuarios", "productos", "ventas", "sesiones"} <= nombres, sorted(nombres))
check("la copia trae los productos de las pruebas", cuenta_productos > 0,
      cuenta_productos)

# Restaurar con un archivo inválido no debe tocar la base.
r = cliente.post("/api/respaldos/restaurar", headers=A,
                 data={"archivo": (io.BytesIO(b"esto no es una base"),
                                   "roto.db")},
                 content_type="multipart/form-data")
check("restaurar un archivo inválido -> 400", r.status_code == 400, r.status_code)
check("el motivo está en el mensaje",
      "válida" in (r.get_json() or {}).get("mensaje", "").lower()
      or "dañado" in (r.get_json() or {}).get("mensaje", "").lower(),
      r.get_json())

# Un SQLite válido pero de otro programa (sin las tablas) tampoco.
ajeno_ruta = RAIZ / "database" / "_ajeno.db"
c_ajeno = sqlite3.connect(ajeno_ruta)
c_ajeno.execute("CREATE TABLE otra (id INTEGER)")
c_ajeno.commit()
c_ajeno.close()
ajeno = ajeno_ruta.read_bytes()
ajeno_ruta.unlink(missing_ok=True)
r = cliente.post("/api/respaldos/restaurar", headers=A,
                 data={"archivo": (io.BytesIO(ajeno), "ajeno.db")},
                 content_type="multipart/form-data")
check("restaurar un SQLite ajeno -> 400", r.status_code == 400, r.status_code)
check("dice que no es del sistema",
      "Alexander" in (r.get_json() or {}).get("mensaje", ""), r.get_json())

# Y una base sin administradores se rechaza: dejaría el sistema cerrado.
sin_admin_ruta = RAIZ / "database" / "_sin_admin.db"
c_sin = sqlite3.connect(sin_admin_ruta)
c_sin.executescript((RAIZ / "database" / "esquema.sql").read_text(encoding="utf-8"))
c_sin.execute("INSERT INTO usuarios (nombre, usuario, password_hash, rol) "
              "VALUES ('Vendedor', 'v', 'x', 'VENDEDOR')")
c_sin.commit()
c_sin.close()
sin_admin = sin_admin_ruta.read_bytes()
sin_admin_ruta.unlink(missing_ok=True)
r = cliente.post("/api/respaldos/restaurar", headers=A,
                 data={"archivo": (io.BytesIO(sin_admin), "sin_admin.db")},
                 content_type="multipart/form-data")
check("restaurar sin administradores -> 400", r.status_code == 400, r.status_code)
check("avisa que el sistema quedaría cerrado",
      "cerrado" in (r.get_json() or {}).get("mensaje", ""), r.get_json())

# Nada de lo anterior debe haber alterado la base real.
with db.conectar_db() as conn:
    siguen = conn.execute("SELECT COUNT(*) FROM productos").fetchone()[0]
check("los rechazos no tocaron la base", siguen > 0, siguen)
check("no quedaron archivos temporales",
      not db.RUTA_DB.with_suffix(".restaurando").exists(), "sobro el temporal")

# ---------------------------------------------------------------- ultimo admin
# Va al final porque limpia las ventas, y las pruebas de arriba las necesitan.
print("\n== no dejar el sistema sin administrador ==")
with db.conectar_db() as conn:
    quedan_admins = conn.execute(
        "SELECT COUNT(*) FROM usuarios WHERE rol='ADMIN'").fetchone()[0]
    conn.execute("DELETE FROM ventas")
check("solo queda un admin antes de la prueba", quedan_admins == 1, quedan_admins)

r = cliente.delete("/api/auth/cuenta", headers=A)
check("ultimo admin no puede borrarse -> 409", r.status_code == 409, r.get_json())
check("el motivo es ser el unico admin",
      "administrador" in (r.get_json() or {}).get("mensaje", "").lower(), r.get_json())

print("\n" + "=" * 46)
if fallos:
    print("FALLARON %d:" % len(fallos))
    for f in fallos:
        print("   - %s" % f)
    sys.exit(1)
print("TODAS LAS PRUEBAS PASARON")