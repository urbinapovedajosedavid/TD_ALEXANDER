from flask import jsonify, request

IVA = 0.15
MARGEN_RECARGA = 0.05


def cuerpo_json():
    """Devuelve el cuerpo JSON de la petición como diccionario."""
    datos = request.get_json(silent=True)
    if isinstance(datos, dict):
        return datos
    return {}


def error(mensaje, estado=400):
    """Construye una respuesta JSON de error."""
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def dinero(valor):
    """Redondea un monto numérico a 2 decimales."""
    try:
        return round(float(valor or 0), 2)
    except (TypeError, ValueError):
        return 0.0
