# Rutas de reportes de ventas por período, rango de fechas y vendedor.

from datetime import datetime, timedelta

from flask import g, jsonify, request

import backend.db as db
from backend.api import api_bp
from backend.api.utils import dinero, error
from backend.config import FORMATO_FECHA
from seguridad import requiere_login, requiere_rol


def _rango_periodo(periodo):
    hoy_inicio = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    if periodo == "semana":
        return hoy_inicio - timedelta(days=6)
    if periodo == "mes":
        return hoy_inicio - timedelta(days=29)
    return hoy_inicio


def _rango_fechas():
    inicio = (request.args.get("fecha_inicio") or "").strip()
    fin = (request.args.get("fecha_fin") or "").strip()
    if not inicio and not fin:
        return None, None

    desde = datetime.strptime(inicio, "%Y-%m-%d") if inicio else None
    hasta = (
        datetime.strptime(fin, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        if fin else None
    )

    if desde and hasta and desde > hasta:
        raise ValueError("inicio_posterior")

    return (
        desde.strftime(FORMATO_FECHA) if desde else None,
        hasta.strftime(FORMATO_FECHA) if hasta else None,
    )


@api_bp.get("/reportes")
@requiere_login
def obtener_reportes():
    try:
        desde_txt, hasta_txt = _rango_fechas()
    except ValueError:
        return error("Formato de fecha inválido. Usa AAAA-MM-DD.", 400)

    if desde_txt is None and hasta_txt is None:
        periodo = request.args.get("periodo", "hoy")
        desde_txt = _rango_periodo(periodo).strftime(FORMATO_FECHA)
        hasta_txt = None
    else:
        periodo = "rango"

    condiciones = ["v.estado = 'COMPLETADA'"]
    parametros = []

    if g.usuario.get("rol") != "ADMIN":
        condiciones.append("v.usuario_id = ?")
        parametros.append(g.usuario["id"])

    if desde_txt:
        condiciones.append("v.fecha >= ?")
        parametros.append(desde_txt)
    if hasta_txt:
        condiciones.append("v.fecha <= ?")
        parametros.append(hasta_txt)
    filtro = " AND ".join(condiciones)

    with db.conectar_db() as conn:
        ventas = conn.execute(
            "SELECT v.id, v.fecha, v.subtotal, v.impuesto, v.total, "
            "v.metodo_pago, v.estado, u.nombre AS vendedor "
            "FROM ventas v JOIN usuarios u ON u.id = v.usuario_id "
            f"WHERE {filtro} ORDER BY v.fecha DESC",
            tuple(parametros),
        ).fetchall()

        unidades = conn.execute(
            "SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_ventas d "
            "JOIN ventas v ON v.id = d.venta_id "
            f"WHERE {filtro}",
            tuple(parametros),
        ).fetchone()[0]

    suma_total = dinero(sum((f["total"] or 0) for f in ventas))
    suma_subtotal = dinero(sum((f["subtotal"] or 0) for f in ventas))
    suma_impuesto = dinero(sum((f["impuesto"] or 0) for f in ventas))
    cantidad_ventas = len(ventas)

    return jsonify({
        "periodo": periodo,
        "desde": desde_txt,
        "hasta": hasta_txt,
        "kpis": {
            "subtotal_vendido": suma_subtotal,
            "impuesto_total": suma_impuesto,
            "total_vendido": suma_total,
            "cantidad_ventas": cantidad_ventas,
            "productos_vendidos": int(unidades),
            "ticket_promedio": dinero(suma_total / cantidad_ventas) if cantidad_ventas else 0.0,
        },
        "ventas": [
            {
                "id": f["id"],
                "fecha": f["fecha"],
                "metodo_pago": f["metodo_pago"],
                "subtotal": dinero(f["subtotal"]),
                "impuesto": dinero(f["impuesto"]),
                "total": dinero(f["total"]),
                "estado": f["estado"],
                "vendedor": f["vendedor"],
            }
            for f in ventas
        ],
    })


@api_bp.get("/reportes/usuario/<int:usuario_id>")
@requiere_rol("ADMIN")
def reporte_ventas_de_usuario(usuario_id):
    try:
        desde_txt, hasta_txt = _rango_fechas()
    except ValueError:
        return error("Formato de fecha inválido. Usa AAAA-MM-DD.", 400)

    categoria_raw = (request.args.get("categoria_id") or "").strip()
    categoria_id = None
    if categoria_raw:
        try:
            categoria_id = int(categoria_raw)
        except ValueError:
            return error("Categoría inválida.", 400)

    with db.conectar_db() as conn:
        usuario = conn.execute(
            "SELECT id, nombre, usuario, rol FROM usuarios WHERE id = ?",
            (usuario_id,),
        ).fetchone()

        if usuario is None:
            return error("El usuario no existe.", 404)

        condiciones = ["v.usuario_id = ?", "v.estado = 'COMPLETADA'"]
        parametros = [usuario_id]
        if desde_txt:
            condiciones.append("v.fecha >= ?")
            parametros.append(desde_txt)
        if hasta_txt:
            condiciones.append("v.fecha <= ?")
            parametros.append(hasta_txt)
        where = " AND ".join(condiciones)

        filas_ventas = conn.execute(
            "SELECT v.id, v.fecha, v.subtotal, v.impuesto, v.total, "
            "v.metodo_pago, u.nombre AS vendedor "
            "FROM ventas v JOIN usuarios u ON u.id = v.usuario_id "
            f"WHERE {where} ORDER BY v.fecha DESC",
            tuple(parametros),
        ).fetchall()

        items_por_venta = {}
        if filas_ventas:
            filas_items = conn.execute(
                "SELECT d.venta_id, d.producto_id, d.cantidad, d.precio_unitario, "
                "d.nombre_producto, p.categoria_id "
                "FROM detalle_ventas d "
                "JOIN ventas v ON v.id = d.venta_id "
                "LEFT JOIN productos p ON p.id = d.producto_id "
                f"WHERE {where} ORDER BY d.id",
                tuple(parametros),
            ).fetchall()

            for item in filas_items:
                vid = item["venta_id"]
                if vid not in items_por_venta:
                    items_por_venta[vid] = []
                items_por_venta[vid].append({
                    "id": item["producto_id"],
                    "nombre": item["nombre_producto"],
                    "categoria_id": item["categoria_id"],
                    "cantidad": item["cantidad"],
                    "precio_unitario": dinero(item["precio_unitario"]),
                    "subtotal": dinero(item["precio_unitario"] * item["cantidad"]),
                })

    ventas = []
    dias = []
    unidades_vendidas = 0
    suma_total = 0.0
    suma_subtotal = 0.0

    for fila in filas_ventas:
        lineas = items_por_venta.get(fila["id"], [])
        if categoria_id is not None:
            tiene_categoria = any(l["categoria_id"] == categoria_id for l in lineas)
            if not tiene_categoria:
                continue

        unidades_vendidas += sum(l["cantidad"] for l in lineas)
        suma_total += fila["total"] or 0.0
        suma_subtotal += fila["subtotal"] or 0.0

        dia = str(fila["fecha"] or "")[:10]
        if dia and dia not in dias:
            dias.append(dia)

        ventas.append({
            "id": fila["id"],
            "fecha": fila["fecha"],
            "dia": dia,
            "metodo_pago": fila["metodo_pago"],
            "subtotal": dinero(fila["subtotal"]),
            "impuesto": dinero(fila["impuesto"]),
            "total": dinero(fila["total"]),
            "vendedor": fila["vendedor"],
            "items": lineas,
        })

    total_vendido = dinero(suma_total)
    subtotal_vendido = dinero(suma_subtotal)

    return jsonify({
        "exito": True,
        "usuario": {
            "id": usuario["id"],
            "nombre": usuario["nombre"],
            "usuario": usuario["usuario"],
            "rol": usuario["rol"],
        },
        "dias": dias,
        "ventas": ventas,
        "kpis": {
            "subtotal_vendido": subtotal_vendido,
            "total_vendido": total_vendido,
            "cantidad_ventas": len(ventas),
            "productos_vendidos": unidades_vendidas,
            "ticket_promedio": dinero(total_vendido / len(ventas)) if ventas else 0.0,
        },
    })
