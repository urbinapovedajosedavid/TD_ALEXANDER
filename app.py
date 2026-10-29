"""app.py — Punto de entrada principal de Tienda Alexander
=========================================================
Inicia el servidor Flask, conecta la base de datos persistente SQLite,
monta la API RESTful bajo /api y sirve el frontend seguro.

Uso:
    python app.py
"""

import os
import sys
import threading
import webbrowser
from pathlib import Path

# Detección de rutas según si corre como script o como binario .exe
if getattr(sys, "frozen", False):
    RAIZ = Path(sys.executable).resolve().parent
    RAIZ_RECURSOS = Path(getattr(sys, "_MEIPASS", RAIZ))
else:
    RAIZ = Path(__file__).resolve().parent
    RAIZ_RECURSOS = RAIZ

if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))
if str(RAIZ_RECURSOS) not in sys.path:
    sys.path.insert(0, str(RAIZ_RECURSOS))
if str(RAIZ / "Backend") not in sys.path:
    sys.path.insert(0, str(RAIZ / "Backend"))

from flask import Flask, redirect, send_from_directory, session
from flask_cors import CORS

import db
from api import api_bp
from config import config

FRONTEND_DIR = os.path.join(RAIZ_RECURSOS, "Frontend")
if not os.path.isdir(FRONTEND_DIR):
    FRONTEND_DIR = os.path.join(RAIZ, "Frontend")

app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,
    static_url_path="",
)

# Cargar configuración base
entorno = os.environ.get("FLASK_ENV", "development")
app.config.from_object(config.get(entorno, config["development"]))

# Configuración de sesiones seguras del servidor (Cero LocalStorage)
app.secret_key = os.environ.get("SECRET_KEY") or "clave-secreta-tienda-alexander-segura-2026"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,   # Inaccesible desde JavaScript
    SESSION_COOKIE_SAMESITE="Lax",  # Protección CSRF
    SESSION_COOKIE_SECURE=False,    # True en producción con HTTPS
    SESSION_COOKIE_NAME="alexander_session",
)

# CORS habilitado con soporte para cookies de sesión
CORS(app, supports_credentials=True)

# Registrar Blueprint de la API REST
app.register_blueprint(api_bp)

# Inicializar y verificar persistencia de base de datos SQLite
db.inicializar_db()


# ============================================================== #
#  Rutas del Frontend Seguro (servido directamente por Flask)     #
# ============================================================== #

@app.route("/")
def index():
    if session.get("usuario_id"):
        return redirect("/inicio.html")
    return redirect("/Login.html")


@app.route("/<path:nombre_archivo>")
def servir_frontend(nombre_archivo):
    # Si se pide una ruta directa existente
    ruta_directa = os.path.join(FRONTEND_DIR, nombre_archivo)
    if os.path.isfile(ruta_directa):
        return send_from_directory(FRONTEND_DIR, nombre_archivo)

    # Intentar con sufijo .html
    ruta_html = os.path.join(FRONTEND_DIR, f"{nombre_archivo}.html")
    if os.path.isfile(ruta_html):
        return send_from_directory(FRONTEND_DIR, f"{nombre_archivo}.html")

    # Mapeos especiales
    mapeos = {
        "login": "Login.html",
        "login.html": "Login.html",
        "inicio": "inicio.html",
        "almacen": "almacen.html",
        "ventas": "ventas.html",
        "stock": "stock.html",
        "reportes": "reportes.html",
        "proveedores": "provedores.html",
        "provedores": "provedores.html",
        "copia_seguridad": "copia_de_seguridad.html",
        "registro": "agregar_usuario.html",
        "agregar_usuario": "agregar_usuario.html",
    }
    destino = mapeos.get(nombre_archivo.lower())
    if destino and os.path.isfile(os.path.join(FRONTEND_DIR, destino)):
        return send_from_directory(FRONTEND_DIR, destino)

    return send_from_directory(FRONTEND_DIR, nombre_archivo)


def _abrir_navegador(url: str):
    import time
    time.sleep(1.2)
    try:
        webbrowser.open(url)
    except Exception:
        pass


if __name__ == "__main__":
    puerto = int(os.environ.get("PORT", 5000))
    url = f"http://127.0.0.1:{puerto}/"

    print("\n" + "=" * 65)
    print("   TIENDA ALEXANDER — SISTEMA DE GESTIÓN Y VENTAS")
    print("=" * 65)
    print(f" * Base de datos SQLite : {db.RUTA_DB}")
    print(" * Cero LocalStorage    : Sesiones cifradas nativas HttpOnly")
    print(" * Fuerza Bruta         : Bloqueo escalonado (3 fallos -> 1m, +2m)")
    print(f" * Servidor Web activo  : {url}")
    print(" * Abriendo navegador automáticamente...")
    print("=" * 65 + "\n")

    threading.Thread(target=_abrir_navegador, args=(url,), daemon=True).start()
    app.run(host="0.0.0.0", port=puerto, debug=app.config.get("DEBUG", False))
