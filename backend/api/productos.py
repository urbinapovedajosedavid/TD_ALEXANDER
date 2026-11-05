# Rutas de productos, categorías y control de stock.

import sqlite3

from flask import jsonify

import backend.db as db
from backend.api import api_bp
from backend.api.utils import MARGEN_RECARGA, cuerpo_json, dinero, error
from backend.schemas import validar_producto
from seguridad import requiere_login, requiere_rol


def _fila_producto(f):
    return {
        "id": f["id"],
        "codigo": f["codigo_barra"],
        "nombre": f["nombre"],
        "precio": f["precio"],
        "costo_entrada": f["costo_entrada"] or 0.0,
        "stock": f["stock"],
        "categoria_id": f["categoria_id"],
        "categoria_nombre": f["categoria_nombre"] or "Sin Categoría",
        "proveedor_id": f["proveedor_id"],
        "proveedor_nombre": f["proveedor_nombre"] or "",
    }


def _validar_producto_negocio(datos):
    valido, mensaje = validar_producto(datos)
    if not valido:
        return None, mensaje

    stock = int(datos.get("stock"))

    categoria_id = datos.get("categoria_id")
    try:
        categoria_id = int(categoria_id) if categoria_id else None
    except (TypeError, ValueError):
        return None, "La categoría seleccionada no es válida."

    proveedor_id = datos.get("proveedor_id")
    try:
        proveedor_id = int(proveedor_id) if proveedor_id else None
    except (TypeError, ValueError):
        return None, "El proveedor seleccionado no es válido."

    costo_entrada = datos.get("costo_entrada", 0.0)
    try:
        costo_entrada = dinero(costo_entrada) if costo_entrada not in (None, "") else 0.0
        if costo_entrada < 0:
            return None, "El costo de entrada no puede ser negativo."
    except (TypeError, ValueError):
        return None, "El costo de entrada debe ser un número válido."

    codigo = (datos.get("codigo") or datos.get("codigo_barra") or "").strip() or None
    return {
        "nombre": str(datos.get("nombre")).strip(),
        "codigo": codigo,
        "precio": dinero(datos.get("precio")),
        "costo_entrada": costo_entrada,
        "stock": stock,
        "categoria_id": categoria_id,
        "proveedor_id": proveedor_id,
    }, None


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
    nombre = (cuerpo_json().get("nombre") or "").strip()
    if not nombre:
        return error("El nombre de la categoría es obligatorio.", 400)

    try:
        with db.conectar_db() as conn:
            cur = conn.execute("INSERT INTO categorias (nombre) VALUES (?)", (nombre,))
            nuevo_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return error(f"La categoría '{nombre}' ya existe.", 409)

    return jsonify({"exito": True, "id": nuevo_id, "nombre": nombre}), 201


@api_bp.get("/productos")
@requiere_login
def obtener_productos():
    with db.conectar_db() as conn:
        filas = conn.execute("""
            SELECT p.id, p.codigo_barra, p.nombre, p.precio,
                   p.costo_entrada, p.stock, p.categoria_id,
                   c.nombre AS categoria_nombre,
                   p.proveedor_id, pr.nombre AS proveedor_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
            ORDER BY p.nombre
        """).fetchall()
    return jsonify([_fila_producto(f) for f in filas])


@api_bp.post("/productos")
@requiere_login
def crear_producto():
    datos, problema = _validar_producto_negocio(cuerpo_json())
    if problema:
        return error(problema, 400)

    try:
        with db.conectar_db() as conn:
            cur = conn.execute(
                "INSERT INTO productos "
                "(codigo_barra, nombre, precio, costo_entrada, stock, categoria_id, proveedor_id) "
                "VALUES (:codigo, :nombre, :precio, :costo_entrada, :stock, :categoria_id, :proveedor_id)",
                datos,
            )
            nuevo_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return error("Ese código de barras ya está registrado en otro producto.", 409)

    return jsonify({"exito": True, "mensaje": "Producto guardado.", "id": nuevo_id}), 201


