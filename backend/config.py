import os
import secrets
from datetime import datetime
from pathlib import Path

RAIZ_ACTUAL = Path(__file__).resolve().parent.parent
RAIZ_RECURSOS = RAIZ_ACTUAL
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
    """Lee el archivo .env de la raíz del proyecto y lo carga en os.environ."""
    ruta = RAIZ_ACTUAL / ".env"
    if not ruta.exists():
        return
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
    """Obtiene SECRET_KEY del entorno o genera y persiste una aleatoria."""
    cargar_env()
    clave = os.environ.get("SECRET_KEY", "").strip()
    if clave not in CLAVES_INSEGURAS_CONOCIDAS:
        return clave

    nueva_clave = secrets.token_hex(32)
    os.environ["SECRET_KEY"] = nueva_clave

    ruta_env = RAIZ_ACTUAL / ".env"
    try:
        lineas = []
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
    SECRET_KEY = SECRET_KEY_ACTIVA
    DEBUG = False
    TESTING = False
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    DATABASE_PATH = str(RAIZ_ACTUAL / "database" / "tienda_alexander.db")


class DevelopmentConfig(Config):
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"


class ProductionConfig(Config):
    DEBUG = False


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": ProductionConfig,
}
