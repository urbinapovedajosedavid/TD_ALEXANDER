import io
import sqlite3
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from functools import wraps

from flask import Flask, g, jsonify, request, send_file
from flask_cors import CORS

import db

app = Flask(__name__)
CORS(app)

STOCK_MAXIMO = 64
IVA = 0.15  # 15 %
METODOS_PAGO = ("efectivo", "tarjeta", "transferencia")

db.inicializar_db()


# ---------- Utilidades compartidas ----------

def error(mensaje, estado=400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def cuerpo_json():
    """request.json normalizado; devuelve {} si el cuerpo viene vacío."""
    return request.get_json(silent=True) or {}


def token_de_peticion():
    """Lee el token del encabezado Authorization: Bearer <token>."""
    encabezado = request.headers.get("Authorization", "")
    if encabezado.startswith("Bearer "):
        return encabezado[7:].strip()
    return ""


def requiere_auth(funcion):
    """Exige una sesión válida.

    Antes esta comprobación solo vivía en el navegador: la API respondía
    igual a cualquiera que la llamara por HTTP. Ahora el servidor es quien
    decide, y el frontend solo se encarga de reaccionar al 401.
    """

    @wraps(funcion)
    def envoltura(*args, **kwargs):
        with db.conectar_db() as conn:
            usuario = db.usuario_de_token(conn, token_de_peticion())

        if usuario is None:
            return error("Sesión no válida o vencida. Vuelve a iniciar sesión.", 401)

        g.usuario = dict(usuario)
        return funcion(*args, **kwargs)

    return envoltura


def requiere_admin(funcion):
    """Como requiere_auth, pero además exige el rol ADMIN."""

    @wraps(funcion)
    @requiere_auth
    def envoltura(*args, **kwargs):
        if g.usuario["rol"] != "ADMIN":
            return error("Necesitas permisos de administrador para esta acción.", 403)
        return funcion(*args, **kwargs)

    return envoltura


def fila_producto(f):
    """Mapeo único de la consulta de productos hacia el JSON del cliente."""
    return {
        "id": f["id"],
        "codigo": f["codigo_barra"],
        "nombre": f["nombre"],
        "precio": f["precio"],
        "stock": f["stock"],
        "categoria_id": f["categoria_id"],
        "categoria_nombre": f["categoria_nombre"] or "Sin Categoría",
    }


def rango_periodo(periodo):
    """Traduce 'hoy' | 'semana' | 'mes' a una fecha de corte inclusiva."""
    ahora = datetime.now()
    if periodo == "semana":
        return ahora - timedelta(days=7)
    if periodo == "mes":
        return ahora - timedelta(days=30)
    return ahora.replace(hour=0, minute=0, second=0, microsecond=0)


def dinero(valor) -> float:
    """Redondeo monetario con ROUND_HALF_UP.

    El round() de Python usa redondeo a pares, así que 168.075 se va a
    168.07. Para facturas eso descuadra un centavo, por eso se usa Decimal.
    """
    return float(Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


# ---------- Autenticación ----------

@app.post("/api/auth/login")
def login():
    datos = cuerpo_json()
    usuario = (datos.get("usuario") or "").strip()
    clave = datos.get("clave") or ""

    if not usuario or not clave:
        return error("Usuario y contraseña son obligatorios.")

    with db.conectar_db() as conn:
        fila = conn.execute(
            "SELECT id, nombre, usuario, rol, password_hash FROM usuarios "
            "WHERE usuario = ? COLLATE NOCASE",
            (usuario,),
        ).fetchone()

        # Mismo mensaje para usuario inexistente y clave incorrecta: no revela
        # qué cuentas existen.
        if fila is None or not db.verify_password(clave, fila["password_hash"]):
            return error("Usuario o contraseña incorrectos.", 401)

        db.purgar_sesiones_vencidas(conn)
        token = db.crear_sesion(conn, fila["id"])

    return jsonify({
        "exito": True,
        "token": token,
        "usuario": {
            "id": fila["id"],
            "nombre": fila["nombre"],
            "usuario": fila["usuario"],
            "rol": fila["rol"],
        },
    })


@app.get("/api/auth/yo")
@requiere_auth
def quien_soy():
    """Confirma la sesión al abrir cada página."""
    return jsonify({"exito": True, "usuario": g.usuario})


@app.post("/api/auth/logout")
@requiere_auth
def cerrar_sesion():
    with db.conectar_db() as conn:
        db.revocar_sesion(conn, token_de_peticion())
    return jsonify({"exito": True, "mensaje": "Sesión cerrada."})


@app.post("/api/auth/cambiar-clave")
@requiere_auth
def cambiar_clave():
    """Cambia la contraseña de la cuenta conectada y cierra sus otras sesiones."""
    datos = cuerpo_json()
    actual = datos.get("actual") or ""
    nueva = datos.get("nueva") or ""

    if len(nueva) < 4:
        return error("La nueva clave debe tener al menos 4 caracteres.")
    if nueva == actual:
        return error("La nueva clave debe ser distinta de la actual.")

    token_actual = token_de_peticion()
    with db.conectar_db() as conn:
        fila = conn.execute(
            "SELECT password_hash FROM usuarios WHERE id = ?", (g.usuario["id"],)
        ).fetchone()

        if not db.verify_password(actual, fila["password_hash"]):
            return error("La clave actual no es correcta.", 401)

        conn.execute(
            "UPDATE usuarios SET password_hash = ? WHERE id = ?",
            (db.hash_password(nueva), g.usuario["id"]),
        )
        # Se conserva solo la sesión desde la que se hizo el cambio.
        conn.execute(
            "DELETE FROM sesiones WHERE usuario_id = ? AND token <> ?",
            (g.usuario["id"], token_actual),
        )

    return jsonify({"exito": True, "mensaje": "Contraseña actualizada."})


@app.delete("/api/auth/cuenta")
@requiere_auth
def eliminar_cuenta_propia():
    """Da de baja la cuenta conectada.

    No se permite eliminar al último administrador, porque el sistema se
    quedaría sin ninguna cuenta capaz de administrar usuarios.
    """
    with db.conectar_db() as conn:
        admin = conn.execute(
            "SELECT 1 FROM usuarios WHERE rol = 'ADMIN' AND id <> ? LIMIT 1",
            (g.usuario["id"],),
        ).fetchone()

        if g.usuario["rol"] == "ADMIN" and admin is None:
            return error(
                "No puedes eliminar la única cuenta de administrador del sistema.",
                409,
            )

        # ventas.usuario_id no tiene ON DELETE: un usuario que ya vendió no
        # puede desaparecer sin dejar las facturas sin vendedor.
        if conn.execute(
            "SELECT 1 FROM ventas WHERE usuario_id = ? LIMIT 1", (g.usuario["id"],)
        ).fetchone():
            return error(
                "Esta cuenta ya tiene ventas registradas y no se puede eliminar. "
                "Pedí a un administrador que la desactive.",
                409,
            )

        conn.execute("DELETE FROM usuarios WHERE id = ?", (g.usuario["id"],))

    return jsonify({"exito": True, "mensaje": "Cuenta eliminada."})


@app.post("/api/auth/registro")
@requiere_admin
def registrar_usuario():
    datos = cuerpo_json()
    usuario = (datos.get("usuario") or "").strip()
    clave = datos.get("clave") or ""
    nombre = (datos.get("nombre") or "").strip()

    if len(usuario) < 3:
        return error("El usuario debe tener al menos 3 caracteres.")
    if len(clave) < 4:
        return error("La clave debe tener al menos 4 caracteres.")

    with db.conectar_db() as conn:
        existe = conn.execute(
            "SELECT 1 FROM usuarios WHERE usuario = ? COLLATE NOCASE", (usuario,)
        ).fetchone()
        if existe:
            return error("Ese usuario ya existe, ingrese otro usuario.")

        cur = conn.execute(
            "INSERT INTO usuarios (nombre, usuario, password_hash, rol) "
            "VALUES (?, ?, ?, 'VENDEDOR')",
            (nombre or usuario, usuario, db.hash_password(clave)),
        )
        nuevo_id = cur.lastrowid

    return jsonify({
        "exito": True,
        "mensaje": f"Usuario {usuario} agregado.",
        "id": nuevo_id,
    }), 201


@app.get("/api/usuarios")
@requiere_admin
def listar_usuarios():
    with db.conectar_db() as conn:
        filas = conn.execute(
            "SELECT id, nombre, usuario, rol, creado_en FROM usuarios ORDER BY id"
        ).fetchall()

    return jsonify([
        {
            "id": f["id"],
            "nombre": f["nombre"],
            "usuario": f["usuario"],
            "rol": f["rol"],
            "creado_en": f["creado_en"],
        }
        for f in filas
    ])


# ---------- Categorías ----------

@app.get("/api/categorias")
@requiere_auth
def obtener_categorias():
    with db.conectar_db() as conn:
        filas = conn.execute(
            "SELECT id, nombre FROM categorias ORDER BY nombre"
        ).fetchall()
    return jsonify([{"id": f["id"], "nombre": f["nombre"]} for f in filas])


@app.post("/api/categorias")
@requiere_auth
def crear_categoria():
    nombre = (cuerpo_json().get("nombre") or "").strip()
    if not nombre:
        return error("El nombre de la categoría es obligatorio.")

    try:
        with db.conectar_db() as conn:
            cur = conn.execute("INSERT INTO categorias (nombre) VALUES (?)", (nombre,))
            nuevo_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return error(f"La categoría '{nombre}' ya existe.", 409)

    return jsonify({"exito": True, "id": nuevo_id, "nombre": nombre}), 201


# ---------- Productos ----------

@app.get("/api/productos")
@requiere_auth
def obtener_productos():
    with db.conectar_db() as conn:
        filas = conn.execute("""
            SELECT p.id, p.codigo_barra, p.nombre, p.precio, p.stock,
                   p.categoria_id, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.nombre
        """).fetchall()
    return jsonify([fila_producto(f) for f in filas])


def _validar_producto(datos):
    """Devuelve (limpios, mensaje_de_error)."""
    nombre = (datos.get("nombre") or "").strip()
    if len(nombre) < 2:
        return None, "El nombre debe tener al menos 2 caracteres."

    try:
        precio = float(datos.get("precio"))
    except (TypeError, ValueError):
        return None, "El precio debe ser un número mayor que 0."
    if precio <= 0:
        return None, "El precio debe ser un número mayor que 0."

    try:
        stock = int(datos.get("stock"))
    except (TypeError, ValueError):
        return None, "El stock debe ser un número entero igual o mayor a 0."
    if stock < 0:
        return None, "El stock debe ser un número entero igual o mayor a 0."
    if stock > STOCK_MAXIMO:
        return None, f"El stock no puede superar las {STOCK_MAXIMO} unidades."

    categoria_id = datos.get("categoria_id")
    try:
        categoria_id = int(categoria_id) if categoria_id else None
    except (TypeError, ValueError):
        return None, "La categoría seleccionada no es válida."

    codigo = (datos.get("codigo") or "").strip() or None
    return {
        "nombre": nombre,
        "codigo": codigo,
        "precio": precio,
        "stock": stock,
        "categoria_id": categoria_id,
    }, None


@app.post("/api/productos")
@requiere_auth
def crear_producto():
    datos, problema = _validar_producto(cuerpo_json())
    if problema:
        return error(problema)

    try:
        with db.conectar_db() as conn:
            cur = conn.execute(
                "INSERT INTO productos (codigo_barra, nombre, precio, stock, categoria_id) "
                "VALUES (:codigo, :nombre, :precio, :stock, :categoria_id)",
                datos,
            )
            nuevo_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return error("Ese código de barras ya está registrado en otro producto.", 409)

    return jsonify({"exito": True, "mensaje": "Producto guardado.", "id": nuevo_id}), 201


@app.put("/api/productos/<int:id_producto>")
@requiere_auth
def actualizar_producto(id_producto):
    datos, problema = _validar_producto(cuerpo_json())
    if problema:
        return error(problema)

    try:
        with db.conectar_db() as conn:
            existe = conn.execute(
                "SELECT 1 FROM productos WHERE id = ?", (id_producto,)
            ).fetchone()
            if not existe:
                return error("Producto no encontrado.", 404)

            # El UNIQUE de codigo_barra salta aquí igual que al crear, y sin
            # este try el servidor respondía 500 en vez de explicar el choque.
            conn.execute(
                "UPDATE productos SET codigo_barra = :codigo, nombre = :nombre, "
                "precio = :precio, stock = :stock, categoria_id = :categoria_id "
                "WHERE id = :id",
                {**datos, "id": id_producto},
            )
    except sqlite3.IntegrityError:
        return error("Ese código de barras ya está registrado en otro producto.", 409)

    return jsonify({"exito": True, "mensaje": "Producto actualizado correctamente."})


@app.delete("/api/productos/<int:id_producto>")
@requiere_auth
def eliminar_producto(id_producto):
    """Borra el producto del inventario.

    Si ya se vendió, sus filas en detalle_ventas quedan con producto_id en
    NULL (ON DELETE SET NULL) pero conservan el nombre y el precio que se
    cobraron: la factura de aquella venta sigue diciendo exactamente lo que
    dijo. Borrar el producto no toca el historial.
    """
    with db.conectar_db() as conn:
        existe = conn.execute(
            "SELECT 1 FROM productos WHERE id = ?", (id_producto,)
        ).fetchone()
        if not existe:
            return error("Producto no encontrado.", 404)

        conn.execute("DELETE FROM productos WHERE id = ?", (id_producto,))

    return jsonify({"exito": True, "mensaje": "Producto eliminado correctamente."})


# ---------- Ventas ----------

@app.post("/api/ventas")
@requiere_auth
def registrar_venta():
    """Registra la venta y descuenta stock en una sola transacción.

    El usuario de la venta sale de la sesión (g.usuario), no del cuerpo de la
    petición: si el cliente pudiera mandar usuario_id, cualquiera podría
    registrar ventas a nombre de otro.
    """
    datos = cuerpo_json()
    metodo_pago = datos.get("metodo_pago", "efectivo")
    cliente_id = datos.get("cliente_id")
    items = datos.get("items") or []

    if metodo_pago not in METODOS_PAGO:
        return error("Método de pago no válido.")
    if not items:
        return error("El carrito de ventas está vacío.")

    usuario_id = g.usuario["id"]

    try:
        cliente_id = int(cliente_id) if cliente_id else None
    except (TypeError, ValueError):
        cliente_id = None

    with db.conectar_db() as conn:

        total = Decimal("0")
        # El detalle se arma con lo que lee el servidor, no con el cuerpo de
        # la petición: el cliente solo manda id y cantidad, y el precio que
        # queda en la factura tiene que ser el que se cobró de verdad.
        detalle = []
        for item in items:
            try:
                cantidad = int(item.get("cantidad"))
            except (TypeError, ValueError):
                return error("Cantidad inválida en el carrito.")
            if cantidad <= 0:
                return error("Cantidad inválida en el carrito.")

            producto = conn.execute(
                "SELECT id, nombre, precio, stock FROM productos WHERE id = ?",
                (item.get("id"),),
            ).fetchone()
            if producto is None:
                return error(f"El producto con ID {item.get('id')} no existe.", 404)
            if producto["stock"] < cantidad:
                return error(
                    f"Stock insuficiente para '{producto['nombre']}'. "
                    f"Disponible: {producto['stock']}."
                )

            precio = Decimal(str(producto["precio"]))
            total += precio * cantidad
            detalle.append({
                "id": producto["id"],
                "nombre": producto["nombre"],
                "cantidad": cantidad,
                "precio_unitario": float(producto["precio"]),
                "subtotal": dinero(precio * cantidad),
            })

        subtotal_valor = dinero(total)
        impuesto_valor = dinero(Decimal(str(subtotal_valor)) * Decimal(str(IVA)))
        total_valor = dinero(Decimal(str(subtotal_valor)) + Decimal(str(impuesto_valor)))

        fecha_venta = db.ahora()
        cur = conn.execute(
            "INSERT INTO ventas (cliente_id, usuario_id, fecha, total, metodo_pago) "
            "VALUES (?, ?, ?, ?, ?)",
            (cliente_id, usuario_id, fecha_venta, total_valor, metodo_pago),
        )
        venta_id = cur.lastrowid

        for linea in detalle:
            conn.execute(
                "INSERT INTO detalle_ventas "
                "(venta_id, producto_id, nombre_producto, cantidad, precio_unitario) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    venta_id,
                    linea["id"],
                    linea["nombre"],
                    linea["cantidad"],
                    linea["precio_unitario"],
                ),
            )
            conn.execute(
                "UPDATE productos SET stock = stock - ? WHERE id = ?",
                (linea["cantidad"], linea["id"]),
            )

    return jsonify({
        "exito": True,
        "mensaje": "Venta realizada con éxito.",
        "venta_id": venta_id,
        "fecha": fecha_venta,
        "metodo_pago": metodo_pago,
        "subtotal": subtotal_valor,
        "impuesto": impuesto_valor,
        "total": total_valor,
        "items": detalle,
    }), 201


@app.get("/api/ventas/<int:venta_id>")
@requiere_auth
def obtener_venta(venta_id):
    """Una venta con su detalle, para poder reimprimir la factura.

    El subtotal no está guardado en la tabla `ventas`: sale de la suma del
    detalle, que es la misma operación con la que se creó la venta.
    """
    with db.conectar_db() as conn:
        venta = conn.execute(
            "SELECT v.id, v.fecha, v.total, v.metodo_pago, u.nombre AS vendedor "
            "FROM ventas v JOIN usuarios u ON u.id = v.usuario_id "
            "WHERE v.id = ?",
            (venta_id,),
        ).fetchone()

        if venta is None:
            return error("La venta no existe.", 404)

        # El nombre sale de la copia que quedó en la línea de venta, no de
        # productos: un producto borrado del inventario tiene producto_id en
        # NULL y su JOIN se perdería. Así la factura vieja sobrevive al
        # borrado del producto.
        filas = conn.execute(
            "SELECT producto_id, cantidad, precio_unitario, nombre_producto "
            "FROM detalle_ventas WHERE venta_id = ? ORDER BY id",
            (venta_id,),
        ).fetchall()

    detalle = [
        {
            "id": f["producto_id"],
            "nombre": f["nombre_producto"],
            "cantidad": f["cantidad"],
            "precio_unitario": f["precio_unitario"],
            "subtotal": dinero(Decimal(str(f["precio_unitario"])) * f["cantidad"]),
        }
        for f in filas
    ]

    subtotal = dinero(sum((Decimal(str(f["precio_unitario"])) * f["cantidad"] for f in filas), Decimal("0")))

    return jsonify({
        "id": venta["id"],
        "fecha": venta["fecha"],
        "metodo_pago": venta["metodo_pago"],
        "vendedor": venta["vendedor"],
        "subtotal": subtotal,
        "impuesto": dinero(subtotal * IVA),
        "total": venta["total"],
        "items": detalle,
    })


# ---------- Proveedores ----------

def _fila_proveedor(f):
    return {
        "id": f["id"],
        "nombre": f["nombre"],
        "telefono": f["telefono"],
        "cedula": f["cedula"],
        "direccion": f["direccion"],
        "departamento": f["departamento"],
    }


@app.get("/api/proveedores")
@requiere_auth
def obtener_proveedores():
    with db.conectar_db() as conn:
        filas = conn.execute("SELECT * FROM proveedores ORDER BY nombre").fetchall()
    return jsonify([_fila_proveedor(f) for f in filas])


@app.post("/api/proveedores")
@requiere_auth
def crear_proveedor():
    datos = cuerpo_json()
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        return error("El nombre del proveedor es obligatorio.")

    campos = {
        "nombre": nombre,
        "telefono": (datos.get("telefono") or "").strip(),
        "cedula": (datos.get("cedula") or "").strip(),
        "direccion": (datos.get("direccion") or "").strip(),
        "departamento": (datos.get("departamento") or "").strip(),
    }

    with db.conectar_db() as conn:
        cur = conn.execute(
            "INSERT INTO proveedores (nombre, telefono, cedula, direccion, departamento) "
            "VALUES (:nombre, :telefono, :cedula, :direccion, :departamento)",
            campos,
        )
        nuevo_id = cur.lastrowid

    return jsonify({
        "exito": True,
        "mensaje": "Proveedor registrado.",
        "id": nuevo_id,
    }), 201


@app.delete("/api/proveedores/<int:id_proveedor>")
@requiere_auth
def eliminar_proveedor(id_proveedor):
    with db.conectar_db() as conn:
        cur = conn.execute("DELETE FROM proveedores WHERE id = ?", (id_proveedor,))
        if cur.rowcount == 0:
            return error("Proveedor no encontrado.", 404)

    return jsonify({"exito": True, "mensaje": "Proveedor eliminado."})


# ---------- Reportes ----------

@app.get("/api/reportes")
@requiere_auth
def obtener_reportes():
    """KPIs y detalle de ventas para el período pedido."""
    periodo = request.args.get("periodo", "hoy")
    desde = rango_periodo(periodo)

    with db.conectar_db() as conn:
        ventas = conn.execute(
            "SELECT v.id, v.fecha, v.total, v.metodo_pago, u.nombre AS vendedor "
            "FROM ventas v JOIN usuarios u ON u.id = v.usuario_id "
            "WHERE v.fecha >= ? ORDER BY v.fecha DESC",
            (desde.strftime("%Y-%m-%d %H:%M:%S"),),
        ).fetchall()

        unidades = conn.execute(
            "SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_ventas d "
            "JOIN ventas v ON v.id = d.venta_id WHERE v.fecha >= ?",
            (desde.strftime("%Y-%m-%d %H:%M:%S"),),
        ).fetchone()[0]

    totales = [f["total"] for f in ventas]
    return jsonify({
        "periodo": periodo,
        "desde": desde.strftime("%Y-%m-%d %H:%M:%S"),
        "kpis": {
            "total_vendido": round(sum(totales), 2),
            "cantidad_ventas": len(ventas),
            "productos_vendidos": int(unidades),
            "ticket_promedio": round(sum(totales) / len(ventas), 2) if ventas else 0.0,
        },
        "ventas": [
            {
                "id": f["id"],
                "fecha": f["fecha"],
                "metodo_pago": f["metodo_pago"],
                "total": f["total"],
                "vendedor": f["vendedor"],
            }
            for f in ventas
        ],
    })


# ---------- Copias de seguridad ----------

@app.get("/api/respaldos/descargar")
@requiere_admin
def descargar_respaldo():
    """Entrega una copia de la base de datos como descarga.

    La copia se hace con la API de backup de SQLite, no copiando el archivo
    a mano: si alguien está escribiendo al mismo tiempo, una copia de bytes
    puede quedar a medio escribir y no abrir. El .db que baja el usuario es
    el mismo que usa el servidor, así que restaurarlo es inmediato.
    """
    # El destino de backup() tiene que ser una ruta: SQLite no acepta un
    # BytesIO. Se copia a un temporal y luego se leen los bytes.
    temporal = db.RUTA_DB.with_suffix(".descargando")
    conexion = sqlite3.connect(db.RUTA_DB)
    try:
        destino = sqlite3.connect(temporal)
        try:
            conexion.backup(destino)
        finally:
            destino.close()
        contenido = temporal.read_bytes()
    finally:
        conexion.close()
        temporal.unlink(missing_ok=True)

    return send_file(
        io.BytesIO(contenido),
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name=f"alexander_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db",
    )


@app.post("/api/respaldos/restaurar")
@requiere_admin
def restaurar_respaldo():
    """Reemplaza la base de datos por el archivo .db que sube el usuario.

    Solo para administradores, y con dos validaciones:
      - el archivo tiene que ser un SQLite válido con las tablas del sistema;
      - tiene que traer al menos un administrador, porque una base sin
        admins dejaría la instalación sin forma de entrar.

    Antes de tocar nada se guarda una copia del estado actual, para poder
    volver atrás si el archivo resulta no servir.
    """
    if "archivo" not in request.files:
        return error("No se recibió ningún archivo.")

    archivo = request.files["archivo"]
    if not archivo.filename:
        return error("El archivo no tiene nombre.")

    # Se escribe a un temporal: si el archivo subir no es un SQLite, se
    # detecta al abrirlo y no se toca la base real.
    temporal = db.RUTA_DB.with_suffix(".restaurando")
    archivo.save(temporal)

    problema = _validar_archivo_respaldo(temporal)
    if problema:
        temporal.unlink(missing_ok=True)
        return error(problema)

    # Respaldo del estado actual por si el archivo era válido pero viejo.
    copia_seguridad = db.RUTA_DB.with_suffix(".antes-de-restaurar")
    copia_seguridad.write_bytes(db.RUTA_DB.read_bytes())

    conexion = sqlite3.connect(db.RUTA_DB)
    conexion.close()  # cierra la conexión que pudo quedar viva
    db.RUTA_DB.write_bytes(temporal.read_bytes())
    temporal.unlink(missing_ok=True)

    # La sesión actual vivía en la base que se acaba de cambiar: el token
    # puede que ya no exista, así que se cierra y se pide entrar de nuevo.
    db.purgar_todas_las_sesiones()

    return jsonify({
        "exito": True,
        "mensaje": "Respaldo restaurado. Vuelve a iniciar sesión.",
    })


def _validar_archivo_respaldo(ruta) -> str | None:
    """Devuelve None si el archivo sirve como respaldo; el motivo si no."""
    try:
        conexion = sqlite3.connect(f"file:{ruta}?mode=ro", uri=True)
    except sqlite3.Error:
        return "El archivo no es una base de datos válida."

    try:
        tabla = conexion.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'"
        ).fetchone()
        if tabla is None:
            return "El archivo no contiene las tablas de Tienda Alexander."

        # Todas las tablas que el sistema necesita para funcionar.
        for nombre in ("usuarios", "categorias", "productos", "ventas", "sesiones"):
            existe = conexion.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", (nombre,)
            ).fetchone()
            if existe is None:
                return f"Le falta la tabla '{nombre}'. El archivo no es de este sistema."

        admins = conexion.execute(
            "SELECT COUNT(*) FROM usuarios WHERE rol = 'ADMIN'"
        ).fetchone()[0]
        if admins == 0:
            return "El archivo no tiene ningún administrador: restaurarlo dejaría el sistema cerrado."
    except sqlite3.Error:
        return "No se pudo leer el archivo: puede estar dañado."
    finally:
        conexion.close()

    return None


@app.get("/api/respaldos/info")
@requiere_admin
def informacion_respaldo():
    """Tamaño y fecha de la base de datos actual."""
    existe = db.RUTA_DB.exists()
    datos = {
        "existe": existe,
        "tamano_bytes": db.RUTA_DB.stat().st_size if existe else 0,
        "fecha": datetime.fromtimestamp(db.RUTA_DB.stat().st_mtime).strftime(db.FORMATO_FECHA) if existe else None,
    }
    return jsonify(datos)


@app.get("/api/inventario/resumen")
@requiere_auth
def resumen_inventario():
    """Totales del inventario para la pantalla de inicio."""
    with db.conectar_db() as conn:
        fila = conn.execute("""
            SELECT COUNT(*) AS total_productos,
                   COALESCE(SUM(precio * stock), 0) AS valor_inventario,
                   COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) AS agotados
            FROM productos
        """).fetchone()

    return jsonify({
        "total_productos": fila["total_productos"],
        "valor_inventario": round(fila["valor_inventario"], 2),
        "productos_agotados": fila["agotados"],
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
