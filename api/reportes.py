"""api.reportes
=============
Reportes de ventas, KPIs y rendimiento por vendedor.
"""

from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from flask import jsonify, request

import db
from api import api_bp
from seguridad import requiere_login, requiere_rol


def _error(mensaje, estado=400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def _dinero(valor) -> float:
    return float(Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _rango_periodo(periodo):
    ahora = datetime.now()
    if periodo == "semana":
        return ahora - timedelta(days=7)
    if periodo == "mes":
        return ahora - timedelta(days=30)
    return ahora.replace(hour=0, minute=0, second=0, microsecond=0)


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

    formato = "%Y-%m-%d %H:%M:%S"
    return (
        desde.strftime(formato) if desde else None,
        hasta.strftime(formato) if hasta else None,
    )


@api_bp.get("/reportes")
@requiere_login
def obtener_reportes():
    try:
        desde_txt, hasta_txt = _rango_fechas()
    except ValueError:
        return _error("Formato de fecha inválido. Usa AAAA-MM-DD.", 400)

    if desde_txt is None and hasta_txt is None:
        periodo = request.args.get("periodo", "hoy")
        desde_txt = _rango_periodo(periodo).strftime("%Y-%m-%d %H:%M:%S")
        hasta_txt = None
    else:
        periodo = "rango"

    condiciones = []
    parametros = []
    if desde_txt:
        condiciones.append("v.fecha >= ?")
        parametros.append(desde_txt)
    if hasta_txt:
        condiciones.append("v.fecha <= ?")
        parametros.append(hasta_txt)
    filtro = " AND ".join(condiciones)

    with db.conectar_db() as conn:
        ventas = conn.execute(
            "SELECT v.id, v.fecha, v.total, v.metodo_pago, u.nombre AS vendedor "
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

    totales = [f["total"] for f in ventas]
    return jsonify({
        "periodo": periodo,
        "desde": desde_txt,
        "hasta": hasta_txt,
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


@api_bp.get("/reportes/usuario/<int:usuario_id>")
@requiere_rol("ADMIN")
def reporte_ventas_de_usuario(usuario_id):
    try:
        desde_txt, hasta_txt = _rango_fechas()
    except ValueError:
        return _error("Formato de fecha inválido. Usa AAAA-MM-DD.", 400)

    with db.conectar_db() as conn:
        usuario = conn.execute(
            "SELECT id, nombre, usuario, rol FROM usuarios WHERE id = ?",
            (usuario_id,),
        ).fetchone()

        if usuario is None:
            return _error("El usuario no existe.", 404)

        condiciones = ["v.usuario_id = ?"]
        parametros = [usuario_id]
        if desde_txt:
            condiciones.append("v.fecha >= ?")
            parametros.append(desde_txt)
        if hasta_txt:
            condiciones.append("v.fecha <= ?")
            parametros.append(hasta_txt)
        where = " AND ".join(condiciones)

        filas = conn.execute(
            "SELECT v.id, v.fecha, v.total, v.metodo_pago, u.nombre AS vendedor "
            "FROM ventas v JOIN usuarios u ON u.id = v.usuario_id "
            f"WHERE {where} ORDER BY v.fecha DESC",
            tuple(parametros),
        ).fetchall()

        ventas = []
        unidades_vendidas = 0
        totales = []
        for fila in filas:
            items = conn.execute(
                "SELECT producto_id, cantidad, precio_unitario, nombre_producto "
                "FROM detalle_ventas WHERE venta_id = ? ORDER BY id",
                (fila["id"],),
            ).fetchall()

            lineas = [
                {
                    "id": item["producto_id"],
                    "nombre": item["nombre_producto"],
                    "cantidad": item["cantidad"],
                    "precio_unitario": item["precio_unitario"],
                    "subtotal": _dinero(Decimal(str(item["precio_unitario"])) * item["cantidad"]),
                }
                for item in items
            ]
            unidades_vendidas += sum(linea["cantidad"] for linea in lineas)
            totales.append(fila["total"])

            ventas.append({
                "id": fila["id"],
                "fecha": fila["fecha"],
                "metodo_pago": fila["metodo_pago"],
                "total": fila["total"],
                "vendedor": fila["vendedor"],
                "items": lineas,
            })

    total_vendido = _dinero(sum(totales)) if totales else 0.0
    return jsonify({
        "exito": True,
        "usuario": {
            "id": usuario["id"],
            "nombre": usuario["nombre"],
            "usuario": usuario["usuario"],
            "rol": usuario["rol"],
        },
        "ventas": ventas,
        "kpis": {
            "total_vendido": total_vendido,
            "cantidad_ventas": len(ventas),
            "productos_vendidos": unidades_vendidas,
            "ticket_promedio": _dinero(total_vendido / len(ventas)) if ventas else 0.0,
        },
    })

