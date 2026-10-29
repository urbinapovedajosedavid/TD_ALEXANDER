import os
from pathlib import Path

# Directorio base del proyecto (sube un nivel desde Backend/)
BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


def _cargar_env():
    """Lee el .env de la raíz del proyecto y lo vuelca en os.environ."""
    ruta = Path(BASE_DIR) / ".env"
    if not ruta.exists():
        return
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, _, valor = linea.partition("=")
            clave, valor = clave.strip(), valor.strip()
            if clave and clave not in os.environ:
                os.environ[clave] = valor


_cargar_env()


class Config:
    """Configuración base para la aplicación Flask."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'clave-secreta-cambiar-en-produccion'
    DEBUG = False
    TESTING = False

    # Ruta absoluta hacia la base de datos SQLite
    DATABASE_PATH = os.path.join(BASE_DIR, 'database', 'tienda_alexander.db')

class DevelopmentConfig(Config):
    """Configuración para entorno de desarrollo."""
    DEBUG = True

class ProductionConfig(Config):
    """Configuración para entorno de producción."""
    DEBUG = False

# Diccionario selector de configuraciones
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
