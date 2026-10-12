import os

# Directorio base del proyecto (sube un nivel desde Backend/)
BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

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