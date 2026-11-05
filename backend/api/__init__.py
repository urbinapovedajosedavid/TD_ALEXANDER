
from flask import Blueprint

api_bp = Blueprint("api", __name__, url_prefix="/api")

# Importar las rutas para registrarlas en el blueprint
from . import auth  # noqa: E402, F401
from . import usuarios  # noqa: E402, F401
from . import productos  # noqa: E402, F401
from . import ventas  # noqa: E402, F401
from . import proveedores  # noqa: E402, F401
from . import reportes  # noqa: E402, F401
from . import respaldos  # noqa: E402, F401

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
