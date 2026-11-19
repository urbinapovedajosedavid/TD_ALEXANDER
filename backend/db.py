# Conexión e inicialización de base de datos

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from backend.config import RAIZ_ACTUAL
from seguridad.modelos import inicializar_usuarios

RUTA_ESQUEMA = RAIZ_ACTUAL / "database" / "esquema.sql"
RUTA_DB = Path(
    os.environ.get("TIENDA_DB_PATH")
    or (RAIZ_ACTUAL / "database" / "tienda_alexander.db")
)

CATEGORIAS_INICIALES = (
    "Celulares y Smartphones",
    "Accesorios para Celular",
    "Electrodomésticos de Cocina",
    "Ventilación y Hogar",
)

PROVEEDORES_INICIALES = (
    ("Distribuidora MovilNica S.A.", "22504120", "001-120488-0041A", "Mercado Oriental, de donde fue el Novillo 2c. al sur", "Managua"),
    ("ElectroHogar Mayorista", "22789012", "001-250885-0019B", "Km 4.5 Carretera Norte, frente a ENABAS", "Managua"),
    ("Importaciones Tecnológicas Masaya", "25223410", "401-150990-0008M", "Parque Central 1c. al oeste", "Masaya"),
    ("Comercial del Norte León", "23114580", "281-040282-0014L", "Costado norte de la Terminal de Buses", "León"),
)

PRODUCTOS_INICIALES = (
    ("750100100101", "Samsung Galaxy A15 128GB", 1, 1, 5850.00, 5100.00, 8),
    ("750100100102", "Xiaomi Redmi Note 13 256GB", 1, 1, 6900.00, 6050.00, 6),
    ("750100100103", "Samsung Galaxy A05 64GB", 1, 1, 3950.00, 3400.00, 10),
    ("750100100104", "Xiaomi Redmi 13C 128GB", 1, 1, 4450.00, 3850.00, 9),
    ("750100100105", "Honor X6a Plus 128GB", 1, 1, 4600.00, 3980.00, 5),
    ("750100100106", "Motorola Moto G24 128GB", 1, 1, 4800.00, 4150.00, 7),
    ("750100100201", "Vidrio Templado 9D (Glass Universal)", 2, 3, 120.00, 45.00, 45),
    ("750100100202", "Vidrio Templado Privacidad (Glass Anti-Espía)", 2, 3, 180.00, 75.00, 30),
    ("750100100203", "Cargador Rápido Tipo-C 25W", 2, 3, 380.00, 230.00, 25),
    ("750100100204", "Cable USB a Tipo-C Reforzado 1m", 2, 3, 150.00, 65.00, 40),
    ("750100100205", "Cable USB a Lightning para iPhone", 2, 3, 160.00, 70.00, 28),
    ("750100100206", "Audífonos Inalámbricos Bluetooth TWS", 2, 3, 480.00, 310.00, 4),
    ("750100100207", "Audífonos de Cable con Micrófono 3.5mm", 2, 3, 140.00, 60.00, 32),
    ("750100100208", "Cover de Silicona Antigolpes para Celular", 2, 3, 180.00, 80.00, 35),
    ("750100100209", "Memoria MicroSD Kingston 64GB Clase 10", 2, 3, 320.00, 210.00, 18),
    ("750100100210", "Power Bank Batería Portátil 10000mAh", 2, 3, 650.00, 460.00, 11),
    ("750100100301", "Licuadora Oster 2 Velocidades Vaso de Vidrio", 3, 2, 2250.00, 1780.00, 10),
    ("750100100302", "Licuadora Black+Decker 10 Velocidades Vaso Plástico", 3, 2, 1450.00, 1120.00, 12),
    ("750100100303", "Arrocera Black+Decker 1.8 Litros con Vaporera", 3, 2, 1350.00, 1020.00, 9),
    ("750100100304", "Cafetera Eléctrica Programable 12 Tazas", 3, 4, 1180.00, 890.00, 0),
    ("750100100305", "Sandwichera Eléctrica Antiadherente 2 Panes", 3, 2, 780.00, 560.00, 14),
    ("750100100306", "Tostadora de Pan 2 Ranuras 7 Niveles", 3, 2, 850.00, 620.00, 8),
    ("750100100307", "Cocina de Mesa a Gas 2 Quemadores", 3, 4, 1250.00, 940.00, 7),
    ("750100100308", "Horno Microondas 0.7 Pies Cúbicos 700W", 3, 2, 3450.00, 2850.00, 5),
    ("750100100401", "Abanico de Pedestal Samuelson 18 Pulgadas", 4, 4, 1550.00, 1200.00, 15),
    ("750100100402", "Abanico de Mesa 12 Pulgadas 3 Velocidades", 4, 4, 890.00, 650.00, 12),
    ("750100100403", "Abanico de Pared Oscilante 16 Pulgadas", 4, 4, 1280.00, 960.00, 10),
    ("750100100404", "Plancha a Vapor Antiadherente Black+Decker", 4, 2, 880.00, 640.00, 3),
    ("750100100405", "Regleta Protector de Voltaje 6 Tomas", 4, 4, 340.00, 210.00, 22),
    ("750100100406", "Bocina Portátil Bluetooth Recargable FM/USB", 4, 3, 750.00, 520.00, 14),
)


@contextmanager
def conectar_db():
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(RUTA_DB, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def purgar_todas_las_sesiones() -> None:
    with conectar_db() as conn:
        from seguridad.autenticacion import purgar_todas_las_sesiones as _purgar
        _purgar(conn)


def inicializar_db() -> None:
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    sql = RUTA_ESQUEMA.read_text(encoding="utf-8")

    conn = sqlite3.connect(RUTA_DB, timeout=10.0)
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.executescript(sql)
        _sembrar(conn)
        conn.commit()
    finally:
        conn.close()


def _sembrar(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    inicializar_usuarios(conn)

    if cur.execute("SELECT COUNT(*) FROM categorias").fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO categorias (nombre) VALUES (?)",
            [(c,) for c in CATEGORIAS_INICIALES],
        )

    if cur.execute("SELECT COUNT(*) FROM proveedores").fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO proveedores (nombre, telefono, cedula, direccion, departamento) "
            "VALUES (?, ?, ?, ?, ?)",
            PROVEEDORES_INICIALES,
        )

    if cur.execute("SELECT COUNT(*) FROM productos").fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO productos "
            "(codigo_barra, nombre, categoria_id, proveedor_id, precio, costo_entrada, stock) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            PRODUCTOS_INICIALES,
        )
