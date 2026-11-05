from flask import Blueprint

api_bp = Blueprint("api", __name__, url_prefix="/api")

from . import auth, productos, proveedores, reportes, respaldos, usuarios, ventas

__all__ = [
    "api_bp",
    "auth",
    "usuarios",
    "productos",
    "ventas",
    "proveedores",
    "reportes",
    "respaldos",
]
