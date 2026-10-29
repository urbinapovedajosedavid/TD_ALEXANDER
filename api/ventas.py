from decimal import ROUND_HALF_UP, Decimal

from flask import g, jsonify, request

import db
from api import api_bp
from seguridad import requiere_login

IVA = 0.15  # 15 %
METODOS_PAGO = ("efectivo", "tarjeta", "transferencia")


def _cuerpo_json():
    return request.get_json(silent=True) or {}


def _error(mensaje, estado=400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def _dinero(valor) -> float:
    return float(Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


@api_bp.post("/ventas")
@requiere_login
def registrar_venta():
    datos = _cuerpo_json()
    metodo_pago = datos.get("metodo_pago", "efectivo")
    cliente_id = datos.get("cliente_id")
    items = datos.get("items") or []

    if metodo_pago not in METODOS_PAGO:
        return _error("Método de pago no válido.", 400)
    if not items:
        return _error("El carrito de ventas está vacío.", 400)

    usuario_id = g.usuario["id"]

    try:
        cliente_id = int(cliente_id) if cliente_id else None
    except (TypeError, ValueError):
        cliente_id = None

    with db.conectar_db() as conn:
        total = Decimal("0")
        detalle = []
        for item in items:
            try:
                cantidad = int(item.get("cantidad"))
            except (TypeError, ValueError):
                return _error("Cantidad inválida en el carrito.", 400)
            if cantidad <= 0:
                return _error("Cantidad inválida en el carrito.", 400)

            producto = conn.execute(
                "SELECT id, nombre, precio, stock FROM productos WHERE id = ?",
                (item.get("id"),),
            ).fetchone()
            if producto is None:
                return _error(f"El producto con ID {item.get('id')} no existe.", 404)
            if producto["stock"] < cantidad:
                return _error(
                    f"Stock insuficiente para '{producto['nombre']}'. "
                    f"Disponible: {producto['stock']}.",
                    400,
                )

            precio = Decimal(str(producto["precio"]))
            total += precio * cantidad
            detalle.append({
                "id": producto["id"],
                "nombre": producto["nombre"],
                "cantidad": cantidad,
                "precio_unitario": float(producto["precio"]),
                "subtotal": _dinero(precio * cantidad),
            })

        subtotal_valor = _dinero(total)
        impuesto_valor = _dinero(Decimal(str(subtotal_valor)) * Decimal(str(IVA)))
        total_valor = _dinero(Decimal(str(subtotal_valor)) + Decimal(str(impuesto_valor)))

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


@api_bp.get("/ventas/<int:venta_id>")
@requiere_login
def obtener_venta(venta_id):
    with db.conectar_db() as conn:
        venta = conn.execute(
            "SELECT v.id, v.fecha, v.total, v.metodo_pago, u.nombre AS vendedor "
            "FROM ventas v JOIN usuarios u ON u.id = v.usuario_id "
            "WHERE v.id = ?",
            (venta_id,),
        ).fetchone()

        if venta is None:
            return _error("La venta no existe.", 404)

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
            "subtotal": _dinero(Decimal(str(f["precio_unitario"])) * f["cantidad"]),
        }
        for f in filas
    ]

    subtotal = _dinero(sum((Decimal(str(f["precio_unitario"])) * f["cantidad"] for f in filas), Decimal("0")))

    return jsonify({
        "id": venta["id"],
        "fecha": venta["fecha"],
        "metodo_pago": venta["metodo_pago"],
        "vendedor": venta["vendedor"],
        "subtotal": subtotal,
        "impuesto": _dinero(subtotal * IVA),
        "total": venta["total"],
        "items": detalle,
    })
