from flask import jsonify, request

MARGEN_RECARGA = 0.05


def cuerpo_json():
    datos = request.get_json(silent=True)
    if isinstance(datos, dict):
        return datos
    return {}


def error(mensaje, estado=400):
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def dinero(valor):
    try:
        return round(float(valor or 0), 2)
    except (TypeError, ValueError):
        return 0.0
