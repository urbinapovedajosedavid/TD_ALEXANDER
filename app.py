
import os
import sys
import threading
import webbrowser
from pathlib import Path

RAIZ_BASE: Path = Path(__file__).resolve().parent
if str(RAIZ_BASE) not in sys.path:
    sys.path.insert(0, str(RAIZ_BASE))

try:
    from flask import Flask, redirect, send_from_directory  # noqa: E402
    from flask_cors import CORS  # noqa: E402
    from werkzeug.wrappers import Response  # noqa: E402
except ModuleNotFoundError:
    import subprocess
    print("Instalando dependencias requeridas (Flask, Flask-Cors)...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-r", str(RAIZ_BASE / "requirements.txt")]
    )
    from flask import Flask, redirect, send_from_directory  # noqa: E402
    from flask_cors import CORS  # noqa: E402
    from werkzeug.wrappers import Response  # noqa: E402

import backend.db as db  # noqa: E402
from backend.api import api_bp  # noqa: E402
from backend.config import RAIZ_ACTUAL, RAIZ_RECURSOS, config  # noqa: E402
from seguridad import obtener_token_actual, usuario_de_token  # noqa: E402

FRONTEND_DIR: str = next(
    (
        str(ruta)
        for ruta in (
            RAIZ_RECURSOS / "frontend",
            RAIZ_RECURSOS / "Frontend",
            RAIZ_ACTUAL / "frontend",
            RAIZ_ACTUAL / "Frontend",
        )
        if ruta.is_dir()
    ),
    str(RAIZ_ACTUAL / "frontend"),
)

# static_folder=None evita colisión con la ruta controlada servir_frontend
app: Flask = Flask(__name__, static_folder=None)

entorno: str = os.environ.get("FLASK_ENV", "production")
app.config.from_object(config.get(entorno, config["default"]))

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"
app.config["SESSION_COOKIE_NAME"] = "alexander_session"

puerto_actual: int = int(os.environ.get("PORT", 5000))
CORS(app, supports_credentials=True)

app.register_blueprint(api_bp)

db.inicializar_db()

# Alias cortos que no coinciden directamente con el nombre del archivo .html
ALIAS_PAGINAS: dict[str, str] = {
    "login": "Login.html",
    "login.html": "Login.html",
    "proveedores": "provedores.html",
    "copia_seguridad": "copia_de_seguridad.html",
    "registro": "agregar_usuario.html",
}


@app.route("/")
def index() -> Response | tuple[Response, int]:
    token = obtener_token_actual()
    if token:
        with db.conectar_db() as conn:
            if usuario_de_token(conn, token):
                return redirect("/inicio.html")
    return redirect("/Login.html")


@app.route("/<path:nombre_archivo>")
def servir_frontend(nombre_archivo: str) -> Response | tuple[Response, int]:
    destino_alias = ALIAS_PAGINAS.get(nombre_archivo.lower())
    if destino_alias and os.path.isfile(os.path.join(FRONTEND_DIR, destino_alias)):
        return send_from_directory(FRONTEND_DIR, destino_alias)

    ruta_directa = os.path.join(FRONTEND_DIR, nombre_archivo)
    if os.path.isfile(ruta_directa):
        return send_from_directory(FRONTEND_DIR, nombre_archivo)

    nombre_html = f"{nombre_archivo}.html"
    if os.path.isfile(os.path.join(FRONTEND_DIR, nombre_html)):
        return send_from_directory(FRONTEND_DIR, nombre_html)

    return send_from_directory(FRONTEND_DIR, nombre_archivo)


def _abrir_navegador(url: str) -> None:
    import time
    time.sleep(1.0)
    try:
        webbrowser.open(url)
    except Exception:
        pass


if __name__ == "__main__":
    host: str = os.environ.get("HOST", "127.0.0.1")
    puerto: int = int(os.environ.get("PORT", 5000))
    debug: bool = app.debug
    url: str = f"http://127.0.0.1:{puerto}/"

    if not debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        print("\n" + "=" * 65)
        print("   TIENDA ALEXANDER — SISTEMA DE GESTIÓN Y VENTAS")
        print("=" * 65)
        print(f" * Base de datos SQLite : {db.RUTA_DB}")
        print(" * Sesiones Seguras     : Cookies HttpOnly respaldadas en SQLite")
        print(" * Fuerza Bruta         : Bloqueo escalonado (3 fallos -> 1m, +2m)")
        print(f" * Servidor Web activo  : {url}")
        print("=" * 65 + "\n")
        threading.Thread(target=_abrir_navegador, args=(url,), daemon=True).start()

    app.run(host=host, port=puerto, debug=debug)
