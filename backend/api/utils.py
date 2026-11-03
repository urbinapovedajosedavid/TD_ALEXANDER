"""api.utils
=========
Funciones auxiliares y constantes de negocio compartidas por los módulos de la API.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any, cast

from flask import Response, jsonify, request

IVA = Decimal("0.15")           # 15 % IVA estándar
MARGEN_RECARGA = Decimal("0.05")  # 5 % margen mínimo sobre precio de entrada en recargas


def cuerpo_json() -> dict[str, Any]:
    """Devuelve el cuerpo JSON de la petición como diccionario seguro."""
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        return {}
    return cast(dict[str, Any], datos)


def error(mensaje: str, estado: int = 400) -> tuple[Response, int]:
    """Construye una respuesta JSON uniforme de error."""
    return jsonify({"exito": False, "mensaje": mensaje}), estado


def dinero(valor: object) -> float:
    """Redondea un valor monetario a 2 decimales con ROUND_HALF_UP."""
    return float(Decimal(str(valor or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
