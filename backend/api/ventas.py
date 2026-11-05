# Rutas de ventas: registro de facturas, consulta y anulación con devolución de stock.

from flask import g, jsonify

import backend.db as db
from backend.api import api_bp
from backend.api.utils import IVA, cuerpo_json, dinero, error
from backend.config import ahora
from seguridad import requiere_login, requiere_rol

METODOS_PAGO = ("efectivo", "tarjeta", "transferencia")


@api_bp.post("/ventas")
@requiere_login
def registrar_venta():
    datos = cuerpo_json()
    metodo_pago = datos.get("metodo_pago", "efectivo")
    items = datos.get("items") or []

    if metodo_pago not in METODOS_PAGO:
        return error("Método de pago no válido.", 400)
    if not items or not isinstance(items, list):
        return error("El carrito de ventas está vacío.", 400)

    cantidades_por_producto = {}
    for item in items:
        if not isinstance(item, dict):
            return error("Formato inválido en los productos del carrito.", 400)
        try:
            prod_id = int(item.get("id"))
            cantidad = int(item.get("cantidad"))
        except (TypeError, ValueError):
            return error("Cantidad o producto inválido en el carrito.", 400)
        if cantidad <= 0:
            return error("Cantidad inválida en el carrito.", 400)
        cantidades_por_producto[prod_id] = cantidades_por_producto.get(prod_id, 0) + cantidad

    usuario_id = g.usuario["id"]

    with db.conectar_db() as conn:
        subtotal_acum = 0.0
        detalle = []

        for prod_id, cantidad in cantidades_por_producto.items():
            producto = conn.execute(
                "SELECT id, nombre, precio, stock FROM productos WHERE id = ?",
                (prod_id,),
            ).fetchone()
            if producto is None:
                return error(f"El producto con ID {prod_id} no existe.", 404)
            if producto["stock"] < cantidad:
                return error(
                    f"Stock insuficiente para '{producto['nombre']}'. "
                    f"Disponible: {producto['stock']}.",
                    400,
                )

            precio = dinero(producto["precio"])
            subtotal_linea = dinero(precio * cantidad)
            subtotal_acum += subtotal_linea

            detalle.append({
                "id": producto["id"],
                "nombre": producto["nombre"],
                "cantidad": cantidad,
                "precio_unitario": precio,
                "subtotal": subtotal_linea,
            })

        subtotal_valor = dinero(subtotal_acum)
        impuesto_valor = dinero(subtotal_valor * IVA)
        total_valor = dinero(subtotal_valor + impuesto_valor)

        efectivo_recibido = None
        vuelto_valor = None
        if metodo_pago == "efectivo" and datos.get("efectivo_recibido") is not None:
            try:
                recibido_num = dinero(datos.get("efectivo_recibido"))
                if recibido_num < total_valor:
                    return error("El efectivo recibido no alcanza para cubrir el total.", 400)
                efectivo_recibido = recibido_num
                vuelto_valor = dinero(recibido_num - total_valor)
            except (TypeError, ValueError):
                pass

        fecha_venta = ahora()
        cur = conn.execute(
            "INSERT INTO ventas "
            "(usuario_id, fecha, subtotal, impuesto, total, metodo_pago, efectivo_recibido, vuelto, estado) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADA')",
            (
                usuario_id,
                fecha_venta,
                subtotal_valor,
                impuesto_valor,
                total_valor,
                metodo_pago,
                efectivo_recibido,
                vuelto_valor,
            ),
        )
        venta_id = cur.lastrowid

        for linea in detalle:
            conn.execute(
                "UPDATE productos SET stock = stock - ? WHERE id = ?",
                (linea["cantidad"], linea["id"]),
            )
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

    return jsonify({
        "exito": True,
        "mensaje": "Venta realizada con éxito.",
        "venta_id": venta_id,
        "fecha": fecha_venta,
        "metodo_pago": metodo_pago,
        "subtotal": subtotal_valor,
        "impuesto": impuesto_valor,
        "total": total_valor,
        "efectivo_recibido": efectivo_recibido,
        "vuelto": vuelto_valor,
        "estado": "COMPLETADA",
        "items": detalle,
    }), 201


@api_bp.get("/ventas/<int:venta_id>")
@requiere_login
def obtener_venta(venta_id):
    with db.conectar_db() as conn:
        venta = conn.execute(
            "SELECT v.id, v.fecha, v.subtotal, v.impuesto, v.total, v.metodo_pago, "
            "v.efectivo_recibido, v.vuelto, v.estado, u.nombre AS vendedor "
            "FROM ventas v JOIN usuarios u ON u.id = v.usuario_id "
            "WHERE v.id = ?",
            (venta_id,),
        ).fetchone()

        if venta is None:
            return error("La venta no existe.", 404)

        filas = conn.execute(
            "SELECT producto_id, cantidad, precio_unitario, nombre_producto "
            "FROM detalle_ventas WHERE venta_id = ? ORDER BY id",
            (venta_id,),
        ).fetchall()

    detalle = []
    for f in filas:
        detalle.append({
            "id": f["producto_id"],
            "nombre": f["nombre_producto"],
            "cantidad": f["cantidad"],
            "precio_unitario": dinero(f["precio_unitario"]),
            "subtotal": dinero(f["precio_unitario"] * f["cantidad"]),
        })

    return jsonify({
        "id": venta["id"],
        "fecha": venta["fecha"],
        "metodo_pago": venta["metodo_pago"],
        "vendedor": venta["vendedor"],
        "subtotal": dinero(venta["subtotal"]),
        "impuesto": dinero(venta["impuesto"]),
        "total": dinero(venta["total"]),
        "efectivo_recibido": venta["efectivo_recibido"],
        "vuelto": venta["vuelto"],
        "estado": venta["estado"] or "COMPLETADA",
        "items": detalle,
    })


@api_bp.post("/ventas/<int:venta_id>/anular")
@requiere_rol("ADMIN")
def anular_venta(venta_id):
    with db.conectar_db() as conn:
        venta = conn.execute(
            "SELECT id, estado FROM ventas WHERE id = ?",
            (venta_id,),
        ).fetchone()

        if venta is None:
            return error("La venta no existe.", 404)
        if venta["estado"] == "ANULADA":
            return error("Esta venta ya fue anulada anteriormente.", 409)

        lineas = conn.execute(
            "SELECT producto_id, cantidad FROM detalle_ventas WHERE venta_id = ?",
            (venta_id,),
        ).fetchall()

        for linea in lineas:
            if linea["producto_id"] is not None:
                conn.execute(
                    "UPDATE productos SET stock = stock + ? WHERE id = ?",
                    (linea["cantidad"], linea["producto_id"]),
                )

        conn.execute(
            "UPDATE ventas SET estado = 'ANULADA' WHERE id = ?",
            (venta_id,),
        )

    return jsonify({
        "exito": True,
        "mensaje": f"Venta #{venta_id} anulada y stock restituido al inventario.",
    })