@api_bp.put("/productos/<int:id_producto>")
@requiere_login
def actualizar_producto(id_producto):
    cuerpo = cuerpo_json()
    datos, problema = _validar_producto_negocio(cuerpo)
    if problema:
        return error(problema, 400)

    try:
        with db.conectar_db() as conn:
            existe = conn.execute(
                "SELECT costo_entrada, proveedor_id FROM productos WHERE id = ?",
                (id_producto,),
            ).fetchone()
            if not existe:
                return error("Producto no encontrado.", 404)

            if "costo_entrada" not in cuerpo:
                datos["costo_entrada"] = existe["costo_entrada"] or 0.0
            if "proveedor_id" not in cuerpo:
                datos["proveedor_id"] = existe["proveedor_id"]

            conn.execute(
                "UPDATE productos SET codigo_barra = :codigo, nombre = :nombre, "
                "precio = :precio, costo_entrada = :costo_entrada, stock = :stock, "
                "categoria_id = :categoria_id, proveedor_id = :proveedor_id "
                "WHERE id = :id",
                {**datos, "id": id_producto},
            )
    except sqlite3.IntegrityError:
        return error("Ese código de barras ya está registrado en otro producto.", 409)

    return jsonify({"exito": True, "mensaje": "Producto actualizado correctamente."})


@api_bp.delete("/productos/<int:id_producto>")
@requiere_rol("ADMIN")
def eliminar_producto(id_producto):
    with db.conectar_db() as conn:
        existe = conn.execute(
            "SELECT 1 FROM productos WHERE id = ?", (id_producto,)
        ).fetchone()
        if not existe:
            return error("Producto no encontrado.", 404)

        conn.execute("DELETE FROM productos WHERE id = ?", (id_producto,))

    return jsonify({"exito": True, "mensaje": "Producto eliminado correctamente."})


@api_bp.post("/productos/<int:id_producto>/recargar")
@requiere_login
def recargar_stock_producto(id_producto):
    datos = cuerpo_json()
    try:
        cantidad = int(datos.get("cantidad", 0))
    except (TypeError, ValueError):
        return error("La cantidad debe ser un número entero.", 400)

    if cantidad <= 0:
        return error("La cantidad a recargar debe ser mayor a 0.", 400)

    precio_entrada_raw = datos.get("precio_entrada")
    precio_entrada = None
    if precio_entrada_raw is not None and str(precio_entrada_raw).strip() != "":
        try:
            precio_entrada = float(precio_entrada_raw)
            if precio_entrada < 0:
                return error("El precio de entrada no puede ser negativo.", 400)
        except (TypeError, ValueError):
            return error("El precio de entrada debe ser un número válido.", 400)

    with db.conectar_db() as conn:
        producto = conn.execute(
            "SELECT id, nombre, stock, precio, costo_entrada FROM productos WHERE id = ?",
            (id_producto,),
        ).fetchone()

        if not producto:
            return error("Producto no encontrado.", 404)

        stock_anterior = int(producto["stock"])
        nuevo_stock = stock_anterior + cantidad
        precio_anterior = dinero(producto["precio"])
        nuevo_precio = precio_anterior
        nuevo_costo = dinero(producto["costo_entrada"])
        precio_actualizado = False

        if precio_entrada is not None:
            nuevo_costo = dinero(precio_entrada)
            precio_minimo = dinero(precio_entrada * (1 + MARGEN_RECARGA))
            if precio_minimo > precio_anterior:
                nuevo_precio = precio_minimo
                precio_actualizado = True

        conn.execute(
            "UPDATE productos SET stock = ?, precio = ?, costo_entrada = ? WHERE id = ?",
            (nuevo_stock, nuevo_precio, nuevo_costo, id_producto),
        )

    mensaje = f"Stock actualizado: {stock_anterior} + {cantidad} = {nuevo_stock}."
    if precio_actualizado:
        mensaje += f" Precio ajustado de C${precio_anterior:.2f} a C${nuevo_precio:.2f} (costo + 5%)."

    return jsonify({
        "exito": True,
        "mensaje": mensaje,
        "stock_anterior": stock_anterior,
        "nuevo_stock": nuevo_stock,
        "precio_anterior": precio_anterior,
        "nuevo_precio": nuevo_precio,
        "costo_entrada": nuevo_costo,
        "precio_actualizado": precio_actualizado,
    })


@api_bp.get("/inventario/resumen")
@requiere_login
def resumen_inventario():
    with db.conectar_db() as conn:
        fila = conn.execute("""
            SELECT COUNT(*) AS total_productos,
                   COALESCE(SUM(precio * stock), 0) AS valor_inventario,
                   COALESCE(SUM(costo_entrada * stock), 0) AS costo_inventario,
                   COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) AS agotados,
                   COALESCE(SUM(CASE WHEN stock > 0 AND stock <= 5 THEN 1 ELSE 0 END), 0) AS stock_bajo
            FROM productos
        """).fetchone()

    return jsonify({
        "total_productos": fila["total_productos"],
        "valor_inventario": dinero(fila["valor_inventario"]),
        "costo_inventario": dinero(fila["costo_inventario"]),
        "productos_agotados": fila["agotados"],
        "productos_stock_bajo": fila["stock_bajo"],
    })
