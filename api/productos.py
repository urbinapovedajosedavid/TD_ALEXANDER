"""api.productos
=============
Gestión de inventario, productos, categorías y stock.
"""

import sqlite3

from flask import jsonify, request

import db
from api import api_bp
from schemas import validar_producto
from seguridad import requiere_login

STOCK_MAXIMO = 64


def _cuerpo_json():
    return request.get_json(silent=True) or {}


def _error(mensaje, estado=400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def _fila_producto(f):
    return {
        "id": f["id"],
        "codigo": f["codigo_barra"],
        "nombre": f["nombre"],
        "precio": f["precio"],
        "stock": f["stock"],
        "categoria_id": f["categoria_id"],
        "categoria_nombre": f["categoria_nombre"] or "Sin Categoría",
    }


def _validar_producto_negocio(datos):
    valido, mensaje = validar_producto(datos)
    if not valido:
        return None, mensaje

    stock = int(datos.get("stock"))
    if stock > STOCK_MAXIMO:
        return None, f"El stock no puede superar las {STOCK_MAXIMO} unidades."

    categoria_id = datos.get("categoria_id")
    try:
        categoria_id = int(categoria_id) if categoria_id else None
    except (TypeError, ValueError):
        return None, "La categoría seleccionada no es válida."

    codigo = (datos.get("codigo") or datos.get("codigo_barra") or "").strip() or None
    return {
        "nombre": str(datos.get("nombre")).strip(),
        "codigo": codigo,
        "precio": float(datos.get("precio")),
        "stock": stock,
        "categoria_id": categoria_id,
    }, None


# ---------- Categorías ----------

@api_bp.get("/categorias")
@requiere_login
def obtener_categorias():
    with db.conectar_db() as conn:
        filas = conn.execute(
            "SELECT id, nombre FROM categorias ORDER BY nombre"
        ).fetchall()
    return jsonify([{"id": f["id"], "nombre": f["nombre"]} for f in filas])


@api_bp.post("/categorias")
@requiere_login
def crear_categoria():
    nombre = (_cuerpo_json().get("nombre") or "").strip()
    if not nombre:
        return _error("El nombre de la categoría es obligatorio.", 400)

    try:
        with db.conectar_db() as conn:
            cur = conn.execute("INSERT INTO categorias (nombre) VALUES (?)", (nombre,))
            nuevo_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return _error(f"La categoría '{nombre}' ya existe.", 409)

    return jsonify({"exito": True, "id": nuevo_id, "nombre": nombre}), 201


# ---------- Productos ----------

@api_bp.get("/productos")
@requiere_login
def obtener_productos():
    with db.conectar_db() as conn:
        filas = conn.execute("""
            SELECT p.id, p.codigo_barra, p.nombre, p.precio, p.stock,
                   p.categoria_id, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.nombre
        """).fetchall()
    return jsonify([_fila_producto(f) for f in filas])


@api_bp.post("/productos")
@requiere_login
def crear_producto():
    datos, problema = _validar_producto_negocio(_cuerpo_json())
    if problema:
        return _error(problema, 400)

    try:
        with db.conectar_db() as conn:
            cur = conn.execute(
                "INSERT INTO productos (codigo_barra, nombre, precio, stock, categoria_id) "
                "VALUES (:codigo, :nombre, :precio, :stock, :categoria_id)",
                datos,
            )
            nuevo_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return _error("Ese código de barras ya está registrado en otro producto.", 409)

    return jsonify({"exito": True, "mensaje": "Producto guardado.", "id": nuevo_id}), 201


@api_bp.put("/productos/<int:id_producto>")
@requiere_login
def actualizar_producto(id_producto):
    datos, problema = _validar_producto_negocio(_cuerpo_json())
    if problema:
        return _error(problema, 400)

    try:
        with db.conectar_db() as conn:
            existe = conn.execute(
                "SELECT 1 FROM productos WHERE id = ?", (id_producto,)
            ).fetchone()
            if not existe:
                return _error("Producto no encontrado.", 404)

            conn.execute(
                "UPDATE productos SET codigo_barra = :codigo, nombre = :nombre, "
                "precio = :precio, stock = :stock, categoria_id = :categoria_id "
                "WHERE id = :id",
                {**datos, "id": id_producto},
            )
    except sqlite3.IntegrityError:
        return _error("Ese código de barras ya está registrado en otro producto.", 409)

    return jsonify({"exito": True, "mensaje": "Producto actualizado correctamente."})


@api_bp.delete("/productos/<int:id_producto>")
@requiere_login
def eliminar_producto(id_producto):
    with db.conectar_db() as conn:
        existe = conn.execute(
            "SELECT 1 FROM productos WHERE id = ?", (id_producto,)
        ).fetchone()
        if not existe:
            return _error("Producto no encontrado.", 404)

        conn.execute("DELETE FROM productos WHERE id = ?", (id_producto,))

    return jsonify({"exito": True, "mensaje": "Producto eliminado correctamente."})


@api_bp.post("/productos/<int:id_producto>/recargar")
@requiere_login
def recargar_stock_producto(id_producto):
    datos = _cuerpo_json()
    try:
        cantidad = int(datos.get("cantidad", 0))
    except (TypeError, ValueError):
        return _error("La cantidad debe ser un número entero.", 400)

    if cantidad <= 0:
        return _error("La cantidad a recargar debe ser mayor a 0.", 400)

    with db.conectar_db() as conn:
        producto = conn.execute(
            "SELECT id, nombre, stock FROM productos WHERE id = ?", (id_producto,)
        ).fetchone()

        if not producto:
            return _error("Producto no encontrado.", 404)

        nuevo_stock = producto["stock"] + cantidad
        if nuevo_stock > STOCK_MAXIMO:
            return _error(f"El stock no puede superar el límite máximo de {STOCK_MAXIMO} unidades.", 400)

        conn.execute(
            "UPDATE productos SET stock = ? WHERE id = ?",
            (nuevo_stock, id_producto),
        )

    return jsonify({
        "exito": True,
        "mensaje": f"Stock recargado correctamente. Nuevo stock: {nuevo_stock}",
        "nuevo_stock": nuevo_stock,
    })


# ---------- Resumen de Inventario ----------

@api_bp.get("/inventario/resumen")
@requiere_login
def resumen_inventario():
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

