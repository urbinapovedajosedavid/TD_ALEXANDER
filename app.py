import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

sys.dont_write_bytecode = True

RAIZ_BASE = Path(__file__).resolve().parent
if str(RAIZ_BASE) not in sys.path:
    sys.path.insert(0, str(RAIZ_BASE))

from flask import Flask, redirect, send_from_directory
from flask_cors import CORS

import backend.db as db
from backend.api import api_bp
from backend.config import RAIZ_ACTUAL, config
from seguridad import obtener_token_actual, usuario_de_token

FRONTEND_DIR = str(RAIZ_ACTUAL / "Frontend")

app = Flask(__name__, static_folder=None)

entorno = os.environ.get("FLASK_ENV", "production")
app.config.from_object(config.get(entorno, config["default"]))

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"
app.config["SESSION_COOKIE_NAME"] = "alexander_session"

CORS(app, supports_credentials=True)
app.register_blueprint(api_bp)

db.inicializar_db()

ALIAS_PAGINAS = {
    "login": "Login.html",
    "login.html": "Login.html",
    "proveedores": "provedores.html",
    "proveedores.html": "provedores.html",
    "js/pages/proveedores.js": "js/pages/provedores.js",
    "copia_seguridad": "copia_de_seguridad.html",
    "registro": "agregar_usuario.html",
}


@app.route("/")
def index():
    token = obtener_token_actual()
    if token:
        with db.conectar_db() as conn:
            if usuario_de_token(conn, token):
                return redirect("/inicio.html")
    return redirect("/Login.html")


@app.route("/<path:nombre_archivo>")
def servir_frontend(nombre_archivo: str):
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
    time.sleep(1.0)
    try:
        webbrowser.open(url)
    except Exception:
        pass


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    puerto = int(os.environ.get("PORT", 5000))
    debug = app.debug
    url = f"http://127.0.0.1:{puerto}/"

    if not debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        print("\n" + "=" * 65)
        print("   TIENDA ALEXANDER — SISTEMA DE GESTIÓN Y VENTAS")
        print("=" * 65)
        print(f" * Base de datos SQLite : {db.RUTA_DB} (Modo WAL)")
        print(f" * Servidor Web activo  : {url}")
        print("=" * 65 + "\n")
        threading.Thread(target=_abrir_navegador, args=(url,), daemon=True).start()

    app.run(host=host, port=puerto, debug=debug)
