"""Backend.server
==============
Servidor principal del sistema y re-exportador de la aplicación Flask.
Toda la lógica de API reside en el blueprint ``api/`` y la aplicación en ``app.py``.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

from app import app  # noqa: E402

if __name__ == "__main__":
    app.run(debug=app.config.get("DEBUG", True), port=5000)
