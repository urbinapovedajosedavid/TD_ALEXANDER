import os
import secrets
import sys
from datetime import datetime
from pathlib import Path

# Detección unificada de rutas según si corre como script o binario .exe (PyInstaller)
if getattr(sys, "frozen", False):
    raiz_actual = Path(sys.executable).resolve().parent
    raiz_recursos = Path(getattr(sys, "_MEIPASS", raiz_actual))
else:
    raiz_actual = Path(__file__).resolve().parent.parent
    raiz_recursos = raiz_actual

RAIZ_ACTUAL = raiz_actual
RAIZ_RECURSOS = raiz_recursos

BASE_DIR = str(RAIZ_ACTUAL)
FORMATO_FECHA = "%Y-%m-%d %H:%M:%S"

CLAVES_INSEGURAS_CONOCIDAS = {
    "",
    "clave-secreta-tienda-alexander-segura-2026",
    "clave-secreta-cambiar-en-produccion",
}


def ahora() -> str:
    """Marca de tiempo local en el formato estándar de SQLite."""
    return datetime.now().strftime(FORMATO_FECHA)


def cargar_env() -> None:
    """Lee el archivo .env de la raíz del proyecto y lo inyecta en os.environ."""
    rutas = [RAIZ_ACTUAL / ".env"]
    if RAIZ_RECURSOS != RAIZ_ACTUAL:
        rutas.append(RAIZ_RECURSOS / ".env")

    for ruta in rutas:
        if not ruta.exists():
            continue
        try:
            with open(ruta, encoding="utf-8") as f:
                for linea in f:
                    linea = linea.strip()
                    if not linea or linea.startswith("#") or "=" not in linea:
                        continue
                    clave, _, valor = linea.partition("=")
                    clave, valor = clave.strip(), valor.strip()
                    if clave and clave not in os.environ:
                        os.environ[clave] = valor
        except OSError:
            pass


def _obtener_o_crear_secret_key() -> str:
    """Obtiene SECRET_KEY del entorno o genera y persiste una aleatoria segura."""
    cargar_env()
    clave = os.environ.get("SECRET_KEY", "").strip()
    if clave not in CLAVES_INSEGURAS_CONOCIDAS:
        return clave

    nueva_clave = secrets.token_hex(32)
    os.environ["SECRET_KEY"] = nueva_clave

    ruta_env = RAIZ_ACTUAL / ".env"
    try:
        lineas: list[str] = []
        reemplazada = False
        if ruta_env.exists():
            for linea in ruta_env.read_text(encoding="utf-8").splitlines():
                if linea.strip().startswith("SECRET_KEY="):
                    lineas.append(f"SECRET_KEY={nueva_clave}")
                    reemplazada = True
                else:
                    lineas.append(linea)
        if not reemplazada:
            lineas.append(f"SECRET_KEY={nueva_clave}")
        ruta_env.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    except OSError:
        pass

    return nueva_clave


SECRET_KEY_ACTIVA = _obtener_o_crear_secret_key()


class Config:
    """Configuración base para la aplicación Flask."""
    SECRET_KEY = SECRET_KEY_ACTIVA
    DEBUG = False
    TESTING = False
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # Límite de 16 MB para subida de respaldos
    DATABASE_PATH = str(RAIZ_ACTUAL / "database" / "tienda_alexander.db")


class DevelopmentConfig(Config):
    """Configuración para entorno local (DEBUG desactivado salvo FLASK_DEBUG=1)."""
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"


class ProductionConfig(Config):
    """Configuración para entorno de producción."""
    DEBUG = False


config: dict[str, type[Config]] = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": ProductionConfig,
}
