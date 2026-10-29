"""api
===
Blueprint de la API RESTful de Tienda Alexander.
Montado bajo el prefijo ``/api``.
"""

from flask import Blueprint

api_bp = Blueprint("api", __name__, url_prefix="/api")

# Importar las rutas para registrarlas en el blueprint
from api import auth  # noqa: E402, F401
from api import usuarios  # noqa: E402, F401
from api import productos  # noqa: E402, F401
from api import ventas  # noqa: E402, F401
from api import proveedores  # noqa: E402, F401
from api import reportes  # noqa: E402, F401
from api import respaldos  # noqa: E402, F401

__all__ = ["api_bp"]

